# ==================================================
# SHARED VARIABLES - Used across all AWS services
# ==================================================

# Project Configuration
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "vishmaker"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application (e.g., 'vishmaker.com')"
  type        = string
  default     = "vishmaker.com"
}

variable "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID for the existing domain setup"
  type        = string
  default     = ""
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

# Database Configuration
variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "vishmaker"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "vishmaker_user"
}

variable "db_instance_class" {
  description = "Database instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Database allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Database maximum allocated storage in GB"
  type        = number
  default     = 100
}

variable "backup_retention_period" {
  description = "Database backup retention period in days"
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = true
}

# Lambda Configuration
variable "lambda_runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "python3.9"
}

variable "project_api_timeout" {
  description = "Timeout for Project API Lambda in seconds"
  type        = number
  default     = 60
}

variable "project_api_memory" {
  description = "Memory allocation for Project API Lambda in MB"
  type        = number
  default     = 512
}

variable "llm_api_timeout" {
  description = "Timeout for LLM API Lambda in seconds"
  type        = number
  default     = 300
}

variable "llm_api_memory" {
  description = "Memory allocation for LLM API Lambda in MB"
  type        = number
  default     = 1024
}

# Build Configuration
variable "project_api_zip_path" {
  description = "Path to Project API Lambda deployment ZIP"
  type        = string
  default     = "./project_api-deployment.zip"
}

variable "llm_api_zip_path" {
  description = "Path to LLM API Lambda deployment ZIP"
  type        = string
  default     = "./llm_api-deployment.zip"
}

# S3 Configuration
variable "config_bucket_prefix" {
  description = "Prefix for S3 configuration bucket name"
  type        = string
  default     = "vishmaker-configs"
}

variable "s3_force_destroy" {
  description = "Force destroy S3 buckets on terraform destroy"
  type        = bool
  default     = true
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 14
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring for RDS"
  type        = bool
  default     = true
}

# Security Configuration
variable "encrypt_storage" {
  description = "Enable encryption for storage resources"
  type        = bool
  default     = true
}

# Common Tags
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "VishMaker"
    Environment = "prod"
    ManagedBy   = "Terraform"
  }
}
