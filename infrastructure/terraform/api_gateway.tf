# API Gateway
resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
  target        = aws_lambda_function.projects.arn
}

# Projects Integration
resource "aws_apigatewayv2_integration" "projects" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.projects.invoke_arn
  payload_format_version = "2.0"
}

# LLM Integration
resource "aws_apigatewayv2_integration" "llm" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.llm.invoke_arn
  payload_format_version = "2.0"
}

# Projects Route
resource "aws_apigatewayv2_route" "projects" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /projects/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.projects.id}"
}

# LLM Route
resource "aws_apigatewayv2_route" "llm" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /llm/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.llm.id}"
}

# Use the auto-created $default stage (no need to create another)
# The API Gateway automatically creates a $default stage

# Lambda Permissions
resource "aws_lambda_permission" "api_gateway_projects" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.projects.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_llm" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.llm.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
} 