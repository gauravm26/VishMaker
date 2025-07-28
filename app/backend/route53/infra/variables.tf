variable "common_config" {
  description = "Common configuration object containing project_name, environment, aws_region, tags"
  type = object({
    project_name = string
    environment  = string
    aws_region   = string
    name_prefix  = string
    tags         = map(string)
    domain_name  = string
  })
}

variable "api_gateway_endpoint" {
  description = "API Gateway endpoint URL for the CNAME record"
  type        = string
}
