# Variables for LLM Lambda Infrastructure

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Lambda Configuration
variable "lambda_runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "python3.9"
}

variable "lambda_timeout_seconds" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 300  # 5 minutes for LLM operations
}

variable "lambda_memory_mb" {
  description = "Lambda memory in MB"
  type        = number
  default     = 1024  # Higher memory for AI/ML operations
}

variable "lambda_environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

# VPC Configuration (optional)
variable "vpc_subnet_ids" {
  description = "VPC subnet IDs for Lambda function"
  type        = list(string)
  default     = []
}

variable "vpc_security_group_ids" {
  description = "VPC security group IDs for Lambda function"
  type        = list(string)
  default     = []
}

# RDS Integration
variable "rds_secret_arn" {
  description = "RDS secret ARN for database connection"
  type        = string
  default     = ""
}

# LLM Integration
variable "llm_secret_arn" {
  description = "LLM API keys secret ARN"
  type        = string
  default     = ""
}

# API Gateway Integration
variable "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  type        = string
} 