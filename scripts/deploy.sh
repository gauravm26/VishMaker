#!/bin/bash

set -e

export AWS_PROFILE=vish-prod

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_usage() {
    echo "Usage: $0 [OPTION] [--force]"
    echo ""
    echo "Options:"
    echo "  (no args)                   Deploy everything (lambdas + frontend)"
    echo "  lambdas                     Deploy all lambdas only"
    echo "  frontend                    Deploy frontend only"
    echo "  terraform                   Deploy Terraform infrastructure only"
    echo "  --force                     Force rebuild of components"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                          # Deploy everything (lambdas + frontend)"
    echo "  $0 lambdas                  # Deploy all lambdas only"
    echo "  $0 frontend                 # Deploy frontend only"
    echo "  $0 terraform                # Deploy Terraform infrastructure only"
    echo "  $0 frontend --force         # Force rebuild and deploy frontend"
    echo "  $0 --force                  # Force rebuild everything"
    echo ""
}

# Default values
DEPLOY_MODE="all"  # all, lambdas, or frontend
ENVIRONMENT="prod"
AUTO_CONFIRM=true
FORCE_REBUILD=false

# Define available lambdas
AVAILABLE_LAMBDAS=("auth" "llm" "projects" "requirements" "waitlist")

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        lambdas)
            DEPLOY_MODE="lambdas"
            shift
            ;;
        frontend)
            DEPLOY_MODE="frontend"
            shift
            ;;
        terraform)
            DEPLOY_MODE="terraform"
            shift
            ;;
        --force)
            FORCE_REBUILD=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            print_error "Invalid option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# If no deploy mode specified, default to all
if [[ "$DEPLOY_MODE" == "" ]]; then
    DEPLOY_MODE="all"
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_ROOT="$PROJECT_ROOT/app/backend"
TERRAFORM_DIR="$PROJECT_ROOT/iac"

# Ensure all paths are absolute
SCRIPT_DIR="$(realpath "$SCRIPT_DIR")"
BACKEND_ROOT="$(realpath "$BACKEND_ROOT")"
PROJECT_ROOT="$(realpath "$PROJECT_ROOT")"
TERRAFORM_DIR="$(realpath "$TERRAFORM_DIR")"

echo -e "${GREEN}🚀 VishMaker AWS Deployment${NC}"
echo -e "${GREEN}=================================${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Deploy Mode: ${DEPLOY_MODE}${NC}"
echo -e "${BLUE}Project Root: ${PROJECT_ROOT}${NC}"
echo -e "${BLUE}Backend Root: ${BACKEND_ROOT}${NC}"
echo -e "${BLUE}Terraform Dir: ${TERRAFORM_DIR}${NC}"
echo ""

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed or not in PATH"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed or not in PATH"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed or not in PATH"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

print_success "Prerequisites check passed"

# Step 1: Build Lambda packages (skip if only frontend or terraform)
if [[ "$DEPLOY_MODE" == "all" || "$DEPLOY_MODE" == "lambdas" ]]; then
    print_status "Building Lambda deployment packages..."
    cd "$SCRIPT_DIR"

    # Function to check if lambda needs rebuilding
    lambda_needs_rebuild() {
        local lambda_name=$1
        local lambda_dir="$BACKEND_ROOT/lambdas/$lambda_name"
        local package_file="$SCRIPT_DIR/dist/${lambda_name}-deployment.zip"
        
        # If package doesn't exist, needs rebuild
        if [ ! -f "$package_file" ]; then
            return 0  # true - needs rebuild
        fi
        
        # Check if any source files are newer than the package
        local package_time=$(stat -f "%m" "$package_file" 2>/dev/null || stat -c "%Y" "$package_file" 2>/dev/null)
        local latest_source_time=0
        
        # Find the latest modification time of source files
        if [ -d "$lambda_dir/code" ]; then
            latest_source_time=$(find "$lambda_dir/code" -name "*.py" -o -name "*.txt" -o -name "*.json" | xargs stat -f "%m" 2>/dev/null | sort -n | tail -1 2>/dev/null || find "$lambda_dir/code" -name "*.py" -o -name "*.txt" -o -name "*.json" | xargs stat -c "%Y" 2>/dev/null | sort -n | tail -1 2>/dev/null || echo "0")
        fi
        
        # If source files are newer than package, needs rebuild
        if [ "$latest_source_time" -gt "$package_time" ]; then
            return 0  # true - needs rebuild
        fi
        
        return 1  # false - no rebuild needed
    }

    # Function to build specific lambda
    build_lambda() {
        local lambda_name=$1
        local force_rebuild=${2:-false}
        
        # Check if lambda directory exists
        if [ ! -d "$BACKEND_ROOT/lambdas/$lambda_name" ]; then
            print_warning "Lambda directory for $lambda_name not found, skipping..."
            return 0
        fi
        
        # Check if rebuild is needed
        if [ "$force_rebuild" = "true" ] || lambda_needs_rebuild "$lambda_name"; then
            print_status "Building $lambda_name lambda..."
            
            # Build the specific lambda
            if ./lambda_zip.sh "$lambda_name"; then
                print_success "$lambda_name lambda built successfully"
                return 0
            else
                print_error "Failed to build $lambda_name lambda"
                return 1
            fi
        else
            print_success "$lambda_name lambda is up to date, skipping build"
            return 0
        fi
    }

    # Build lambdas based on deploy mode
    print_status "Building all lambdas..."
    for lambda in "${AVAILABLE_LAMBDAS[@]}"; do
        if [ -d "$BACKEND_ROOT/lambdas/$lambda" ]; then
            if ! build_lambda "$lambda" "$FORCE_REBUILD"; then
                exit 1
            fi
        else
            print_warning "Lambda directory for $lambda not found, skipping..."
        fi
    done

    print_success "Lambda packages built successfully"

    # Step 2: Verify deployment packages are ready
    print_status "Verifying deployment packages..."

    # Function to verify lambda package
    verify_lambda_package() {
        local lambda_name=$1
        local package_file="$SCRIPT_DIR/dist/${lambda_name}-deployment.zip"
        
        if [ -f "$package_file" ]; then
            local size=$(du -h "$package_file" | cut -f1)
            print_success "✓ $lambda_name-deployment.zip ready ($size)"
        else
            print_warning "⚠️ $lambda_name-deployment.zip not found"
        fi
    }

    # Verify packages
    print_status "Verifying all lambda packages..."
    for lambda in "${AVAILABLE_LAMBDAS[@]}"; do
        verify_lambda_package "$lambda"
    done

    print_success "Deployment packages verified"
fi

# Step 3: Initialize Terraform (skip if only frontend)
if [[ "$DEPLOY_MODE" == "all" || "$DEPLOY_MODE" == "lambdas" || "$DEPLOY_MODE" == "terraform" ]]; then
    print_status "Initializing Terraform..."
    cd "$TERRAFORM_DIR"
    if ! terraform init; then
        print_error "Terraform initialization failed"
        exit 1
    fi
    print_success "Terraform initialized"

# Step 4: Create terraform.tfvars if it doesn't exist
if [ ! -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
    print_status "Creating terraform.tfvars from example..."
    if [ -f "$TERRAFORM_DIR/terraform.tfvars.example" ]; then
        cp "$TERRAFORM_DIR/terraform.tfvars.example" "$TERRAFORM_DIR/terraform.tfvars"
        print_warning "Please edit terraform.tfvars with your configuration before proceeding"
        print_warning "File location: $TERRAFORM_DIR/terraform.tfvars"
        
        read -p "Press Enter to continue after editing terraform.tfvars, or Ctrl+C to exit..."
    else
        print_warning "terraform.tfvars.example not found. Please create terraform.tfvars manually."
        print_warning "You can also run without terraform.tfvars to use default values."
        
        read -p "Do you want to continue with default values? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled by user"
            exit 0
        fi
    fi
fi

# Step 5: Plan deployment
print_status "Planning Terraform deployment..."
if ! terraform plan -out=tfplan; then
    print_error "Terraform planning failed"
    exit 1
fi
print_success "Terraform plan completed"

# Step 6: Check if there are changes to apply
print_status "Analyzing Terraform plan..."

# Use terraform show to check for actual changes
PLAN_OUTPUT=$(terraform show tfplan)
if echo "$PLAN_OUTPUT" | grep -q "No changes\. Your infrastructure matches the configuration\."; then
    print_success "No changes detected in Terraform plan - infrastructure is up to date"
    print_status "Skipping Terraform apply..."
    SKIP_TERRAFORM_APPLY=true
else
    print_status "Changes detected in Terraform plan"
    SKIP_TERRAFORM_APPLY=false
    
    # Show plan summary
    print_status "Plan Summary:"
    echo "$PLAN_OUTPUT" | grep -E "(Plan:|No changes|will be created|will be updated|will be destroyed)" || true
fi

# Step 7: Confirm deployment (only if there are changes)
if [ "$SKIP_TERRAFORM_APPLY" = "false" ]; then
    if [ "$AUTO_CONFIRM" = true ]; then
        print_status "Auto-confirm enabled, proceeding with deployment..."
    else
        echo ""
        print_warning "Review the Terraform plan above."
        read -p "Do you want to proceed with deployment? (y/N): " -n 1 -r
        echo ""

        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled by user"
            exit 0
        fi
    fi

    # Step 8: Apply deployment
    print_status "Applying Terraform deployment..."
    if ! terraform apply tfplan; then
        print_error "Terraform deployment failed"
        exit 1
    fi
            print_success "Terraform deployment completed"
    else
        print_success "Skipped Terraform apply - no changes needed"
    fi
fi

# Step 8.5: Delete and recreate stuck Lambda functions (if lambdas were deployed)
if [[ "$DEPLOY_MODE" == "all" || "$DEPLOY_MODE" == "lambdas" ]]; then
    print_status "Checking Lambda function status and recreating if stuck..."
    cd "$SCRIPT_DIR"
    
    for lambda in "${AVAILABLE_LAMBDAS[@]}"; do
        function_name="dev-vishmaker-$lambda"
        package_file="$SCRIPT_DIR/dist/${lambda}-deployment.zip"
        
        if [ -f "$package_file" ]; then
            print_status "Checking $function_name status..."
            
            # Check if function is stuck in "Creating" state
            function_status=$(aws lambda get-function --function-name "$function_name" --query 'Configuration.LastUpdateStatus' --output text 2>/dev/null || echo "NOT_FOUND")
            
            if [[ "$function_status" == "InProgress" || "$function_status" == "Creating" ]]; then
                print_warning "$function_name is stuck in $function_status state, deleting and recreating..."
                
                # Delete the stuck function
                if aws lambda delete-function --function-name "$function_name"; then
                    print_success "$function_name deleted successfully"
                    
                    # Wait for deletion to complete
                    print_status "Waiting for deletion to complete..."
                    sleep 30
                    
                    # Check if deletion was successful
                    if aws lambda get-function --function-name "$function_name" >/dev/null 2>&1; then
                        print_warning "$function_name still exists, waiting longer..."
                        sleep 60
                    fi
                    
                    # Verify deletion
                    if ! aws lambda get-function --function-name "$function_name" >/dev/null 2>&1; then
                        print_success "$function_name successfully deleted"
                    else
                        print_error "Failed to delete $function_name, skipping recreation"
                        continue
                    fi
                else
                    print_error "Failed to delete $function_name, skipping recreation"
                    continue
                fi
            else
                print_success "$function_name status: $function_status (OK)"
            fi
        else
            print_warning "$lambda-deployment.zip not found, skipping function check"
        fi
    done
    
    print_success "Lambda function status check completed"
fi

# Step 8.6: Recreate deleted Lambda functions (if any were deleted)
if [[ "$DEPLOY_MODE" == "all" || "$DEPLOY_MODE" == "lambdas" ]]; then
    print_status "Checking if any Lambda functions need to be recreated..."
    cd "$TERRAFORM_DIR"
    
    # Check if any functions are missing
    functions_missing=false
    for lambda in "${AVAILABLE_LAMBDAS[@]}"; do
        function_name="dev-vishmaker-$lambda"
        
        if ! aws lambda get-function --function-name "$function_name" >/dev/null 2>&1; then
            print_warning "$function_name is missing, will recreate via Terraform"
            functions_missing=true
        fi
    done
    
    if [ "$functions_missing" = true ]; then
        print_status "Recreating missing Lambda functions via Terraform..."
        
        # Run Terraform apply to recreate missing functions
        if terraform apply -auto-approve; then
            print_success "Lambda functions recreated successfully"
        else
            print_error "Failed to recreate Lambda functions via Terraform"
            exit 1
        fi
        
        # Wait for functions to be ready
        print_status "Waiting for Lambda functions to be ready..."
        sleep 60
        
        # Verify all functions are now available
        for lambda in "${AVAILABLE_LAMBDAS[@]}"; do
            function_name="dev-vishmaker-$lambda"
            
            if aws lambda get-function --function-name "$function_name" >/dev/null 2>&1; then
                print_success "$function_name is now available"
            else
                print_error "$function_name is still missing after recreation"
                exit 1
            fi
        done
    else
        print_success "All Lambda functions are available, no recreation needed"
    fi
fi

# Step 8.7: Update Lambda function code (if lambdas were deployed)
if [[ "$DEPLOY_MODE" == "all" || "$DEPLOY_MODE" == "lambdas" ]]; then
    print_status "Updating Lambda function code..."
    cd "$SCRIPT_DIR"
    
    # Phase 1: Send update requests for all Lambda functions in parallel
    print_status "🚀 Phase 1: Initiating updates for all Lambda functions in parallel..."
    echo "------------------------------------------------------------------"
    
    pids=() # Array to store process IDs of background jobs
    
    for lambda in "${AVAILABLE_LAMBDAS[@]}"; do
        function_name="dev-vishmaker-$lambda"
        package_file="$SCRIPT_DIR/dist/${lambda}-deployment.zip"
        
        if [ -f "$package_file" ]; then
            print_status "  -> Starting update for ${function_name}..."
            
            # Run the update command in background
            aws lambda update-function-code \
                --function-name "$function_name" \
                --zip-file "fileb://$package_file" > /dev/null &
            
            pids+=($!) # Store the Process ID of the background command
        else
            print_warning "$lambda-deployment.zip not found, skipping update for $function_name"
        fi
    done
    
    print_status "⏳ All update requests have been sent. Waiting for the background jobs to finish..."
    
    # Wait for all update API calls to complete
    for pid in "${pids[@]}"; do
        wait "$pid"
    done
    
    print_success "✅ All update API calls have completed."
    echo ""
    
    # Phase 2: Wait for all Lambda functions to reach 'Successful' update status
    print_status "🚀 Phase 2: Waiting for all Lambda functions to reach 'Successful' update status..."
    echo "--------------------------------------------------------------------------------"
    
    for lambda in "${AVAILABLE_LAMBDAS[@]}"; do
        function_name="dev-vishmaker-$lambda"
        package_file="$SCRIPT_DIR/dist/${lambda}-deployment.zip"
        
        if [ -f "$package_file" ]; then
            print_status "  -> Waiting for ${function_name} to complete update..."
            
            # Wait for this function to complete its update
            if aws lambda wait function-updated --function-name "$function_name"; then
                print_success "  ✅ ${function_name} has been successfully updated."
            else
                print_error "  ❌ ${function_name} update failed or timed out."
                exit 1
            fi
        else
            print_warning "Skipping status check for $function_name (no package file)"
        fi
    done
    
    echo ""
    print_success "🎉 SUCCESS: All Lambda functions have been deployed and updated."
fi

# Step 8: Get outputs (skip if only frontend)
if [[ "$DEPLOY_MODE" == "all" || "$DEPLOY_MODE" == "lambdas" || "$DEPLOY_MODE" == "terraform" ]]; then
    print_status "Retrieving deployment outputs..."
    API_GATEWAY_URL=$(terraform output -raw api_gateway_endpoint 2>/dev/null || echo "Not available")
    COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null || echo "Not available")
    COGNITO_CLIENT_ID=$(terraform output -raw cognito_user_pool_client_id 2>/dev/null || echo "Not available")
    DB_ENDPOINT=$(terraform output -raw db_instance_endpoint 2>/dev/null || echo "Not available")
    FRONTEND_URL=$(terraform output -raw frontend_url 2>/dev/null || echo "Not available")
    CLOUDFRONT_DOMAIN=$(terraform output -raw cloudfront_domain_name 2>/dev/null || echo "Not available")

    # Step 9: Update configuration file
    print_status "Updating configuration with deployment values..."
    CONFIG_FILE="$BACKEND_ROOT/config/config.json"

    if [ -f "$CONFIG_FILE" ]; then
        # Create a backup
        cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
        
        # Update config file with real values (you might want to use jq for this)
        print_warning "Please manually update $CONFIG_FILE with the following values:"
        echo "  - user_pool_id: $COGNITO_USER_POOL_ID"
        echo "  - client_id: $COGNITO_CLIENT_ID"
        echo "  - api_gateway_url: $API_GATEWAY_URL"
    else
        print_warning "Configuration file not found at $CONFIG_FILE"
    fi
else
    # Initialize variables for frontend-only deployment
    API_GATEWAY_URL=""
    COGNITO_USER_POOL_ID=""
    COGNITO_CLIENT_ID=""
    DB_ENDPOINT=""
    FRONTEND_URL=""
    CLOUDFRONT_DOMAIN=""
fi

# Step 10: Deploy Frontend (if requested)
if [[ "$DEPLOY_MODE" == "all" || "$DEPLOY_MODE" == "frontend" ]]; then
    print_status "Deploying frontend..."
    
    # If only frontend is being deployed, we need to get the API Gateway URL from existing Terraform state
    if [[ "$DEPLOY_MODE" == "frontend" ]]; then
        print_status "Getting API Gateway URL from existing Terraform state..."
        cd "$TERRAFORM_DIR"
        if [ -f "terraform.tfstate" ]; then
            API_GATEWAY_URL=$(terraform output -raw api_gateway_endpoint 2>/dev/null || echo "")
            if [ -z "$API_GATEWAY_URL" ]; then
                print_error "Could not get API Gateway URL from Terraform state. Please run full deployment first."
                exit 1
            fi
            print_success "Found API Gateway URL: $API_GATEWAY_URL"
        else
            print_error "No Terraform state found. Please run full deployment first."
            exit 1
        fi
        cd - > /dev/null
    fi
    
    # Navigate to frontend directory
    FRONTEND_DIR="$PROJECT_ROOT/app/frontend"
    if [ ! -d "$FRONTEND_DIR" ]; then
        print_error "Frontend directory not found at $FRONTEND_DIR"
        exit 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Check if frontend needs rebuilding
    FRONTEND_NEEDS_REBUILD=false
    
    if [ "$FORCE_REBUILD" = "true" ]; then
        FRONTEND_NEEDS_REBUILD=true
        print_status "Force rebuild enabled, will rebuild frontend"
    else
        # Check if dist directory exists
        if [ ! -d "dist" ]; then
            FRONTEND_NEEDS_REBUILD=true
            print_status "Frontend dist directory not found, will rebuild"
        else
            # Check if any source files are newer than dist
            dist_time=$(stat -f "%m" dist 2>/dev/null || stat -c "%Y" dist 2>/dev/null)
            latest_source_time=$(find src -name "*.tsx" -o -name "*.ts" -o -name "*.css" -o -name "*.json" | xargs stat -f "%m" 2>/dev/null | sort -n | tail -1 2>/dev/null || find src -name "*.tsx" -o -name "*.ts" -o -name "*.css" -o -name "*.json" | xargs stat -c "%Y" 2>/dev/null | sort -n | tail -1 2>/dev/null || echo "0")
            
            if [ "$latest_source_time" -gt "$dist_time" ]; then
                FRONTEND_NEEDS_REBUILD=true
                print_status "Frontend source files have changed, will rebuild"
            fi
        fi
    fi
    
    # Create environment file with API URL
    print_status "Creating environment configuration..."
    
    # Check if environment has changed
    if [ -f ".env.production" ] && [ -f "dist/index.html" ]; then
        current_api_url=$(grep "VITE_API_BASE_URL" .env.production 2>/dev/null | cut -d'=' -f2 || echo "")
        if [ "$current_api_url" != "$API_GATEWAY_URL" ]; then
            FRONTEND_NEEDS_REBUILD=true
            print_status "API URL changed from '$current_api_url' to '$API_GATEWAY_URL', will rebuild"
        fi
    fi
    
    cat > .env.production << EOF
VITE_API_BASE_URL=$API_GATEWAY_URL
VITE_ENVIRONMENT=prod
EOF
    
    print_status "Backend URL: $API_GATEWAY_URL"
    
    if [ "$FRONTEND_NEEDS_REBUILD" = "true" ]; then
        # Install dependencies
        print_status "Installing frontend dependencies..."
        if ! npm install; then
            print_error "Failed to install frontend dependencies"
            exit 1
        fi
        
        # Build the frontend
        print_status "Building frontend..."
        if ! npm run build; then
            print_error "Failed to build frontend"
            exit 1
        fi
    else
        print_success "Frontend is up to date, skipping build"
    fi
    
    # Get S3 bucket name from Terraform output
    cd "$TERRAFORM_DIR"
    S3_BUCKET=$(terraform output -raw frontend_bucket_name 2>/dev/null || echo "")
    CLOUDFRONT_ID=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")
    cd - > /dev/null
    
    if [ -z "$S3_BUCKET" ]; then
        print_error "Could not get S3 bucket name from Terraform output"
        exit 1
    fi
    
    # Upload to S3
    print_status "Uploading frontend to S3 bucket: $S3_BUCKET"
    if ! aws s3 sync dist/ "s3://$S3_BUCKET" --delete; then
        print_error "Failed to upload frontend to S3"
        exit 1
    fi
    
    # Invalidate CloudFront cache
    if [ -n "$CLOUDFRONT_ID" ]; then
        print_status "Invalidating CloudFront cache..."
        if ! aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_ID" --paths "/*"; then
            print_warning "Failed to invalidate CloudFront cache"
        fi
    fi
    
    cd "$TERRAFORM_DIR"
    print_success "Frontend deployed successfully"
fi

# Step 11: Display summary
echo ""
print_success "🎉 VishMaker deployment completed successfully!"
echo ""

# Display different summaries based on deploy mode
if [[ "$DEPLOY_MODE" == "frontend" ]]; then
    echo -e "${GREEN}📋 Frontend Deployment Summary${NC}"
    echo -e "${GREEN}============================${NC}"
    echo -e "🌍 Frontend URL: ${BLUE}$FRONTEND_URL${NC}"
    echo -e "☁️  CloudFront Domain: ${BLUE}$CLOUDFRONT_DOMAIN${NC}"
    echo ""
    print_success "Frontend deployment completed successfully! 🎉"
elif [[ "$DEPLOY_MODE" == "lambdas" ]]; then
    echo -e "${GREEN}📋 Lambda Deployment Summary${NC}"
    echo -e "${GREEN}==========================${NC}"
    echo -e "🌐 API Gateway URL: ${BLUE}$API_GATEWAY_URL${NC}"
    echo -e "🔐 Cognito User Pool ID: ${BLUE}$COGNITO_USER_POOL_ID${NC}"
    echo -e "🔑 Cognito Client ID: ${BLUE}$COGNITO_CLIENT_ID${NC}"
    echo -e "🗄️  Database Endpoint: ${BLUE}$DB_ENDPOINT${NC}"
    echo ""
    echo -e "${GREEN}📍 Available Endpoints${NC}"
    echo -e "======================"
    echo -e "🔗 Health Check: ${BLUE}$API_GATEWAY_URL/ping${NC}"
    echo -e "🔗 Auth API: ${BLUE}$API_GATEWAY_URL/auth/${NC}"
    echo -e "🔗 Projects API: ${BLUE}$API_GATEWAY_URL/projects/${NC}"
    echo -e "🔗 Requirements API: ${BLUE}$API_GATEWAY_URL/requirements/${NC}"
    echo -e "🔗 LLM API: ${BLUE}$API_GATEWAY_URL/llm/${NC}"
    echo -e "🔗 Waitlist API: ${BLUE}$API_GATEWAY_URL/api/waitlist${NC}"
    echo ""
    print_success "Lambda deployment completed successfully! 🎉"
elif [[ "$DEPLOY_MODE" == "terraform" ]]; then
    echo -e "${GREEN}📋 Terraform Infrastructure Summary${NC}"
    echo -e "${GREEN}==================================${NC}"
    echo -e "🌐 API Gateway URL: ${BLUE}$API_GATEWAY_URL${NC}"
    echo -e "🔐 Cognito User Pool ID: ${BLUE}$COGNITO_USER_POOL_ID${NC}"
    echo -e "🔑 Cognito Client ID: ${BLUE}$COGNITO_CLIENT_ID${NC}"
    echo -e "🗄️  Database Endpoint: ${BLUE}$DB_ENDPOINT${NC}"
    echo -e "🌍 Frontend URL: ${BLUE}$FRONTEND_URL${NC}"
    echo -e "☁️  CloudFront Domain: ${BLUE}$CLOUDFRONT_DOMAIN${NC}"
    echo ""
    echo -e "${GREEN}📍 Available Endpoints${NC}"
    echo -e "======================"
    echo -e "🔗 Health Check: ${BLUE}$API_GATEWAY_URL/ping${NC}"
    echo -e "🔗 Auth API: ${BLUE}$API_GATEWAY_URL/auth/${NC}"
    echo -e "🔗 Projects API: ${BLUE}$API_GATEWAY_URL/projects/${NC}"
    echo -e "🔗 Requirements API: ${BLUE}$API_GATEWAY_URL/requirements/${NC}"
    echo -e "🔗 LLM API: ${BLUE}$API_GATEWAY_URL/llm/${NC}"
    echo -e "🔗 Waitlist API: ${BLUE}$API_GATEWAY_URL/api/waitlist${NC}"
    echo -e "🔗 Frontend: ${BLUE}$FRONTEND_URL${NC}"
    echo ""
    print_success "Terraform infrastructure deployment completed successfully! 🎉"
else
    # Full deployment summary
    echo -e "${GREEN}📋 Full Deployment Summary${NC}"
    echo -e "${GREEN}========================${NC}"
    echo -e "🌐 API Gateway URL: ${BLUE}$API_GATEWAY_URL${NC}"
    echo -e "🔐 Cognito User Pool ID: ${BLUE}$COGNITO_USER_POOL_ID${NC}"
    echo -e "🔑 Cognito Client ID: ${BLUE}$COGNITO_CLIENT_ID${NC}"
    echo -e "🗄️  Database Endpoint: ${BLUE}$DB_ENDPOINT${NC}"
    echo -e "🌍 Frontend URL: ${BLUE}$FRONTEND_URL${NC}"
    echo -e "☁️  CloudFront Domain: ${BLUE}$CLOUDFRONT_DOMAIN${NC}"
    echo ""
    echo -e "${GREEN}📍 Available Endpoints${NC}"
    echo -e "======================"
    echo -e "🔗 Health Check: ${BLUE}$API_GATEWAY_URL/ping${NC}"
    echo -e "🔗 Auth API: ${BLUE}$API_GATEWAY_URL/auth/${NC}"
    echo -e "🔗 Projects API: ${BLUE}$API_GATEWAY_URL/projects/${NC}"
    echo -e "🔗 Requirements API: ${BLUE}$API_GATEWAY_URL/requirements/${NC}"
    echo -e "🔗 LLM API: ${BLUE}$API_GATEWAY_URL/llm/${NC}"
    echo -e "🔗 Waitlist API: ${BLUE}$API_GATEWAY_URL/api/waitlist${NC}"
    echo -e "🔗 Frontend: ${BLUE}$FRONTEND_URL${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Next Steps${NC}"
    echo "=============="
    echo "1. Test the authentication flow"
    echo "2. Verify frontend is working with new backend"
    echo "3. Test the waitlist functionality"
    echo "4. Configure domain name and SSL certificate (optional)"
    echo ""
    print_success "Full deployment completed successfully! 🎉"
fi