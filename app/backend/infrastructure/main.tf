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
  
  
  # ⚡ Lambda configuration object (simplified for auth only)
  lambda_config = {
    runtime              = var.lambda_runtime
    log_retention_days   = var.log_retention_days
    # project_api and llm_api configurations removed - not needed for auth
  }
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


# Cognito Module
module "cognito" {
  source = "../cognito/infra"
  
  common_config = local.common_config
}


# Auth API Lambda Module
module "auth_api_lambda" {
  source = "../lambdas/auth/infrastructure"
  
  # Required variables
  project_name = local.common_config.project_name
  environment  = local.common_config.environment
  aws_region   = local.common_config.aws_region
  common_tags  = local.common_config.tags
  
  # Lambda-specific configuration
  lambda_runtime            = local.lambda_config.runtime
  lambda_timeout_seconds    = 60
  lambda_memory_mb         = 512
  lambda_environment_variables = {}

  # Integration dependencies
  cognito_user_pool_id    = module.cognito.cognito_user_pool_id
  cognito_client_id       = module.cognito.cognito_user_pool_client_id
  cognito_user_pool_arn   = module.cognito.cognito_user_pool_arn
  # api_gateway_execution_arn will be added after API Gateway is created to avoid circular dependency

  depends_on = [
    module.cognito
  ]
}

# API Gateway Module
module "api_gateway" {
  source = "../api_gateway/infra"
  
  common_config = local.common_config
  
  # Lambda integrations (only auth for now)
  lambda_auth_api_invoke_arn       = module.auth_api_lambda.lambda_auth_function_invoke_arn
  lambda_auth_api_function_name    = module.auth_api_lambda.lambda_auth_function_name
  
  # Empty values for other lambdas (not deployed yet)
  lambda_user_api_invoke_arn       = ""
  lambda_user_api_function_name    = ""
  lambda_llm_api_invoke_arn        = ""
  lambda_llm_api_function_name     = ""
  
  # Cognito integration
  cognito_user_pool_id = module.cognito.cognito_user_pool_id
  cognito_client_id    = module.cognito.cognito_user_pool_client_id
}

# CloudFront Module (for existing frontend)
module "cloudfront" {
  source = "../cloudfront/infra"
  
  common_config = local.common_config
  cloudfront_distribution_id = var.cloudfront_distribution_id
}

# Route53 Module (for frontend domain)
module "route53" {
  source = "../route53/infra"
  
  common_config = local.common_config
  api_gateway_endpoint = module.api_gateway.api_gateway_endpoint
}
