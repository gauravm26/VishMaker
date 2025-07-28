# API Gateway
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.common_config.project_name}-${var.common_config.environment}-api"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_credentials = true
    allow_headers     = ["*"]
    allow_methods     = ["*"]
    allow_origins     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }

  tags = merge(var.common_config.tags, {
    Name = "${var.common_config.project_name}-${var.common_config.environment}-api-gateway"
  })
}

# Cognito Authorizer
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.common_config.project_name}-${var.common_config.environment}-cognito-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${var.common_config.aws_region}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# Project API Integration
resource "aws_apigatewayv2_integration" "user" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = var.lambda_user_api_invoke_arn
  payload_format_version = "2.0"
}

# LLM API Integration
resource "aws_apigatewayv2_integration" "llm_api" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = var.lambda_llm_api_invoke_arn
  payload_format_version = "2.0"
}

# Auth API Integration
resource "aws_apigatewayv2_integration" "auth_api" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = var.lambda_auth_api_invoke_arn
  payload_format_version = "2.0"
}

# Project API Protected Routes (require authentication)
resource "aws_apigatewayv2_route" "user_protected_routes" {
  for_each = toset([
    "ANY /api/v1/user/projects/{proxy+}",
    "ANY /api/v1/user/requirements/{proxy+}"
  ])
  
  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.user.id}"
  
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# LLM API Protected Routes (require authentication)
resource "aws_apigatewayv2_route" "llm_api_protected_routes" {
  for_each = toset([
    "ANY /api/v1/llm/{proxy+}",
    "ANY /api/v1/code/{proxy+}"
  ])
  
  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.llm_api.id}"
  
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Auth API Public Routes (no authentication required)
resource "aws_apigatewayv2_route" "auth_api_public_routes" {
  for_each = toset([
    "POST /api/v1/auth/signin",
    "POST /api/v1/auth/signup", 
    "POST /api/v1/auth/confirm-signup",
    "POST /api/v1/auth/forgot-password",
    "POST /api/v1/auth/confirm-forgot-password"
  ])
  
  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.auth_api.id}"
}

# Auth API Protected Routes (require JWT authentication)
resource "aws_apigatewayv2_route" "auth_api_protected_routes" {
  for_each = toset([
    "GET /api/v1/auth/me",
    "POST /api/v1/auth/signout",
    "POST /api/v1/auth/refresh-token"
  ])
  
  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.auth_api.id}"
  
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Project API Public Routes (no authentication required)  
resource "aws_apigatewayv2_route" "user_public_routes" {
  for_each = toset([
    "ANY /api/v1/waitlist/{proxy+}"
  ])
  
  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.user.id}"
}

# Health check routes (both APIs)
resource "aws_apigatewayv2_route" "health_check" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /ping"
  target    = "integrations/${aws_apigatewayv2_integration.user.id}"
}

# Default route for root path
resource "aws_apigatewayv2_route" "root" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /"
  target    = "integrations/${aws_apigatewayv2_integration.user.id}"
}

# Lambda Permissions for Project API
resource "aws_lambda_permission" "api_gateway_user" {
  statement_id  = "AllowAPIGatewayInvokeProjectAPI"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_user_api_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Lambda Permissions for LLM API
resource "aws_lambda_permission" "api_gateway_llm_api" {
  statement_id  = "AllowAPIGatewayInvokeLLMAPI"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_llm_api_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Lambda Permissions for Auth API
resource "aws_lambda_permission" "api_gateway_auth_api" {
  statement_id  = "AllowAPIGatewayInvokeAuthAPI"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_auth_api_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
} 