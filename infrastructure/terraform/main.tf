# infrastructure/terraform/main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  # S3 backend for Terraform state (optional but recommended)
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket" # Replace with your bucket name
  #   key            = "vishmaker/dev/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "your-terraform-lock-table"   # Replace with your DynamoDB table name
  # }
}

# Provider configuration
provider "aws" {
  region = var.aws_region
}

# Data source for availability zones
data "aws_availability_zones" "available" {}

# Random password for RDS
resource "random_password" "db_password" {
  length  = 16
  special = true
}

# Store DB password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name        = "${local.name_prefix}-db-password"
  description = "Database password for VishMaker ${var.environment}"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

# Store LLM API Keys in AWS Secrets Manager
resource "aws_secretsmanager_secret" "llm_api_keys" {
  name        = "${local.name_prefix}-llm-api-keys"
  description = "LLM API keys for VishMaker ${var.environment}"
}

resource "aws_secretsmanager_secret_version" "llm_api_keys" {
  secret_id = aws_secretsmanager_secret.llm_api_keys.id
  secret_string = jsonencode({
    openai_api_key = var.openai_api_key
    # Add other LLM API keys here as needed
  })
}

# S3 bucket for Lambda configurations
resource "aws_s3_bucket" "lambda_configs" {
  bucket_prefix = "${local.name_prefix}-lambda-configs-"
  force_destroy = true
}

# S3 bucket ACL disabled - using bucket ownership controls instead
resource "aws_s3_bucket_ownership_controls" "lambda_configs_ownership" {
  bucket = aws_s3_bucket.lambda_configs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_object" "llm_config" {
  bucket = aws_s3_bucket.lambda_configs.id
  key    = "llm/config.json"
  source = "${path.module}/../../global/config.json"
  etag   = filemd5("${path.module}/../../global/config.json")
}

# Common locals
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  name_prefix = "${var.environment}-${var.project_name}"
} 