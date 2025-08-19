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

# Cognito Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = local.cognito_user_pool_id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = local.cognito_user_pool_arn
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = local.cognito_user_pool_client_id
}

output "cognito_user_pool_domain" {
  description = "Cognito User Pool Domain"
  value       = local.cognito_user_pool_domain
}
 
# API Gateway Outputs
output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.main.id
}

output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL (through CloudFront)"
  value       = "https://iu5eco6xl1.execute-api.us-east-1.amazonaws.com/api"
}

output "api_gateway_execution_arn" {
  description = "API Gateway execution ARN"
  value       = aws_apigatewayv2_api.main.execution_arn
}

output "flattened_routes" {
  value = local.flattened_routes
}

output "api_routes" {
  value = local.api_routes
}


# LLM Lambda Outputs
output "llm_lambda_function_name" {
  description = "Name of the LLM Lambda function"
  value       = aws_lambda_function.lambda_functions["llm_api"].function_name
}

output "llm_lambda_function_arn" {
  description = "ARN of the LLM Lambda function"
  value       = aws_lambda_function.lambda_functions["llm_api"].arn
}

output "llm_lambda_function_invoke_arn" {
  description = "Invoke ARN of the LLM Lambda function"
  value       = aws_lambda_function.lambda_functions["llm_api"].invoke_arn
}

# Auth Lambda Outputs
output "auth_lambda_function_name" {
  description = "Name of the Auth Lambda function"
  value       = aws_lambda_function.lambda_functions["auth_api"].function_name
}

output "auth_lambda_function_arn" {
  description = "ARN of the Auth Lambda function"
  value       = aws_lambda_function.lambda_functions["auth_api"].arn
}

output "auth_lambda_function_invoke_arn" {
  description = "Invoke ARN of the Auth Lambda function"
  value       = aws_lambda_function.lambda_functions["auth_api"].invoke_arn
}


# Resource Names (useful for other services)
output "resource_name_prefix" {
  description = "Standard resource name prefix"
  value       = "${var.project_name}-${var.environment}"
}

# Common Tags
output "common_tags" {
  description = "Common tags applied to all resources"
  value       = local.common_tags
}

# ==================================================
# FRONTEND AND DOMAIN OUTPUTS
# ==================================================

# Frontend / CDN Outputs
output "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend"
  value       = var.domain_name
}

output "frontend_bucket_arn" {
  description = "ARN of the S3 bucket for frontend"
  value       = "arn:aws:s3:::${var.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = "vishmaker.com"  # Your domain name
}

# Domain Outputs
output "hosted_zone_id" {
  description = "ID of the Route53 hosted zone"
  value       = data.aws_route53_zone.main.zone_id
}

output "name_servers" {
  description = "Name servers for the domain"
  value       = data.aws_route53_zone.main.name_servers
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

# ==================================================
# COMPREHENSIVE INFRASTRUCTURE OUTPUTS
# ==================================================

output "s3_bucket_name" {
  description = "The name of the S3 bucket hosting the website"
  value       = length(aws_s3_bucket.main) > 0 ? aws_s3_bucket.main[0].bucket : null
}

output "website_url" {
  description = "The URL of the hosted website"
  value       = "https://${var.domain_name}"
}

output "resource_prefix" {
  description = "The resource naming prefix used"
  value       = local.name_prefix
}

output "alb_dns_name" {
  description = "The DNS name of the Application Load Balancer"
  value       = aws_lb.api_alb.dns_name
}

output "alb_security_group_id" {
  description = "The ID of the ALB security group"
  value       = aws_security_group.alb_sg.id
}

output "api_gateway_url" {
  description = "The URL of the API Gateway"
  value       = "https://www.${var.domain_name}/api"
}

output "lambda_function_names" {
  description = "Names of all Lambda functions"
  value       = [for func in aws_lambda_function.lambda_functions : func.function_name]
}

output "dynamodb_table_names" {
  description = "Names of all DynamoDB tables"
  value       = [for func in aws_dynamodb_table.tables : func.name]
}

