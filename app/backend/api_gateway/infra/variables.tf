# ==================================================
# API GATEWAY MODULE - SIMPLIFIED VARIABLES
# ==================================================

# Common configuration object (contains project_name, environment, aws_region, tags)
variable "common_config" {
  description = "Common configuration object containing project_name, environment, aws_region, tags"
  type = object({
    project_name = string
    environment  = string
    aws_region   = string
    name_prefix  = string
    tags         = map(string)
    domain_name  = string
  })
}

# Lambda Integration Variables
variable "lambda_user_api_invoke_arn" {
  description = "Project API Lambda invoke ARN for API Gateway integration"
  type        = string
}

variable "lambda_user_api_function_name" {
  description = "Project API Lambda function name for permissions"
  type        = string
}

variable "lambda_llm_api_invoke_arn" {
  description = "LLM API Lambda invoke ARN for API Gateway integration"
  type        = string
}

variable "lambda_llm_api_function_name" {
  description = "LLM API Lambda function name for permissions"
  type        = string
}

variable "lambda_auth_api_invoke_arn" {
  description = "Auth API Lambda invoke ARN for API Gateway integration"
  type        = string
}

variable "lambda_auth_api_function_name" {
  description = "Auth API Lambda function name for permissions"
  type        = string
}

# Cognito Integration Variables
variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT authorizer"
  type        = string
}

variable "cognito_client_id" {
  description = "Cognito User Pool Client ID for JWT authorizer"
  type        = string
} 