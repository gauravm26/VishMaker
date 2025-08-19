# ==================================================
# MAIN INFRASTRUCTURE - Orchestrates all AWS services
# ==================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }
  backend "s3" {
    bucket         = "vish-terraform"
    key            = "vishmaker/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "vishmaker-terraform-locks"
  }
}

# ==================================================
# VISHMAKER COMPREHENSIVE INFRASTRUCTURE
# ==================================================

# AWS Providers
provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "acm_provider"
  region = "us-east-1" # CloudFront requires us-east-1 for certificates
}

# ==================================================
# LOCALS & COMMON CONFIGURATION
# ==================================================

locals {
  name_prefix = "${var.development_environment}-${var.project_name}"
  common_tags = merge(var.tags, {
    Name        = local.name_prefix
    Environment = var.development_environment
    Project     = var.project_name
  })

  # Common configuration from existing setup
  common_config = jsondecode(file("${path.module}/../app/backend/config/config.json"))


}

# ==================================================
# DATA SOURCES
# ==================================================

# Configuration file path
locals {
  config_file_path = "${path.module}/../app/backend/config/config.json"
}

# Route53 zones
data "aws_route53_zone" "main" {
  name = var.domain_name
}

# VPC and networking
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# CloudFront policies
data "aws_cloudfront_cache_policy" "Managed_Optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "Managed-CachingDisabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "Managed-AllViewer" {
  name = "Managed-AllViewer"
}


# ==================================================
# ACM CERTIFICATES
# ==================================================

# Main certificate for the domain
resource "aws_acm_certificate" "main" {
  provider                  = aws.acm_provider
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-certificate"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway certificate
resource "aws_acm_certificate" "api" {
  provider          = aws.acm_provider
  domain_name       = "api.${var.domain_name}"
  validation_method = "DNS"
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-api-certificate"
  })
}

# Certificate validation records
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

# Certificate validations
resource "aws_acm_certificate_validation" "main" {
  provider                = aws.acm_provider
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

resource "aws_acm_certificate_validation" "api" {
  provider                = aws.acm_provider
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]
}

# ==================================================
# S3 CONFIGURATION BUCKET
# ==================================================

# S3 bucket for configuration files
resource "aws_s3_bucket" "configs" {
  bucket        = "${var.config_bucket_prefix}-${var.environment}-${random_string.bucket_suffix.result}"
  force_destroy = var.s3_force_destroy

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-config-bucket"
  })
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_s3_bucket_ownership_controls" "configs" {
  bucket = aws_s3_bucket.configs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "configs" {
  bucket = aws_s3_bucket.configs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "configs" {
  bucket = aws_s3_bucket.configs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Upload configuration file to S3
resource "aws_s3_object" "app_config" {
  bucket = aws_s3_bucket.configs.id
  key    = "config.json"
  source = "${path.module}/../app/backend/config/config.json"
  etag   = filemd5("${path.module}/../app/backend/config/config.json")
  tags   = local.common_tags
}

# ==================================================
# S3 & STORAGE
# ==================================================

# S3 bucket for website hosting (conditional)
resource "aws_s3_bucket" "main" {
  count  = var.deployment_type == "migrate" ? 1 : 0
  bucket = var.domain_name
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-website-bucket"
  })
}

# Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "${local.name_prefix}-s3-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"

  lifecycle {
    create_before_destroy = true
  }
}

# S3 bucket policy
resource "aws_s3_bucket_policy" "main" {
  count  = var.deployment_type == "migrate" ? 1 : 0
  bucket = aws_s3_bucket.main[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.main[0].arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.main.arn } }
    }]
  })
}

# ==================================================
# APPLICATION LOAD BALANCER
# ==================================================

# Security group for ALB
resource "aws_security_group" "alb_sg" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Allow HTTPS traffic to ALB"
  vpc_id      = data.aws_vpc.default.id
  tags        = merge(local.common_tags, { Name = "${local.name_prefix}-alb-sg" })

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ALB for API/WebSocket
resource "aws_lb" "api_alb" {
  name               = "${local.name_prefix}-api-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = data.aws_subnets.default.ids
  tags               = merge(local.common_tags, { Name = "${local.name_prefix}-api-alb" })
}

# Target group for API
resource "aws_lb_target_group" "api_tg" {
  name        = "${local.name_prefix}-api-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "instance"
  tags        = merge(local.common_tags, { Name = "${local.name_prefix}-api-tg" })

  health_check {
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
  }
}

# ALB listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api_alb.arn
  port              = "443"
  protocol          = "HTTPS"

  ssl_policy      = "ELBSecurityPolicy-2016-08"
  certificate_arn = aws_acm_certificate_validation.api.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_tg.arn
  }
}

# Target group attachment
resource "aws_lb_target_group_attachment" "api_attachment" {
  target_group_arn = aws_lb_target_group.api_tg.arn
  target_id        = "i-0bfbb3ab79c2f1c78" # Your EC2 instance ID
  port             = 8000
}

# ==================================================
# API GATEWAY
# ==================================================

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  description   = "VishMaker API Gateway"

  cors_configuration {
    allow_origins = [
      "https://${var.domain_name}",
      "https://api.${var.domain_name}"
    ]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["*"]
    allow_credentials = true
  }
  tags = local.api_gateway.tags
}

# API Gateway stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = "api.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.api.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
  tags = local.common_tags
}

resource "aws_apigatewayv2_api_mapping" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.main.id
}

# API Gateway Authorizer
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.name_prefix}-cognito-authorizer"

  jwt_configuration {
    audience = [local.cognito_user_pool_client_id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${local.cognito_user_pool_id}"
  }
}

locals {
  api_gateway = {
    name         = "${local.name_prefix}-api"
    cors_origins = ["https://vishmaker.com"]
    tags         = local.common_tags
  }
  api_routes = {
    auth_api = {
      routes = [
        {
          path    = ["/api/auth/signin", "/api/auth/signup", "/api/auth/confirm-signup", "/api/auth/forgot-password", "/api/auth/confirm-forgot-password"]
          methods = ["POST"]
          auth    = "NONE"
        },
        {
          path    = ["/api/auth/me", "/api/auth/signout", "/api/auth/refresh-token"]
          methods = ["GET", "POST"]
          auth    = "JWT"
        }
      ]
      lambda_arn    = aws_lambda_function.lambda_functions["auth_api"].invoke_arn
      function_name = aws_lambda_function.lambda_functions["auth_api"].function_name
    }
    projects_api = {
      routes = [
        {
          path    = ["/api/projects", "/api/projects/{proxy+}"]
          methods = ["GET", "POST", "PUT", "DELETE"]
          auth    = "JWT"
        }
      ]
      lambda_arn    = aws_lambda_function.lambda_functions["projects_api"].invoke_arn
      function_name = aws_lambda_function.lambda_functions["projects_api"].function_name
    }
    requirements_api = {
      routes = [
        {
          path    = ["/api/requirements", "/api/requirements/{proxy+}"]
          methods = ["GET", "POST", "PUT", "DELETE"]
          auth    = "JWT"
        }
      ]
      lambda_arn    = aws_lambda_function.lambda_functions["requirements_api"].invoke_arn
      function_name = aws_lambda_function.lambda_functions["requirements_api"].function_name
    }
    llm_api = {
      routes = [
        {
          path    = ["/api/llm/process"]
          methods = ["POST"]
          auth    = "JWT"
        }
      ]
      lambda_arn    = aws_lambda_function.lambda_functions["llm_api"].invoke_arn
      function_name = aws_lambda_function.lambda_functions["llm_api"].function_name
    }
  }
  flattened_routes = {
    for route in flatten([
      for integration_key, api in local.api_routes : [
        for route in api.routes : [
          for path in route.path : [
            for method in route.methods : {
              key = "${integration_key}-${method}-${replace(replace(path, "/", "_"), "{", "_")}"
              value = {
                route_key       = "${method} ${path}"
                integration_key = integration_key
                auth_type       = route.auth
                lambda_arn      = api.lambda_arn
              }
            }
          ]
        ]
      ]
    ]) : route.key => route.value
  }
}

# API Gateway Routes
resource "aws_apigatewayv2_route" "routes" {
  for_each = local.flattened_routes

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = each.value.route_key
  target             = "integrations/${aws_apigatewayv2_integration.api[each.value.integration_key].id}"
  authorization_type = each.value.auth_type
  authorizer_id      = each.value.auth_type == "JWT" ? aws_apigatewayv2_authorizer.cognito.id : null
}

# API Gateway Integrations
resource "aws_apigatewayv2_integration" "api" {
  for_each = {
    for key, value in local.api_routes :
    key => value.lambda_arn
  }

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "apigw_permissions" {
  for_each = local.lambdas

  statement_id  = "AllowAPIGatewayInvoke_${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_functions[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ==================================================
# COGNITO USER POOL
# ==================================================

locals {
  cognito_user_pool_id        = "us-east-1_Hf4Ps4b4j"
  cognito_user_pool_arn       = "arn:aws:cognito-idp:us-east-1:489270312286:userpool/us-east-1_Hf4Ps4b4j"
  cognito_user_pool_client_id = "6vtj80n9u3916hnlpnpbi7r2v9"
  cognito_user_pool_domain    = "auth-vishmaker.auth.us-east-1.amazoncognito.com"
}

# ==================================================
# LAMBDA FUNCTIONS
# ==================================================

# Lambda configuration object
locals {
  lambda_configs = {
    timeout            = 60
    memory_size        = 512
    architectures      = ["x86_64"]
    layers             = []
    runtime            = "python3.11"
    common_tags        = var.common_tags
    handler            = "main.handler"
    root_path          = "${path.module}/../scripts/dist"
    log_retention_days = 1
  }
  common_dynamodb_env_vars = {
    PROJECTS_TABLE_NAME                = aws_dynamodb_table.tables["projects"].name,
    USER_FLOWS_TABLE_NAME              = aws_dynamodb_table.tables["user-flows"].name,
    HIGH_LEVEL_REQUIREMENTS_TABLE_NAME = aws_dynamodb_table.tables["high-level-requirements"].name,
    LOW_LEVEL_REQUIREMENTS_TABLE_NAME  = aws_dynamodb_table.tables["low-level-requirements"].name,
    TEST_CASES_TABLE_NAME              = aws_dynamodb_table.tables["test-cases"].name
  }
  lambdas = {
    auth_api = {
      lambda_name = "auth"
      environment_variables = merge(local.common_dynamodb_env_vars, {
        CONFIG_BUCKET        = aws_s3_bucket.configs.id
        CONFIG_KEY           = "config.json"
        ENVIRONMENT          = var.environment
        PROJECT_NAME         = var.project_name
        COGNITO_USER_POOL_ID = local.cognito_user_pool_id
        COGNITO_CLIENT_ID    = local.cognito_user_pool_client_id
      })
      dynamo_access_all = false
    }
    llm_api = {
      lambda_name = "llm"
      environment_variables = merge(local.common_dynamodb_env_vars, {
        CONFIG_BUCKET = aws_s3_bucket.configs.id
        CONFIG_KEY    = "config.json"
        ENVIRONMENT   = var.environment
        PROJECT_NAME  = var.project_name
      })
      dynamo_access_all = true
      timeout           = var.lambda_timeout_seconds
      memory_size       = var.lambda_memory_mb
    }
    projects_api = {
      lambda_name           = "projects"
      environment_variables = local.common_dynamodb_env_vars
      dynamo_access_all     = true
    }
    requirements_api = {
      lambda_name           = "requirements"
      environment_variables = local.common_dynamodb_env_vars
      dynamo_access_all     = true
    }
  }
}

# Lambda functions
resource "aws_lambda_function" "lambda_functions" {
  for_each = local.lambdas

  filename      = "${local.lambda_configs.root_path}/${each.value.lambda_name}-deployment.zip"
  function_name = "${local.name_prefix}-${each.value.lambda_name}"
  role          = aws_iam_role.lambda_role[each.key].arn
  handler       = local.lambda_configs.handler
  runtime       = local.lambda_configs.runtime
  timeout       = local.lambda_configs.timeout
  memory_size   = local.lambda_configs.memory_size

  environment {
    variables = each.value.environment_variables
  }

  tags = local.common_tags
}

# ==================================================
# DYNAMODB TABLES
# ==================================================

locals {
  dynamodb_common = {
    billing_mode = "PAY_PER_REQUEST"
    common_tags  = var.common_tags
  }
  dynamodb_tables = {
    projects = {
      table_name = "${local.name_prefix}-projects"
      hash_key   = "id"
      range_key  = "user_id"
      attributes = [
        { name = "id", type = "S" },
        { name = "user_id", type = "S" },
        { name = "name", type = "S" }
      ]
      global_secondary_indexes = [
        {
          name            = "user_id-index"
          hash_key        = "user_id"
          projection_type = "ALL"
        },
        {
          name            = "name-index"
          hash_key        = "name"
          projection_type = "ALL"
        }
      ]
    }
    "user-flows" = {
      table_name = "${local.name_prefix}-user-flows"
      hash_key   = "uiid"
      range_key  = "project_id"
      attributes = [
        { name = "uiid", type = "S" },
        { name = "project_id", type = "S" }
      ]
      global_secondary_indexes = [
        {
          name            = "project_id-index"
          hash_key        = "project_id"
          projection_type = "ALL"
        }
      ]
    }
    "high-level-requirements" = {
      table_name = "${local.name_prefix}-high-level-requirements"
      hash_key   = "uiid"
      range_key  = "parent_uiid"
      attributes = [
        { name = "uiid", type = "S" },
        { name = "project_id", type = "S" },
        { name = "parent_uiid", type = "S" }
      ]
      global_secondary_indexes = [
        {
          name            = "project_id-index"
          hash_key        = "project_id"
          projection_type = "ALL"
        }
      ]
    }

    "low-level-requirements" = {
      table_name = "${local.name_prefix}-low-level-requirements"
      hash_key   = "uiid"
      range_key  = "parent_uiid"
      attributes = [
        { name = "uiid", type = "S" },
        { name = "project_id", type = "S" },
        { name = "parent_uiid", type = "S" }
      ]
      global_secondary_indexes = [
        {
          name            = "project_id-index"
          hash_key        = "project_id"
          projection_type = "ALL"
        }
      ]
    }
    "test-cases" = {
      table_name = "${local.name_prefix}-test-cases"
      hash_key   = "uiid"
      range_key  = "parent_uiid"
      attributes = [
        { name = "uiid", type = "S" },
        { name = "project_id", type = "S" },
        { name = "parent_uiid", type = "S" }
      ]
      global_secondary_indexes = [
        {
          name            = "project_id-index"
          hash_key        = "project_id"
          projection_type = "ALL"
        }
      ]
    }
    waitlist = {
      table_name = "${local.name_prefix}-waitlist"
      hash_key   = "email"
      range_key  = null
      attributes = [
        { name = "email", type = "S" },
        { name = "status", type = "S" }
      ]
      global_secondary_indexes = [
        {
          name            = "status-index"
          hash_key        = "status"
          projection_type = "ALL"
        }
      ]
    }
  }
  all_dynamodb_table_arns = [
    for table in aws_dynamodb_table.tables :
    table.arn
  ]
  all_dynamodb_index_arns = [
    for table in aws_dynamodb_table.tables :
    "${table.arn}/index/*"
  ]
}

# DynamoDB tables
resource "aws_dynamodb_table" "tables" {
  for_each = local.dynamodb_tables

  name         = each.value.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = each.value.hash_key
  range_key    = each.value.range_key

  attribute {
    name = each.value.hash_key
    type = "S"
  }

  dynamic "attribute" {
    for_each = each.value.range_key != null ? [each.value.range_key] : []
    content {
      name = attribute.value
      type = "S"
    }
  }

  # Add additional attributes for GSI
  dynamic "attribute" {
    for_each = each.value.attributes != null ? each.value.attributes : []
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  # Add global secondary indexes
  dynamic "global_secondary_index" {
    for_each = each.value.global_secondary_indexes != null ? each.value.global_secondary_indexes : []
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      projection_type = global_secondary_index.value.projection_type
    }
  }

  tags = local.common_tags
}

# ==================================================
# IAM ROLES & POLICIES
# ==================================================

# Individual Lambda execution roles (one per Lambda function)
resource "aws_iam_role" "lambda_role" {
  for_each = local.lambdas

  name = "${local.name_prefix}-${each.value.lambda_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

# Lambda basic execution policy attachment for each role
resource "aws_iam_role_policy_attachment" "basic_execution" {
  for_each = local.lambdas

  role       = aws_iam_role.lambda_role[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB access policy attachment for each role
resource "aws_iam_role_policy_attachment" "attach_dynamo_policy_lambda" {
  for_each = {
    for k, v in local.lambdas :
    k => v if try(v.dynamo_access_all, false)
  }

  role       = aws_iam_role.lambda_role[each.key].name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

# DynamoDB access policy
resource "aws_iam_policy" "dynamodb_access" {
  name = "${local.name_prefix}-dynamodb-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ]
      Resource = concat(
        [for table in aws_dynamodb_table.tables : table.arn],
        [for table in aws_dynamodb_table.tables : "${table.arn}/index/*"]
      )
    }]
  })

  tags = local.common_tags
}

# CloudWatch Log Groups for Lambda functions
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each          = local.lambdas
  name              = "/aws/lambda/${var.environment}-${var.project_name}-${each.value.lambda_name}"
  retention_in_days = local.lambda_configs.log_retention_days
  tags              = local.common_tags
}

# Cognito IAM policy for auth Lambda
resource "aws_iam_role_policy" "auth_lambda_cognito_policy" {
  name = "${var.environment}-${var.project_name}-auth-cognito-policy"
  role = aws_iam_role.lambda_role["auth_api"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminInitiateAuth",
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminConfirmSignUp",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminGetUser",
          "cognito-idp:ListUsers",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminResetUserPassword",
          "cognito-idp:AdminRespondToAuthChallenge",
          "cognito-idp:ForgotPassword",
          "cognito-idp:ConfirmForgotPassword",
          "cognito-idp:RespondToAuthChallenge",
          "cognito-idp:InitiateAuth",
          "cognito-idp:SignUp",
          "cognito-idp:ConfirmSignUp",
          "cognito-idp:ResendConfirmationCode",
          "cognito-idp:GlobalSignOut",
          "cognito-idp:GetUser"
        ]
        Resource = local.cognito_user_pool_arn
      }
    ]
  })
}

# S3 IAM policy for LLM Lambda
resource "aws_iam_role_policy" "llm_lambda_s3_policy" {
  name = "${var.environment}-${var.project_name}-llm-s3-policy"
  role = aws_iam_role.lambda_role["llm_api"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion"
        ]
        Resource = "${aws_s3_bucket.configs.arn}/*"
      }
    ]
  })
}

# Bedrock IAM policy for LLM Lambda
resource "aws_iam_role_policy" "llm_lambda_bedrock_policy" {
  name = "${var.environment}-${var.project_name}-llm-bedrock-policy"
  role = aws_iam_role.lambda_role["llm_api"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:GetFoundationModel",
          "bedrock:ListFoundationModels"
        ]
        Resource = "*"
      }
    ]
  })
}

# ==================================================
# CLOUDFRONT DISTRIBUTION
# ==================================================

# CloudFront Function for SPA routing
resource "aws_cloudfront_function" "rewrite_spa_routes" {
  name    = "${local.name_prefix}-rewrite-spa-routes"
  runtime = "cloudfront-js-1.0"
  comment = "Rewrites all unknown paths to index.html for SPA routing"

  publish = true

  code = <<EOT
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (!uri.includes('.') && !uri.endsWith('/')) {
    request.uri = '/index.html';
  }

  return request;
}
EOT
}

# Main CloudFront distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [var.domain_name, "www.${var.domain_name}"]

  # S3 Origin for frontend
  origin {
    origin_id                = "S3-${var.domain_name}"
    domain_name              = var.deployment_type == "migrate" ? aws_s3_bucket.main[0].bucket_regional_domain_name : "vishmaker.com.s3.us-east-1.amazonaws.com"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  # ALB Origin for WebSocket and health checks
  origin {
    origin_id   = "ALB-API-Backend"
    domain_name = aws_lb.api_alb.dns_name
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # API Gateway Origin for backend APIs
  origin {
    origin_id   = "APIGATEWAY-API-Backend"
    domain_name = "api.${var.domain_name}"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behavior for S3
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "S3-${var.domain_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.Managed_Optimized.id

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.rewrite_spa_routes.arn
    }
  }

  # WebSocket cache behavior
  ordered_cache_behavior {
    path_pattern           = "/ws*"
    target_origin_id       = "ALB-API-Backend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]

    cache_policy_id          = data.aws_cloudfront_cache_policy.Managed-CachingDisabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.Managed-AllViewer.id
    compress                 = true
  }

  # Health check cache behavior
  ordered_cache_behavior {
    path_pattern           = "/health"
    target_origin_id       = "ALB-API-Backend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id          = data.aws_cloudfront_cache_policy.Managed-CachingDisabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.Managed-AllViewer.id
    compress                 = true
  }

  # API cache behavior
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "APIGATEWAY-API-Backend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id          = data.aws_cloudfront_cache_policy.Managed-CachingDisabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.Managed-AllViewer.id
  }

  # Custom error responses for SPA
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method  = "sni-only"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cloudfront-distribution"
  })
}

# ==================================================
# ROUTE53 DNS RECORDS
# ==================================================

# Root domain record
resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

# WWW subdomain record
resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  name    = aws_apigatewayv2_domain_name.api.domain_name
  type    = "A"
  zone_id = data.aws_route53_zone.main.zone_id

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = true
  }
}

# ==================================================
# END OF MAIN COMPREHENSIVE CONFIGURATION
# ==================================================
