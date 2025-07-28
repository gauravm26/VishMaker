output "lambda_function_name" {
  description = "Name of the Project API Lambda function"
  value       = aws_lambda_function.project_api.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Project API Lambda function"
  value       = aws_lambda_function.project_api.arn
}

output "lambda_invoke_arn" {
  description = "Invoke ARN of the Project API Lambda function"
  value       = aws_lambda_function.project_api.invoke_arn
}

output "lambda_role_arn" {
  description = "ARN of the Project API Lambda execution role"
  value       = aws_iam_role.lambda_exec.arn
} 