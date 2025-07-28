# Outputs for LLM Lambda Infrastructure

output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.llm_api.function_name
}

output "function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.llm_api.arn
}

output "function_invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = aws_lambda_function.llm_api.invoke_arn
}

output "function_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.llm_lambda_role.arn
}

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.llm_lambda_logs.name
} 