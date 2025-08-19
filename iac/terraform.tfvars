# ==================================================
# VishMaker Terraform Configuration Example
# ==================================================
# Copy this file to terraform.tfvars and update with your values

# Basic Configuration
project_name = "vishmaker"
environment  = "prod"
aws_region   = "us-east-1"

# Domain Configuration
domain_name = "vishmaker.com"
cloudfront_distribution_id = "E27ZJ7GYC7E0HU"  # Your CloudFront Distribution ID

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# Database Configuration
db_name = "vishmaker"
db_username = "vishmaker_user"
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_max_allocated_storage = 100
backup_retention_period = 7
deletion_protection = true

# Lambda Configuration
lambda_runtime = "python3.9"
project_api_timeout = 60
project_api_memory = 512
llm_api_timeout = 300
llm_api_memory = 1024

# Lambda Deployment Package Paths (will be set by build script)
project_api_zip_path = "auth-deployment.zip"  # Will be copied by deploy script
llm_api_zip_path = "llm-deployment.zip"       # Will be copied by deploy script

# S3 Configuration
config_bucket_prefix = "vishmaker-configs"
s3_force_destroy = true

# Logging and Monitoring
log_retention_days = 30
enable_enhanced_monitoring = true
encrypt_storage = true

# Common Tags
common_tags = {
  Project     = "vishmaker"
  Environment = "prod"
  ManagedBy   = "Terraform"
  Owner       = "VishMaker Team"
} 