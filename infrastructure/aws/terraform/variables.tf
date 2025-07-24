variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "lambda_name" {
  description = "Name of the Lambda function"
  type        = string
  default     = "vishmaker-api"
}

variable "dynamodb_table_name" {
  description = "DynamoDB table for requirements"
  type        = string
  default     = "requirements"
}
