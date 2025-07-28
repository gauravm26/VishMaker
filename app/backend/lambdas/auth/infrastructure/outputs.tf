# Outputs for Authentication Lambda Infrastructure

output "lambda_auth_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.auth_api.function_name
}

output "lambda_auth_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.auth_api.arn
}

output "lambda_auth_function_invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = aws_lambda_function.auth_api.invoke_arn
}

output "lambda_auth_function_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.auth_lambda_role.arn
}

output "lambda_auth_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.auth_lambda_logs.name
} 