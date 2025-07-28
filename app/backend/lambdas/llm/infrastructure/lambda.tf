# LLM Lambda Infrastructure
# This creates the Lambda function for handling LLM operations and code generation

locals {
  function_name = "${var.project_name}-${var.environment}-llm-api"
  lambda_code_path = "${path.module}/../code"
  deployment_package_path = "${path.module}/../../../dist/llm-deployment.zip"
}

# Lambda IAM Role
resource "aws_iam_role" "llm_lambda_role" {
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
resource "aws_iam_role_policy_attachment" "llm_lambda_basic_execution" {
  role       = aws_iam_role.llm_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# VPC execution policy (if needed)
resource "aws_iam_role_policy_attachment" "llm_lambda_vpc_execution" {
  count      = length(var.vpc_subnet_ids) > 0 ? 1 : 0
  role       = aws_iam_role.llm_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# IAM policy for Bedrock access
resource "aws_iam_role_policy" "llm_lambda_bedrock_policy" {
  name = "${local.function_name}-bedrock-policy"
  role = aws_iam_role.llm_lambda_role.id

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

# IAM policy for RDS access
resource "aws_iam_role_policy" "llm_lambda_rds_policy" {
  count = var.rds_secret_arn != "" ? 1 : 0
  name  = "${local.function_name}-rds-policy"
  role  = aws_iam_role.llm_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.rds_secret_arn
      }
    ]
  })
}

# IAM policy for LLM secrets access
resource "aws_iam_role_policy" "llm_lambda_secrets_policy" {
  count = var.llm_secret_arn != "" ? 1 : 0
  name  = "${local.function_name}-secrets-policy"
  role  = aws_iam_role.llm_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.llm_secret_arn
      }
    ]
  })
}

# Lambda function
resource "aws_lambda_function" "llm_api" {
  filename         = local.deployment_package_path
  function_name    = local.function_name
  role            = aws_iam_role.llm_lambda_role.arn
  handler         = "main.handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout_seconds
  memory_size     = var.lambda_memory_mb
  source_code_hash = filebase64sha256(local.deployment_package_path)

  # VPC configuration (optional)
  dynamic "vpc_config" {
    for_each = length(var.vpc_subnet_ids) > 0 ? [1] : []
    content {
      subnet_ids         = var.vpc_subnet_ids
      security_group_ids = var.vpc_security_group_ids
    }
  }

  environment {
    variables = merge(
      var.lambda_environment_variables,
      {
        AWS_REGION     = var.aws_region
        RDS_SECRET_ARN = var.rds_secret_arn
        LLM_SECRET_ARN = var.llm_secret_arn
      }
    )
  }

  depends_on = [
    aws_iam_role_policy_attachment.llm_lambda_basic_execution,
    aws_iam_role_policy.llm_lambda_bedrock_policy,
    aws_cloudwatch_log_group.llm_lambda_logs
  ]

  tags = var.common_tags
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "llm_lambda_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14
  tags              = var.common_tags
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "llm_api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.llm_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
} 