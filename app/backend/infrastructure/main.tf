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
    tags = merge(var.common_tags, {
      Name        = local.name_prefix
      Project     = var.project_name
      Environment = var.environment
    })
  }
  
  # 🌐 Network configuration object
  network_config = {
    vpc_cidr             = var.vpc_cidr
    availability_zones   = var.availability_zones
    public_subnet_ids    = aws_subnet.public[*].id
    private_subnet_ids   = aws_subnet.private[*].id
    database_subnet_ids  = aws_subnet.database[*].id
    lambda_sg_id         = aws_security_group.lambda.id
    database_sg_id       = aws_security_group.database.id
  }
  
  # 🗄️ Database configuration object
  database_config = {
    db_name                  = var.db_name
    db_username              = var.db_username
    db_instance_class        = var.db_instance_class
    db_allocated_storage     = var.db_allocated_storage
    db_max_allocated_storage = var.db_max_allocated_storage
    backup_retention_period  = var.backup_retention_period
    deletion_protection      = var.deletion_protection
  }
  
  # ⚡ Lambda configuration object
  lambda_config = {
    runtime              = var.lambda_runtime
    log_retention_days   = var.log_retention_days
    project_api = {
      timeout       = var.project_api_timeout
      memory        = var.project_api_memory
      zip_path      = var.project_api_zip_path
      zip_hash      = filebase64sha256(var.project_api_zip_path)
    }
    llm_api = {
      timeout       = var.llm_api_timeout
      memory        = var.llm_api_memory
      zip_path      = var.llm_api_zip_path
      zip_hash      = filebase64sha256(var.llm_api_zip_path)
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# ==================================================
# VPC AND NETWORKING
# ==================================================

# Main VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-igw"
  })
}

# Public Subnets (for NAT Gateway)
resource "aws_subnet" "public" {
  count = 2

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-public-subnet-${count.index + 1}"
    Type = "public"
  })
}

# Private Subnets (for Lambda functions)
resource "aws_subnet" "private" {
  count = 2

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-private-subnet-${count.index + 1}"
    Type = "private"
  })
}

# Database Subnets (for RDS)
resource "aws_subnet" "database" {
  count = 2

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 30)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-database-subnet-${count.index + 1}"
    Type = "database"
  })
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  domain = "vpc"

  depends_on = [aws_internet_gateway.main]

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-nat-eip"
  })
}

# NAT Gateway
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  depends_on = [aws_internet_gateway.main]

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-nat-gateway"
  })
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-private-rt"
  })
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-database-rt"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "database" {
  count = length(aws_subnet.database)

  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# ==================================================
# SECURITY GROUPS
# ==================================================

# Lambda Security Group
resource "aws_security_group" "lambda" {
  name_prefix = "${local.name_prefix}-lambda-"
  vpc_id      = aws_vpc.main.id

  description = "Security group for Lambda functions"

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-lambda-sg"
  })
}

# Database Security Group
resource "aws_security_group" "database" {
  name_prefix = "${local.name_prefix}-database-"
  vpc_id      = aws_vpc.main.id

  description = "Security group for RDS database"

  ingress {
    description     = "PostgreSQL from Lambda"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_config.tags, {
    Name = "${local.name_prefix}-database-sg"
  })
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
# SECRETS MANAGER
# ==================================================

# Secret for LLM API Keys
resource "aws_secretsmanager_secret" "llm_api_keys" {
  name        = "${local.name_prefix}-llm-api-keys"
  description = "API keys for LLM services (Anthropic, OpenAI, etc.)"

  tags = local.common_config.tags
}

resource "aws_secretsmanager_secret_version" "llm_api_keys" {
  secret_id = aws_secretsmanager_secret.llm_api_keys.id
  secret_string = jsonencode({
    anthropic_api_key = "your-anthropic-api-key-here"
    openai_api_key   = "your-openai-api-key-here"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ==================================================
# AWS SERVICE MODULES - Using Structured Objects!
# ==================================================

# Cognito Module
module "cognito" {
  source = "../cognito/infrastructure"
  
  common_config = local.common_config
  domain_name   = var.domain_name
}

# RDS Module
module "rds" {
  source = "../rds/infrastructure"
  
  common_config   = local.common_config
  database_config = local.database_config
  network_config  = local.network_config
}

# Project API Lambda Module
module "project_api_lambda" {
  source = "../lambdas/project_api/infrastructure"
  
  common_config   = local.common_config
  lambda_config   = local.lambda_config.project_api
  network_config  = local.network_config
  
  # Dependencies
  db_secret_arn        = module.rds.db_secret_arn
  db_endpoint          = module.rds.db_instance_endpoint
  config_bucket_arn    = aws_s3_bucket.configs.arn
  config_bucket_name   = aws_s3_bucket.configs.id
  config_key           = aws_s3_object.app_config.key
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.user_pool_client_id
}

# LLM API Lambda Module
module "llm_api_lambda" {
  source = "../lambdas/llm/infrastructure"
  
  # Required variables
  project_name = local.common_config.project_name
  environment  = local.common_config.environment
  aws_region   = local.common_config.aws_region
  common_tags  = local.common_config.tags
  
  # Lambda-specific configuration
  lambda_runtime            = local.lambda_config.runtime
  lambda_timeout_seconds    = 300  # 5 minutes for LLM operations
  lambda_memory_mb         = 1024  # Higher memory for AI/ML operations
  lambda_environment_variables = {}

  # VPC Configuration (optional - leave empty for now)
  vpc_subnet_ids         = []
  vpc_security_group_ids = []

  # Integration dependencies
  rds_secret_arn         = module.rds.db_secret_arn
  llm_secret_arn         = aws_secretsmanager_secret.llm_api_keys.arn
  api_gateway_execution_arn = module.api_gateway.execution_arn

  depends_on = [
    module.rds
  ]
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

  # VPC Configuration (optional - leave empty for now)
  vpc_subnet_ids         = []
  vpc_security_group_ids = []

  # Integration dependencies
  cognito_user_pool_id    = module.cognito.user_pool_id
  cognito_client_id       = module.cognito.user_pool_client_id
  cognito_user_pool_arn   = module.cognito.user_pool_arn
  # rds_secret_arn removed - auth lambda only needs Cognito
  api_gateway_execution_arn = module.api_gateway.execution_arn

  depends_on = [
    module.cognito,
    module.rds
  ]
}

# API Gateway Module
module "api_gateway" {
  source = "../api_gateway/infra"
  
  common_config = local.common_config
  
  # Lambda integrations
  lambda_user_api_invoke_arn    = module.project_api_lambda.lambda_invoke_arn
  lambda_user_api_function_name = module.project_api_lambda.lambda_function_name
  lambda_llm_api_invoke_arn        = module.llm_api_lambda.function_invoke_arn
  lambda_llm_api_function_name     = module.llm_api_lambda.function_name
  lambda_auth_api_invoke_arn       = module.auth_api_lambda.function_invoke_arn
  lambda_auth_api_function_name    = module.auth_api_lambda.function_name
  
  # Cognito integration
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.user_pool_client_id
}

# CloudFront Module (for existing frontend)
module "cloudfront" {
  source = "../cloudfront/infra"
  
  common_config = local.common_config
  cloudfront_distribution_id = var.cloudfront_distribution_id
}

# Route53 Module (for API subdomain)
module "route53" {
  source = "../route53/infra"
  
  common_config = local.common_config
  api_gateway_endpoint = module.api_gateway.api_endpoint
}
