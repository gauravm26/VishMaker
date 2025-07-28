# ==================================================
# PROJECT API LAMBDA MODULE - MINIMAL VARIABLES USING OBJECTS
# ==================================================

# Common configuration object
variable "common_config" {
  description = "Common configuration object containing project_name, environment, aws_region, tags"
  type = object({
    project_name = string
    environment  = string
    aws_region   = string
    name_prefix  = string
    tags         = map(string)
  })
}

# Lambda configuration object
variable "lambda_config" {
  description = "Lambda configuration object for project API"
  type = object({
    timeout   = number
    memory    = number
    zip_path  = string
    zip_hash  = string
  })
}

# Network configuration object
variable "network_config" {
  description = "Network configuration object"
  type = object({
    vpc_cidr             = string
    availability_zones   = list(string)
    public_subnet_ids    = list(string)
    private_subnet_ids   = list(string)
    database_subnet_ids  = list(string)
    lambda_sg_id         = string
    database_sg_id       = string
  })
}

# Dependency Variables (service-specific)
variable "db_secret_arn" {
  description = "ARN of the database secret in Secrets Manager"
  type        = string
}

variable "db_endpoint" {
  description = "Database endpoint"
  type        = string
}

variable "config_bucket_arn" {
  description = "ARN of the S3 bucket containing configuration files"
  type        = string
}

variable "config_bucket_name" {
  description = "Name of the S3 bucket containing configuration files"
  type        = string
}

variable "config_key" {
  description = "S3 key for the configuration file"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
} 