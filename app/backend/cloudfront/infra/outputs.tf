# CloudFront Module Outputs

output "s3_bucket_name" {
  description = "Name of the S3 bucket for frontend"
  value       = local.s3_bucket.bucket
}

output "s3_bucket_arn" {
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

output "hosted_zone_id" {
  description = "ID of the Route53 hosted zone"
  value       = local.hosted_zone.zone_id
}

output "name_servers" {
  description = "Name servers for the domain"
  value       = local.hosted_zone.name_servers
} 