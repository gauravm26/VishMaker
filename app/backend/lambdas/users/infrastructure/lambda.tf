# Project API Lambda Function
resource "aws_lambda_function" "project_api" {
  function_name = "${var.common_config.name_prefix}-project-api"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "main.handler"
  runtime       = "python3.9"
  filename      = var.lambda_config.zip_path
  source_code_hash = var.lambda_config.zip_hash
  
  timeout       = var.lambda_config.timeout
  memory_size   = var.lambda_config.memory

  environment {
    variables = {
      DATABASE_SECRET_ARN = var.db_secret_arn
      DB_ENDPOINT = var.db_endpoint
      DB_NAME = "vishmaker"
      DB_USERNAME = "vishmaker_user"
      CONFIG_BUCKET = var.config_bucket_name
      CONFIG_KEY = var.config_key
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      COGNITO_CLIENT_ID = var.cognito_client_id
      AWS_REGION = var.common_config.aws_region
      PROJECT_NAME = var.common_config.project_name
      ENVIRONMENT = var.common_config.environment
      API_V1_STR = "/api/v1"
    }
  }

  vpc_config {
    subnet_ids         = var.network_config.private_subnet_ids
    security_group_ids = [var.network_config.lambda_sg_id]
  }

  tags = merge(var.common_config.tags, {
    Name = "${var.common_config.name_prefix}-project-api-lambda"
    Service = "project-api"
  })
}

# Lambda IAM Role
resource "aws_iam_role" "lambda_exec" {
  name = "${var.common_config.name_prefix}-project-api-lambda-exec"

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

  tags = var.common_config.tags
}

# Lambda IAM Policy
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.common_config.name_prefix}-project-api-lambda-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          var.db_secret_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${var.config_bucket_arn}/*"
        ]
      }
    ]
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.project_api.function_name}"
  retention_in_days = 14

  tags = var.common_config.tags
} 