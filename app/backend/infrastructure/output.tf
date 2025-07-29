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

# Cognito Module Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.cognito_user_pool_id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = module.cognito.cognito_user_pool_arn
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.cognito.cognito_user_pool_client_id
}

output "cognito_user_pool_domain" {
  description = "Cognito User Pool Domain"
  value       = module.cognito.cognito_user_pool_domain
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
