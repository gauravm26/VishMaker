# Create a proper Lambda deployment package with dependencies
resource "null_resource" "lambda_package" {
  triggers = {
    requirements_hash = filemd5("${path.module}/lambda-requirements.txt")
    source_hash      = data.archive_file.lambda_source.output_base64sha256
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Create temporary directory for Lambda package
      TEMP_DIR=$(mktemp -d)
      cd "$TEMP_DIR"
      
      # Use absolute paths to avoid path issues
      PROJECT_ROOT="/Users/gauravmishra/Documents/Idea/Vish/VishMaker"
      TERRAFORM_DIR="$PROJECT_ROOT/infrastructure/terraform"
      VENV_PATH="$PROJECT_ROOT/app-api/venv/bin/activate"
      LAMBDA_REQUIREMENTS_PATH="$TERRAFORM_DIR/lambda-requirements.txt"
      LAMBDA_SRC_PATH="$TERRAFORM_DIR/lambda-src"
      
      # Activate virtual environment and install minimal dependencies for Lambda
      if [ -f "$VENV_PATH" ]; then
        source "$VENV_PATH"
        pip install -r "$LAMBDA_REQUIREMENTS_PATH" -t .
      else
        echo "Virtual environment not found at $VENV_PATH, using system pip"
        pip3 install -r "$LAMBDA_REQUIREMENTS_PATH" -t .
      fi
      
      # Copy Lambda source files
      cp -r "$LAMBDA_SRC_PATH"/* .
      
      # Create deployment package in the terraform directory
      ZIP_PATH="/Users/gauravmishra/Documents/Idea/Vish/VishMaker/infrastructure/terraform/lambda-deployment.zip"
      zip -r "$ZIP_PATH" .
      
      # Cleanup
      rm -rf "$TEMP_DIR"
    EOT
  }
}

# Archive the Lambda source code (for tracking changes)
data "archive_file" "lambda_source" {
  type        = "zip"
  source_dir  = "${path.module}/lambda-src"
  output_path = "${path.module}/lambda-src-temp.zip"
}

# Projects Lambda Function
resource "aws_lambda_function" "projects" {
  function_name = "${local.name_prefix}-projects"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "projects.handler"
  runtime       = "python3.9"
  filename      = "/Users/gauravmishra/Documents/Idea/Vish/VishMaker/infrastructure/terraform/lambda-deployment.zip"
  source_code_hash = null_resource.lambda_package.triggers.requirements_hash
  
  depends_on = [null_resource.lambda_package]
  timeout       = 60   # 1 minute for database operations
  memory_size   = 256  # Standard memory for database operations

  environment {
    variables = {
      DATABASE_SECRET_ARN = aws_secretsmanager_secret.db_password.arn
      DB_ENDPOINT = aws_db_instance.postgresql.endpoint
      DB_NAME = var.db_name
      DB_USERNAME = var.db_username
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
  filename      = "/Users/gauravmishra/Documents/Idea/Vish/VishMaker/infrastructure/terraform/lambda-deployment.zip"
  source_code_hash = null_resource.lambda_package.triggers.requirements_hash
  
  depends_on = [null_resource.lambda_package]
  timeout       = 300  # 5 minutes for LLM processing
  memory_size   = 512  # Increased memory for LLM processing

  environment {
    variables = {
      LLM_SECRET_ARN = aws_secretsmanager_secret.llm_api_keys.arn,
      CONFIG_BUCKET = aws_s3_bucket.lambda_configs.id,
      CONFIG_KEY = aws_s3_object.llm_config.key
    }
  }

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
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

# IAM Policy for Secrets Manager access
resource "aws_iam_policy" "lambda_secrets_access" {
  name        = "${local.name_prefix}-lambda-secrets-access"
  description = "Allows Lambda functions to access Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "secretsmanager:GetSecretValue"
        ],
        Resource = [
          aws_secretsmanager_secret.db_password.arn,
          aws_secretsmanager_secret.llm_api_keys.arn
        ]
      }
    ]
  })
}

# IAM Policy for S3 Config access
resource "aws_iam_policy" "lambda_s3_config_access" {
  name        = "${local.name_prefix}-lambda-s3-config-access"
  description = "Allows Lambda to read config from S3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow",
        Action   = "s3:GetObject",
        Resource = "${aws_s3_bucket.lambda_configs.arn}/*"
      }
    ]
  })
}

# Attach Bedrock access policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_bedrock_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_bedrock_access.arn
}

# Attach Secrets Manager access policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_secrets_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_secrets_access.arn
}

# Attach S3 config access policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_s3_config_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_s3_config_access.arn
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