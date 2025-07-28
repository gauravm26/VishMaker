output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_user_pool_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_user_pool_domain" {
  description = "Domain of the Cognito User Pool"
  value       = aws_cognito_user_pool_domain.main.domain
}

output "cognito_user_pool_endpoint" {
  description = "Endpoint name of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.endpoint
}

output "cognito_hosted_ui_url" {
  description = "URL for Cognito hosted UI (for OAuth flows)"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.common_config.aws_region}.amazoncognito.com"
}

output "cognito_login_url" {
  description = "Direct login URL for the hosted UI"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.common_config.aws_region}.amazoncognito.com/login"
}

output "cognito_signup_url" {
  description = "Direct signup URL for the hosted UI"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.common_config.aws_region}.amazoncognito.com/signup"
} 