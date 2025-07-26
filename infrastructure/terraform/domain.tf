# infrastructure/terraform/domain.tf

# Route53 record for API - points to the API Gateway (using default domain for now)
resource "aws_route53_record" "api" {
  zone_id = local.hosted_zone.zone_id
  name    = "api.${var.domain_name}"
  type    = "CNAME"
  ttl     = "300"
  records = [aws_apigatewayv2_api.main.api_endpoint]
} 