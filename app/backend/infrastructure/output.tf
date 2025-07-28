# ==================================================
# SHARED OUTPUTS - Available to all AWS services
# ==================================================

# Project Information
output "project_name" {
  description = "Name of the project"
  value       = var.project_name
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

# VPC and Networking
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "nat_gateway_id" {
  description = "ID of the NAT Gateway"
  value       = aws_nat_gateway.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "database_subnet_ids" {
  description = "List of database subnet IDs"
  value       = aws_subnet.database[*].id
}

# Security Groups
output "lambda_security_group_id" {
  description = "Security group ID for Lambda functions"
  value       = aws_security_group.lambda.id
}

output "database_security_group_id" {
  description = "Security group ID for database"
  value       = aws_security_group.database.id
}

# S3 Configuration Bucket
output "config_bucket_name" {
  description = "Name of the S3 configuration bucket"
  value       = aws_s3_bucket.configs.id
}

output "config_bucket_arn" {
  description = "ARN of the S3 configuration bucket"
  value       = aws_s3_bucket.configs.arn
}

output "config_bucket_domain_name" {
  description = "Domain name of the S3 configuration bucket"
  value       = aws_s3_bucket.configs.bucket_domain_name
}

output "config_object_key" {
  description = "S3 key for the configuration file"
  value       = aws_s3_object.app_config.key
}

# Secrets Manager
output "llm_secret_arn" {
  description = "ARN of the LLM API keys secret"
  value       = aws_secretsmanager_secret.llm_api_keys.arn
}

output "llm_secret_name" {
  description = "Name of the LLM API keys secret"
  value       = aws_secretsmanager_secret.llm_api_keys.name
}

# Cognito Module Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = module.cognito.user_pool_arn
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.cognito.user_pool_client_id
}

output "cognito_user_pool_domain" {
  description = "Cognito User Pool Domain"
  value       = module.cognito.user_pool_domain
}

# RDS Module Outputs
output "db_instance_endpoint" {
  description = "Database instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "db_instance_arn" {
  description = "Database instance ARN"
  value       = module.rds.db_instance_arn
}

output "db_instance_id" {
  description = "Database instance ID"
  value       = module.rds.db_instance_id
}

output "db_secret_arn" {
  description = "Database credentials secret ARN"
  value       = module.rds.db_secret_arn
}

output "database_name" {
  description = "Database name"
  value       = module.rds.db_name
}

output "database_username" {
  description = "Database username"
  value       = module.rds.db_username
}

# Lambda Module Outputs
output "project_api_function_name" {
  description = "Project API Lambda function name"
  value       = module.project_api_lambda.lambda_function_name
}

output "project_api_function_arn" {
  description = "Project API Lambda function ARN"
  value       = module.project_api_lambda.lambda_function_arn
}

output "project_api_invoke_arn" {
  description = "Project API Lambda invoke ARN"
  value       = module.project_api_lambda.lambda_invoke_arn
}

output "llm_api_function_name" {
  description = "LLM API Lambda function name"
  value       = module.llm_api_lambda.lambda_function_name
}

output "llm_api_function_arn" {
  description = "LLM API Lambda function ARN"
  value       = module.llm_api_lambda.lambda_function_arn
}

output "llm_api_invoke_arn" {
  description = "LLM API Lambda invoke ARN"
  value       = module.llm_api_lambda.lambda_invoke_arn
}

# API Gateway Module Outputs
output "api_gateway_id" {
  description = "API Gateway ID"
  value       = module.api_gateway.api_gateway_id
}

output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  value       = module.api_gateway.api_gateway_endpoint
}

output "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  value       = module.api_gateway.api_gateway_execution_arn
}

# Resource Names (useful for other services)
output "resource_name_prefix" {
  description = "Standard resource name prefix"
  value       = "${var.project_name}-${var.environment}"
}

# Common Tags
output "common_tags" {
  description = "Common tags applied to all resources"
  value       = local.common_config.tags
}

# ==================================================
# FRONTEND AND DOMAIN OUTPUTS
# ==================================================

# Frontend / CDN Outputs
output "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend"
  value       = module.cloudfront.s3_bucket_name
}

output "frontend_bucket_arn" {
  description = "ARN of the S3 bucket for frontend"
  value       = module.cloudfront.s3_bucket_arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = module.cloudfront.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = module.cloudfront.cloudfront_domain_name
}

# Domain Outputs
output "hosted_zone_id" {
  description = "ID of the Route53 hosted zone"
  value       = module.cloudfront.hosted_zone_id
}

output "name_servers" {
  description = "Name servers for the domain"
  value       = module.cloudfront.name_servers
}

# Application URLs
output "api_domain" {
  description = "Custom domain for the API (CNAME record)"
  value       = "api.${var.domain_name}"
}

output "frontend_url" {
  description = "URL for the frontend"
  value       = "https://${var.domain_name}"
}
