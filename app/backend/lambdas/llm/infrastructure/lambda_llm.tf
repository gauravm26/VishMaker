# LLM Lambda Infrastructure
# This creates the Lambda function for handling LLM operations and code generation

locals {
  function_name = "${var.environment}-${var.project_name}-api-llm"
  lambda_code_path = "${path.module}/../code"
  deployment_package_path = "${path.module}/../../../scripts/dist/llm-deployment.zip"
  
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

# IAM policy for S3 config access
resource "aws_iam_role_policy" "llm_lambda_s3_policy" {
  name = "${local.function_name}-s3-policy"
  role = aws_iam_role.llm_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion"
        ]
        Resource = "${var.config_bucket_arn}/*"
      }
    ]
  })
}

# IAM policy for DynamoDB access
resource "aws_iam_role_policy" "llm_lambda_dynamodb_policy" {
  name = "${local.function_name}-dynamodb-policy"
  role = aws_iam_role.llm_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/prod-vishmaker-user_flows",
          "arn:aws:dynamodb:${var.aws_region}:*:table/prod-vishmaker-user_flows/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/prod-vishmaker-high_level_requirements",
          "arn:aws:dynamodb:${var.aws_region}:*:table/prod-vishmaker-high_level_requirements/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/prod-vishmaker-low_level_requirements",
          "arn:aws:dynamodb:${var.aws_region}:*:table/prod-vishmaker-low_level_requirements/index/*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/prod-vishmaker-test_cases",
          "arn:aws:dynamodb:${var.aws_region}:*:table/prod-vishmaker-test_cases/index/*"
        ]
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


  environment {
    variables = var.lambda_environment_variables
  }

  depends_on = [
    aws_iam_role_policy_attachment.llm_lambda_basic_execution,
    aws_iam_role_policy.llm_lambda_bedrock_policy,
    aws_iam_role_policy.llm_lambda_s3_policy,
    aws_iam_role_policy.llm_lambda_dynamodb_policy,
    aws_cloudwatch_log_group.llm_lambda_logs
  ]

  tags = var.common_tags
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "llm_lambda_logs" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 5
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