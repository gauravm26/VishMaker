# infrastructure/terraform/frontend.tf

# Data source to get CloudFront distribution details using the provided ID
data "aws_cloudfront_distribution" "existing" {
  id = var.cloudfront_distribution_id
}

# Data source to get the S3 bucket from the CloudFront distribution's origin
data "aws_s3_bucket" "existing" {
  bucket = var.domain_name
}

# Data source to find existing hosted zone by domain name
data "aws_route53_zone" "existing" {
  name = var.domain_name
}

# Locals for easy reference to the existing resources
locals {
  cloudfront_distribution = data.aws_cloudfront_distribution.existing
  s3_bucket                 = data.aws_s3_bucket.existing
  hosted_zone               = data.aws_route53_zone.existing
} 