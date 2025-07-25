# infrastructure/terraform/outputs.tf

# Frontend / CDN Outputs
output "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend"
  value       = local.s3_bucket.bucket
}

output "frontend_bucket_arn" {
  description = "ARN of the S3 bucket for frontend"
  value       = local.s3_bucket.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = local.cloudfront_distribution.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = local.cloudfront_distribution.domain_name
}

# Domain Outputs (if domain is configured)
output "hosted_zone_id" {
  description = "ID of the Route53 hosted zone"
  value       = local.hosted_zone.zone_id
}

output "name_servers" {
  description = "Name servers for the domain"
  value       = local.hosted_zone.name_servers
}

# Application URLs
output "api_url" {
  description = "URL for the API Gateway"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "api_domain" {
  description = "Custom domain for the API (CNAME record)"
  value       = "api.${var.domain_name}"
}

output "frontend_url" {
  description = "URL for the frontend"
  value       = "https://${var.domain_name}"
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "region" {
  description = "AWS region"
  value       = var.aws_region
} 