#!/bin/bash

set -e

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
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -l, --lambda LAMBDA_NAME    Deploy specific lambda (auth, users, llm, or all)"
    echo "  -e, --environment ENV       Environment name (default: prod)"
    echo "  -y, --yes                   Auto-confirm deployment"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                          # Deploy all available lambdas"
    echo "  $0 -l auth                  # Deploy only auth lambda"
    echo "  $0 -l users                 # Deploy only users lambda"
    echo "  $0 -l llm                   # Deploy only llm lambda"
    echo "  $0 -l all                   # Deploy all lambdas"
    echo "  $0 -e dev -l auth           # Deploy auth lambda to dev environment"
    echo ""
}

# Default values
LAMBDA_TO_DEPLOY="all"
ENVIRONMENT="prod"
AUTO_CONFIRM=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--lambda)
            LAMBDA_TO_DEPLOY="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -y|--yes)
            AUTO_CONFIRM=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Validate lambda selection
case $LAMBDA_TO_DEPLOY in
    auth|users|llm|all)
        # Valid selection
        ;;
    *)
        print_error "Invalid lambda selection: $LAMBDA_TO_DEPLOY"
        print_error "Valid options: auth, users, llm, all"
        exit 1
        ;;
esac

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BACKEND_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$BACKEND_ROOT/scripts/infrastructure"

echo -e "${GREEN}🚀 VishMaker AWS Deployment${NC}"
echo -e "${GREEN}=================================${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Lambda: ${LAMBDA_TO_DEPLOY}${NC}"
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

# Step 1: Build Lambda packages
print_status "Building Lambda deployment packages..."
cd "$SCRIPT_DIR"

# Function to build specific lambda
build_lambda() {
    local lambda_name=$1
    print_status "Building $lambda_name lambda..."
    
    # Check if lambda directory exists
    if [ ! -d "$BACKEND_ROOT/lambdas/$lambda_name" ]; then
        print_warning "Lambda directory for $lambda_name not found, skipping..."
        return 0
    fi
    
    # Build the specific lambda
    if ./lambda_zip.sh "$lambda_name"; then
        print_success "$lambda_name lambda built successfully"
        return 0
    else
        print_error "Failed to build $lambda_name lambda"
        return 1
    fi
}

# Build lambdas based on selection
case $LAMBDA_TO_DEPLOY in
    auth)
        if ! build_lambda "auth"; then
            exit 1
        fi
        ;;
    users)
        if ! build_lambda "users"; then
            exit 1
        fi
        ;;
    llm)
        if ! build_lambda "llm"; then
            exit 1
        fi
        ;;
    all)
        # Build all available lambdas
        for lambda in auth users llm; do
            if [ -d "$BACKEND_ROOT/lambdas/$lambda" ]; then
                if ! build_lambda "$lambda"; then
                    exit 1
                fi
            else
                print_warning "Lambda directory for $lambda not found, skipping..."
            fi
        done
        ;;
esac

print_success "Lambda packages built successfully"

# Step 2: Verify deployment packages are ready
print_status "Verifying deployment packages..."

# Function to verify lambda package
verify_lambda_package() {
    local lambda_name=$1
    local package_file="$BACKEND_ROOT/scripts/dist/${lambda_name}-deployment.zip"
    
    if [ -f "$package_file" ]; then
        local size=$(du -h "$package_file" | cut -f1)
        print_success "✓ $lambda_name-deployment.zip ready ($size)"
    else
        print_warning "⚠️ $lambda_name-deployment.zip not found"
    fi
}

# Verify packages based on selection
case $LAMBDA_TO_DEPLOY in
    auth)
        verify_lambda_package "auth"
        ;;
    users)
        verify_lambda_package "users"
        ;;
    llm)
        verify_lambda_package "llm"
        ;;
    all)
        # Verify all available packages
        for lambda in auth users llm; do
            verify_lambda_package "$lambda"
        done
        ;;
esac

print_success "Deployment packages verified"

# Step 3: Initialize Terraform
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

# Step 6: Confirm deployment
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

# Step 7: Apply deployment
print_status "Applying Terraform deployment..."
if ! terraform apply tfplan; then
    print_error "Terraform deployment failed"
    exit 1
fi
print_success "Terraform deployment completed"

# Step 8: Get outputs
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

# Step 10: Display summary
echo ""
print_success "🎉 VishMaker deployment completed successfully!"
echo ""
echo -e "${GREEN}📋 Deployment Summary${NC}"
echo -e "${GREEN}======================${NC}"
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
echo -e "🔗 Auth API: ${BLUE}$API_GATEWAY_URL/api/v1/auth/${NC}"
echo -e "🔗 Projects API: ${BLUE}$API_GATEWAY_URL/api/v1/projects/${NC}"
echo -e "🔗 LLM API: ${BLUE}$API_GATEWAY_URL/api/v1/llm/${NC}"
echo -e "🔗 Frontend: ${BLUE}$FRONTEND_URL${NC}"
echo ""
echo -e "${YELLOW}🔧 Next Steps${NC}"
echo "=============="
echo "1. Update your frontend configuration with the API Gateway URL"
echo "2. Test the authentication flow"
echo "3. Deploy your frontend application"
echo "4. Configure domain name and SSL certificate (optional)"
echo ""
print_success "Deployment completed successfully! 🎉" 