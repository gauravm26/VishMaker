#!/bin/bash

# VishMaker Deployment Script
# This script deploys VishMaker to AWS using Terraform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
AWS_REGION="us-east-1"
SKIP_TERRAFORM=false
SKIP_DOCKER=false
SKIP_FRONTEND=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy VishMaker to AWS using Terraform

Configuration is read from global/config.json (domain, CloudFront ID, etc.)
All other infrastructure settings use sensible defaults.

OPTIONS:
    --skip-terraform     Skip Terraform deployment
    --skip-docker        Skip Docker build and push
    --skip-frontend      Skip frontend deployment
    -h, --help           Show this help message

EXAMPLES:
    $0                           # Full deployment using global/config.json
    $0 --skip-terraform          # Only build and push containers
    $0 --skip-docker             # Only run Terraform (containers must exist)
    $0 --skip-frontend           # Deploy infrastructure and backend only

CONFIGURATION:
    Before running, update global/config.json with:
    - domain_name: Your actual domain
    - cloudfront_distribution_id: Your CloudFront distribution ID
    - project_name, environment, aws_region (optional)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-terraform)
            SKIP_TERRAFORM=true
            shift
            ;;
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Load configuration from global/config.json
load_config() {
    if [[ ! -f "global/config.json" ]]; then
        print_error "Configuration file global/config.json not found"
        print_error "Please ensure you're running from the project root directory"
        exit 1
    fi
    
    # Extract values from config.json using python
    ENVIRONMENT=$(python3 -c "import json; print(json.load(open('global/config.json'))['infrastructure']['environment'])" 2>/dev/null || echo "dev")
    AWS_REGION=$(python3 -c "import json; print(json.load(open('global/config.json'))['infrastructure']['aws_region'])" 2>/dev/null || echo "us-east-1")
    PROJECT_NAME=$(python3 -c "import json; print(json.load(open('global/config.json'))['infrastructure']['project_name'])" 2>/dev/null || echo "vishmaker")
    DOMAIN_NAME=$(python3 -c "import json; print(json.load(open('global/config.json'))['infrastructure']['domain_name'])" 2>/dev/null || echo "")
}

# Load configuration first
load_config

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment in config.json: $ENVIRONMENT. Must be dev, staging, or prod."
    exit 1
fi

print_status "Starting VishMaker deployment"
print_status "Project: $PROJECT_NAME"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $AWS_REGION"
print_status "Domain: $DOMAIN_NAME"
print_status "Configuration source: global/config.json"

# Check required tools
check_dependencies() {
    print_status "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v aws &> /dev/null; then
        missing_deps+=("aws-cli")
    fi
    
    if ! command -v terraform &> /dev/null; then
        missing_deps+=("terraform")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_error "Please install missing dependencies and try again."
        exit 1
    fi
    
    print_success "All dependencies found"
}

# Check AWS credentials
check_aws_credentials() {
    print_status "Checking AWS credentials..."
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid"
        print_error "Please run 'aws configure' or set AWS environment variables"
        exit 1
    fi
    
    local aws_account=$(aws sts get-caller-identity --query Account --output text)
    local aws_user=$(aws sts get-caller-identity --query Arn --output text)
    
    print_success "AWS credentials valid"
    print_status "Account: $aws_account"
    print_status "User/Role: $aws_user"
}

# Initialize Terraform
init_terraform() {
    print_status "Initializing Terraform..."
    
    cd infrastructure/terraform
    
    # Generate terraform.tfvars from global/config.json
    print_status "Generating terraform.tfvars from global/config.json..."
    python3 generate_tfvars.py
    if [[ $? -ne 0 ]]; then
        print_error "Failed to generate terraform.tfvars from config.json"
        print_error "Please check your global/config.json file"
        cd - > /dev/null
        exit 1
    fi
    
    terraform init
    
    print_success "Terraform initialized with config from global/config.json"
    cd - > /dev/null
}

# Deploy infrastructure
deploy_infrastructure() {
    print_status "Deploying infrastructure with Terraform..."
    
    cd infrastructure/terraform
    
    # Show current configuration
    print_status "Using configuration from terraform.tfvars (generated from global/config.json)"
    
    # Plan the deployment
    terraform plan -out=tfplan
    
    # Ask for confirmation
    echo
    read -p "Do you want to apply these changes? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled by user"
        rm -f tfplan
        cd - > /dev/null
        exit 0
    fi
    
    # Apply the plan
    terraform apply tfplan
    
    # Clean up plan file
    rm -f tfplan
    
    print_success "Infrastructure deployed successfully"
    cd - > /dev/null
}

# Build and push Docker image
build_and_push_docker() {
    print_status "Building and pushing Docker image..."
    
    # Get ECR repository URL from Terraform output
    cd infrastructure/terraform
    local ecr_repo=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "")
    cd - > /dev/null
    
    if [ -z "$ecr_repo" ]; then
        print_error "Could not get ECR repository URL from Terraform output"
        print_error "Make sure Terraform has been applied successfully"
        exit 1
    fi
    
    print_status "ECR Repository: $ecr_repo"
    
    # Login to ECR
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ecr_repo"
    
    # Build the image
    print_status "Building Docker image..."
    docker build -t vishmaker-backend .
    
    # Tag the image
    docker tag vishmaker-backend:latest "$ecr_repo:latest"
    docker tag vishmaker-backend:latest "$ecr_repo:$(date +%Y%m%d-%H%M%S)"
    
    # Push the image
    print_status "Pushing Docker image to ECR..."
    docker push "$ecr_repo:latest"
    docker push "$ecr_repo:$(date +%Y%m%d-%H%M%S)"
    
    print_success "Docker image pushed successfully"
}

# Build and deploy frontend
deploy_frontend() {
    print_status "Building and deploying frontend..."
    
    cd app-ui
    
    # Install dependencies
    print_status "Installing frontend dependencies..."
    npm install
    
    # Get backend URL from Terraform output
    cd ../infrastructure/terraform
    local api_url=$(terraform output -raw api_url 2>/dev/null || echo "")
    cd - > /dev/null
    
    if [ -z "$api_url" ]; then
        print_error "Could not get API URL from Terraform output"
        exit 1
    fi
    
    # Create environment file
    cat > .env.production << EOF
VITE_API_URL=$api_url
VITE_ENVIRONMENT=$ENVIRONMENT
EOF
    
    print_status "Backend URL: $api_url"
    
    # Build the frontend
    print_status "Building frontend..."
    npm run build
    
    # Get S3 bucket name from Terraform output
    cd ../infrastructure/terraform
    local s3_bucket=$(terraform output -raw frontend_bucket_name 2>/dev/null || echo "")
    local cloudfront_id=$(terraform output -raw cloudfront_distribution_id 2>/dev/null || echo "")
    cd - > /dev/null
    
    if [ -z "$s3_bucket" ]; then
        print_error "Could not get S3 bucket name from Terraform output"
        exit 1
    fi
    
    # Upload to S3
    print_status "Uploading frontend to S3 bucket: $s3_bucket"
    aws s3 sync dist/ "s3://$s3_bucket" --delete
    
    # Invalidate CloudFront cache
    if [ -n "$cloudfront_id" ]; then
        print_status "Invalidating CloudFront cache..."
        aws cloudfront create-invalidation --distribution-id "$cloudfront_id" --paths "/*"
    fi
    
    cd - > /dev/null
    
    print_success "Frontend deployed successfully"
}

# Update ECS service to use new image
update_ecs_service() {
    print_status "Updating ECS service..."
    
    cd infrastructure/terraform
    local cluster_name=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "")
    cd - > /dev/null
    
    if [ -z "$cluster_name" ]; then
        print_error "Could not get ECS cluster name from Terraform output"
        exit 1
    fi
    
    # Force new deployment
    aws ecs update-service \
        --cluster "$cluster_name" \
        --service "vishmaker-$ENVIRONMENT-backend-service" \
        --force-new-deployment \
        --region "$AWS_REGION"
    
    print_success "ECS service updated"
}

# Display deployment information
show_deployment_info() {
    print_success "Deployment completed successfully!"
    echo
    print_status "Deployment Information:"
    echo "======================="
    
    cd infrastructure/terraform
    
    echo "Environment: $ENVIRONMENT"
    echo "Region: $AWS_REGION"
    echo
    
    local frontend_url=$(terraform output -raw frontend_url 2>/dev/null || echo "Not available")
    local api_url=$(terraform output -raw api_url 2>/dev/null || echo "Not available")
    
    echo "Frontend URL: $frontend_url"
    echo "API URL: $api_url"
    echo
    
    if [ "$ENVIRONMENT" = "prod" ]; then
        print_warning "This is a PRODUCTION deployment!"
    fi
    
    cd - > /dev/null
}

# Main deployment flow
main() {
    check_dependencies
    check_aws_credentials
    
    if [ "$SKIP_TERRAFORM" = false ]; then
        init_terraform
        deploy_infrastructure
    fi
    
    if [ "$SKIP_DOCKER" = false ]; then
        build_and_push_docker
        update_ecs_service
    fi
    
    if [ "$SKIP_FRONTEND" = false ]; then
        deploy_frontend
    fi
    
    show_deployment_info
}

# Run main function
main "$@" 