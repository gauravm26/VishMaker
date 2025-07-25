# Archive the Lambda source code
data "archive_file" "projects_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda-src"
  output_path = "${path.module}/lambda-src/projects.zip"
  excludes    = ["llm.py"]
}

data "archive_file" "llm_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda-src"
  output_path = "${path.module}/lambda-src/llm.zip"
  excludes    = ["projects.py"]
}

# Lambda Function for Projects
resource "aws_lambda_function" "projects" {
  function_name = "${local.name_prefix}-projects"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "projects.handler"
  runtime       = "python3.9"
  filename      = data.archive_file.projects_zip.output_path
  source_code_hash = data.archive_file.projects_zip.output_base64sha256
  timeout       = 60   # 1 minute for database operations
  memory_size   = 256  # Standard memory for database operations

  environment {
    variables = {
      DATABASE_URL = "postgresql://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.postgresql.endpoint}/${var.db_name}"
    }
  }

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-projects-lambda"
  })
}

# Lambda Function for LLM
resource "aws_lambda_function" "llm" {
  function_name = "${local.name_prefix}-llm"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "llm.handler"
  runtime       = "python3.9"
  filename      = data.archive_file.llm_zip.output_path
  source_code_hash = data.archive_file.llm_zip.output_base64sha256
  timeout       = 300  # 5 minutes for LLM processing
  memory_size   = 512  # Increased memory for LLM processing

  environment {
    variables = {
      AWS_REGION = var.aws_region
      LLM_CONFIG = jsonencode(jsondecode(file("${path.module}/../../global/config.json")))
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-llm-lambda"
  })
}

# IAM Role for Lambda Functions
resource "aws_iam_role" "lambda_exec" {
  name = "${local.name_prefix}-lambda-exec-role"

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

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-lambda-exec-role"
  })
}

# IAM Policy for Lambda VPC Access
resource "aws_iam_policy" "lambda_vpc_access" {
  name        = "${local.name_prefix}-lambda-vpc-access"
  description = "Allows Lambda functions to access resources in a VPC"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ],
        Resource = "*"
      }
    ]
  })
}

# Attach VPC access policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_vpc_access.arn
}

# Attach AWS managed Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# IAM Policy for Bedrock access
resource "aws_iam_policy" "lambda_bedrock_access" {
  name        = "${local.name_prefix}-lambda-bedrock-access"
  description = "Allows Lambda functions to access AWS Bedrock"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ],
        Resource = "*"
      }
    ]
  })
}

# Attach Bedrock access policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_bedrock_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_bedrock_access.arn
}

# Security Group for Lambda Functions
resource "aws_security_group" "lambda" {
  name        = "${local.name_prefix}-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = aws_vpc.main.id

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-lambda-sg"
  })
}

# Allow Lambda to access RDS
resource "aws_security_group_rule" "lambda_to_rds" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.lambda.id
  security_group_id        = aws_security_group.rds.id
} 