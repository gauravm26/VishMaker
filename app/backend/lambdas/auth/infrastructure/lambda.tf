# Authentication Lambda Infrastructure
# This creates the Lambda function for handling authentication

locals {
  function_name = "${var.environment}-${var.project_name}-api-auth"
  lambda_code_path = "${path.module}/../code"
}

# Use pre-built deployment package from build.sh script
locals {
  deployment_package_path = "${path.module}/../../../scripts/dist/auth-deployment.zip"
}

# Lambda IAM Role
resource "aws_iam_role" "auth_lambda_role" {
  name = "${local.function_name}-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  
  tags = var.common_tags
}

# Basic execution policy
resource "aws_iam_role_policy_attachment" "auth_lambda_basic_execution" {
  role       = aws_iam_role.auth_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}


# IAM policy for Cognito operations
resource "aws_iam_role_policy" "auth_lambda_cognito_policy" {
  name = "${local.function_name}-cognito-policy"
  role = aws_iam_role.auth_lambda_role.id

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
        Resource = var.cognito_user_pool_arn
      }
    ]
  })
}

# Note: Auth lambda does not need RDS access
# Authentication is handled entirely by Cognito
# User data storage is handled by the users lambda

# Lambda function
resource "aws_lambda_function" "auth_api" {
  filename         = local.deployment_package_path
  function_name    = local.function_name
  role            = aws_iam_role.auth_lambda_role.arn
  handler         = "main.handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout_seconds
  memory_size     = var.lambda_memory_mb
  source_code_hash = filebase64sha256(local.deployment_package_path)

  environment {
    variables = merge(
      var.lambda_environment_variables,
      {
        COGNITO_USER_POOL_ID = var.cognito_user_pool_id
        COGNITO_CLIENT_ID    = var.cognito_client_id
        AWS_REGION          = var.aws_region
      }
    )
  }

  depends_on = [
    aws_iam_role_policy_attachment.auth_lambda_basic_execution,
    aws_iam_role_policy.auth_lambda_cognito_policy,
    aws_cloudwatch_log_group.auth_lambda_logs
  ]

  tags = var.common_tags
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "auth_lambda_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14
  tags              = var.common_tags
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "auth_api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
} 