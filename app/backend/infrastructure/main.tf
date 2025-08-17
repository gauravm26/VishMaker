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
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region
}

# Local values - Consolidated configuration objects
locals {
  name_prefix = "${var.environment}-${var.project_name}"
  # 🏷️ Common configuration object
  common_config = {
    project_name = var.project_name
    environment  = var.environment
    aws_region   = var.aws_region
    name_prefix  = local.name_prefix
    domain_name  = var.domain_name
    tags = merge(var.common_tags, {
      Name        = local.name_prefix
      Project     = var.project_name
      Environment = var.environment
    })
  }
  
  # 🏷️ Common DynamoDB environment variables
  common_dynamodb_env_vars = {
    PROJECTS_TABLE_NAME                = aws_dynamodb_table.tables["projects"].name,
    USER_FLOWS_TABLE_NAME              = aws_dynamodb_table.tables["user-flows"].name,
    HIGH_LEVEL_REQUIREMENTS_TABLE_NAME = aws_dynamodb_table.tables["high-level-requirements"].name,
    LOW_LEVEL_REQUIREMENTS_TABLE_NAME  = aws_dynamodb_table.tables["low-level-requirements"].name,
    TEST_CASES_TABLE_NAME              = aws_dynamodb_table.tables["test-cases"].name
  }
  
  # 🏷️ Lambda configuration object

}



# ==================================================
# S3 CONFIGURATION BUCKET
# ==================================================

# S3 bucket for configuration files
resource "aws_s3_bucket" "configs" {
  bucket        = "${var.config_bucket_prefix}-${var.environment}-${random_string.bucket_suffix.result}"
  force_destroy = var.s3_force_destroy

  tags = merge(local.common_config.tags, {
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
  source = "${path.module}/../config/config.json"
  etag   = filemd5("${path.module}/../config/config.json")

  tags = local.common_config.tags
}


# ==================================================
# API GATEWAY
# ==================================================

locals {
  api_gateway = {
    name         = "${local.name_prefix}-api"
    cors_origins = ["https://vishmaker.com"]
    tags         = local.common_config.tags
  }
  api_routes = {
    auth_api = {
      routes = [
        {
          path    = ["/auth/signin", "/auth/signup", "/auth/confirm-signup", "/auth/forgot-password", "/auth/confirm-forgot-password"]
          methods = ["POST"]
          auth    = "NONE"
        },
        {
          path    = ["/auth/me", "/auth/signout", "/auth/refresh-token"]
          methods = ["GET", "POST"]
          auth    = "JWT"
        }
      ]
      lambda_arn    = aws_lambda_function.lambda["auth_api"].invoke_arn
      function_name = aws_lambda_function.lambda["auth_api"].function_name
    }
    projects_api = {
      routes = [
        {
          path    = ["/projects", "/projects/{proxy+}"]
          methods = ["GET", "POST", "PUT", "DELETE"]
          auth    = "JWT"
        }
      ]
      lambda_arn    = aws_lambda_function.lambda["projects_api"].invoke_arn
      function_name = aws_lambda_function.lambda["projects_api"].function_name
    }
    requirements_api = {
      routes = [
        {
          path    = ["/requirements", "/requirements/{proxy+}"]
          methods = ["GET", "POST", "PUT", "DELETE"]
          auth    = "JWT"
        }
      ]
      lambda_arn    = aws_lambda_function.lambda["requirements_api"].invoke_arn
      function_name = aws_lambda_function.lambda["requirements_api"].function_name
    }
    llm_api = {
      routes = [
        {
          path    = ["/llm/{proxy+}"]
          methods = ["GET", "POST", "PUT", "DELETE"]
          auth    = "JWT"
        }
      ]
      lambda_arn    = aws_lambda_function.lambda["llm_api"].invoke_arn
      function_name = aws_lambda_function.lambda["llm_api"].function_name
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

resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = true
    allow_headers     = ["*"]
    allow_methods     = ["*"]
    allow_origins     = ["https://vishmaker.com"]
    expose_headers    = ["*"]
    max_age           = 86400
  }
  tags = local.common_config.tags
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id = aws_apigatewayv2_api.main.id
  name   = "$default"

  auto_deploy = true

  tags = local.common_config.tags
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.common_config.project_name}-${local.common_config.environment}-cognito-authorizer"

  jwt_configuration {
    audience = [local.cognito_user_pool_client_id]
    issuer   = "https://cognito-idp.${local.common_config.aws_region}.amazonaws.com/${local.cognito_user_pool_id}"
  }
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.flattened_routes

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = each.value.route_key
  target             = "integrations/${aws_apigatewayv2_integration.api[each.value.integration_key].id}"
  authorization_type = each.value.auth_type
  authorizer_id      = each.value.auth_type == "JWT" ? aws_apigatewayv2_authorizer.cognito.id : null
}


resource "aws_apigatewayv2_integration" "api" {
  for_each = {
    for key, value in local.api_routes :
    key => value.lambda_arn
  }

  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000 # 30 seconds (maximum allowed by API Gateway v2)
}

resource "aws_lambda_permission" "apigw_permissions" {
  for_each = {
    for key, val in local.api_routes : key => val.function_name
  }

  statement_id  = "AllowAPIGatewayInvoke_${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# CORS Preflight Routes (no authentication required)
resource "aws_apigatewayv2_route" "cors_preflight_routes" {
  for_each = toset([
    "OPTIONS /auth/{proxy+}",
    "OPTIONS /projects/{proxy+}",
    "OPTIONS /requirements/{proxy+}",
    "OPTIONS /llm/{proxy+}"
  ])

  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.api["auth_api"].id}"

  # No authorization required for CORS preflight
}

# Health check route
resource "aws_apigatewayv2_route" "health_check" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /ping"
  target    = "integrations/${aws_apigatewayv2_integration.api["auth_api"].id}"
}

# Default route for root path
resource "aws_apigatewayv2_route" "root" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /"
  target    = "integrations/${aws_apigatewayv2_integration.api["auth_api"].id}"
}

# ==================================================
# CLOUDFRONT
# ==================================================

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
  s3_bucket               = data.aws_s3_bucket.existing
  hosted_zone             = data.aws_route53_zone.existing
}


# ==================================================
# ROUTE53
# ==================================================

# Data source for the hosted zone
data "aws_route53_zone" "main" {
  name = var.domain_name
}

# ==================================================
# COGNITO
# ==================================================

# Cognito User Pool
/* resource "aws_cognito_user_pool" "main" {
  name = "${local.common_config.name_prefix}-user-pool"

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # User attributes
  alias_attributes         = ["email"]
  auto_verified_attributes = ["email"]
  
  # Email verification
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your VishMaker verification code"
    email_message        = "Your verification code is {####}. Welcome to VishMaker!"
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # MFA configuration
  mfa_configuration = "OFF"

  # Admin create user configuration
  admin_create_user_config {
    allow_admin_create_user_only = false
    
    invite_message_template {
      email_subject = "Your VishMaker account"
      email_message = "Welcome to VishMaker! Your username is {username} and temporary password is {####}"
      sms_message   = "Your VishMaker username is {username} and temporary password is {####}"
    }
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  tags = local.common_config.tags

  lifecycle {
    prevent_destroy = true  # 🔒 Protect existing users and prevent accidental deletion
  }
} */

locals {
  cognito_user_pool_id        = "us-east-1_Hf4Ps4b4j"
  cognito_user_pool_arn       = "arn:aws:cognito-idp:us-east-1:489270312286:userpool/us-east-1_Hf4Ps4b4j"
  cognito_user_pool_client_id = "6vtj80n9u3916hnlpnpbi7r2v9"

}

# Cognito User Pool Client
/* resource "aws_cognito_user_pool_client" "main" {
  name         = "${local.common_config.name_prefix}-user-pool-client"
  user_pool_id = local.user_pool_id

  # Client settings
  generate_secret                      = false
  prevent_user_existence_errors       = "ENABLED"
  enable_token_revocation             = true
  enable_propagate_additional_user_context_data = false

  # Auth flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # Token validity
  access_token_validity  = 60    # 1 hour
  id_token_validity      = 60    # 1 hour
  refresh_token_validity = 30    # 30 days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  # Read/write attributes
  read_attributes = [
    "email",
    "email_verified",
    "preferred_username"
  ]

  write_attributes = [
    "email",
    "preferred_username"
  ]

  #lifecycle {
  #  prevent_destroy = true  # 🔒 Protect existing client configuration and prevent accidental deletion
  #}
} */

# Cognito User Pool Domain
/* 
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "auth-vishmaker"
  user_pool_id = local.cognito_user_pool_id

/*   lifecycle {
    prevent_destroy = true  # 🔒 Protect existing domain configuration and prevent accidental deletion
  } */




# ==================================================
# LAMBDAS
# ==================================================
locals {
  lambda_config = {
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
  lambdas = {
    auth_api = {
      lambda_name = "auth"
      environment_variables = {
        COGNITO_USER_POOL_ID = local.cognito_user_pool_id
        COGNITO_CLIENT_ID    = local.cognito_user_pool_client_id
      }
      dynamo_access_all = false
      timeout = 60
      memory_size = 512
    },
    llm_api = {
      lambda_name = "llm"
      environment_variables = merge(
        local.common_dynamodb_env_vars,
        {
          CONFIG_BUCKET = aws_s3_bucket.configs.id
          CONFIG_KEY    = "config.json"
          ENVIRONMENT  = var.environment
          PROJECT_NAME = var.project_name
        }
      )
      dynamo_access_all = true
      timeout = var.lambda_timeout_seconds
      memory_size = var.lambda_memory_mb
    },
    projects_api = {
      lambda_name = "projects"
      environment_variables = local.common_dynamodb_env_vars
      dynamo_access_all = true
    },
    requirements_api = {
      lambda_name = "requirements"
      environment_variables = local.common_dynamodb_env_vars
      dynamo_access_all = true
    }
  }
  all_dynamo_tables_arns = [
    for table in aws_dynamodb_table.tables : table.arn
  ]
  lambda_arns_by_key = {
    for k, lambda in aws_lambda_function.lambda :
    k => lambda.invoke_arn
  }
  lambda_arns_by_function_name = {
    for k, lambda in aws_lambda_function.lambda :
    lambda.function_name => lambda.arn
  }
}


resource "aws_lambda_function" "lambda" {
  for_each = local.lambdas

  function_name    = "${local.name_prefix}-${each.value.lambda_name}"
  role             = aws_iam_role.lambda_role[each.key].arn
  filename         = "${local.lambda_config.root_path}/${each.value.lambda_name}-deployment.zip"
  handler          = try(each.value.handler, local.lambda_config.handler)
  runtime          = try(each.value.runtime, local.lambda_config.runtime)
  source_code_hash = filebase64sha256("${local.lambda_config.root_path}/${each.value.lambda_name}-deployment.zip")
  timeout          = try(each.value.timeout, local.lambda_config.timeout)
  memory_size      = try(each.value.memory_size, local.lambda_config.memory_size)
  architectures    = try(each.value.architectures, local.lambda_config.architectures)
  layers           = try(each.value.layers, local.lambda_config.layers)
  tags             = try(each.value.tags, local.lambda_config.common_tags)

  environment {
    variables = each.value.environment_variables
  }
}

resource "aws_iam_role" "lambda_role" {
  for_each = local.lambdas

  name = "${var.environment}-${var.project_name}-${each.value.lambda_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })

  tags = local.lambda_config.common_tags
}

resource "aws_iam_role_policy_attachment" "basic_execution" {
  for_each = local.lambdas

  role       = aws_iam_role.lambda_role[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}


resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each          = local.lambdas
  name              = "/aws/lambda/${var.environment}-${var.project_name}-${each.value.lambda_name}"
  retention_in_days = local.lambda_config.log_retention_days
  tags              = local.lambda_config.common_tags
}

resource "aws_iam_role_policy_attachment" "attach_dynamo_policy_lambda" {
  for_each = {
    for k, v in local.lambdas :
    k => v if try(v.dynamo_access_all, false)
  }

  role       = aws_iam_role.lambda_role[each.key].name
  policy_arn = aws_iam_policy.dynamodb_rw_policy.arn
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
# DYNAMODB
# ==================================================

locals {
  dynamodb_common = {
    billing_mode = "PAY_PER_REQUEST"
    common_tags  = var.common_tags
  }
  dynamodb_tables = {
    projects = {
      hash_key  = "id"
      range_key = "user_id"
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
      hash_key  = "uiid"
      range_key = "project_id"
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
      hash_key  = "uiid"
      range_key = "parent_uiid"
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
      hash_key  = "uiid"
      range_key = "parent_uiid"
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
      hash_key  = "uiid"
      range_key = "parent_uiid"
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
      hash_key = "email"
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

resource "aws_dynamodb_table" "tables" {
  for_each = local.dynamodb_tables

  name         = "${var.environment}-${var.project_name}-${each.key}"
  billing_mode = local.dynamodb_common.billing_mode
  hash_key     = each.value.hash_key
  range_key    = try(each.value.range_key, null)

  dynamic "attribute" {
    for_each = each.value.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  dynamic "global_secondary_index" {
    for_each = try(each.value.global_secondary_indexes, [])
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      projection_type = global_secondary_index.value.projection_type
    }
  }

  tags = local.common_config.tags
}

resource "aws_iam_policy" "dynamodb_rw_policy" {
  name = "${local.name_prefix}-dynamodb-access-policy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ],
        Resource = concat(
          local.all_dynamodb_table_arns,
          local.all_dynamodb_index_arns
        )
      }
    ]
  })
}
