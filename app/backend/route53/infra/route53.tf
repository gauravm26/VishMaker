# Data source for the hosted zone
data "aws_route53_zone" "main" {
  name = var.common_config.domain_name
}

locals {
  hosted_zone = data.aws_route53_zone.main
}

# Route53 record for API - points to the API Gateway (using default domain for now)
resource "aws_route53_record" "api" {
  zone_id = local.hosted_zone.zone_id
  name    = "api.${var.common_config.domain_name}"
  type    = "CNAME"
  ttl     = "300"
  records = [var.api_gateway_endpoint]
} 