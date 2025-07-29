# DynamoDB Module Outputs

output "projects_table_name" {
  description = "Name of the projects DynamoDB table"
  value       = aws_dynamodb_table.projects.name
}

output "projects_table_arn" {
  description = "ARN of the projects DynamoDB table"
  value       = aws_dynamodb_table.projects.arn
}

output "user_flows_table_name" {
  description = "Name of the user flows DynamoDB table"
  value       = aws_dynamodb_table.user_flows.name
}

output "user_flows_table_arn" {
  description = "ARN of the user flows DynamoDB table"
  value       = aws_dynamodb_table.user_flows.arn
}

output "high_level_requirements_table_name" {
  description = "Name of the high level requirements DynamoDB table"
  value       = aws_dynamodb_table.high_level_requirements.name
}

output "high_level_requirements_table_arn" {
  description = "ARN of the high level requirements DynamoDB table"
  value       = aws_dynamodb_table.high_level_requirements.arn
}

output "low_level_requirements_table_name" {
  description = "Name of the low level requirements DynamoDB table"
  value       = aws_dynamodb_table.low_level_requirements.name
}

output "low_level_requirements_table_arn" {
  description = "ARN of the low level requirements DynamoDB table"
  value       = aws_dynamodb_table.low_level_requirements.arn
}

output "test_cases_table_name" {
  description = "Name of the test cases DynamoDB table"
  value       = aws_dynamodb_table.test_cases.name
}

output "test_cases_table_arn" {
  description = "ARN of the test cases DynamoDB table"
  value       = aws_dynamodb_table.test_cases.arn
}

output "waitlist_table_name" {
  description = "Name of the waitlist DynamoDB table"
  value       = aws_dynamodb_table.waitlist.name
}

output "waitlist_table_arn" {
  description = "ARN of the waitlist DynamoDB table"
  value       = aws_dynamodb_table.waitlist.arn
}

# Combined outputs for easy access
output "all_table_names" {
  description = "Names of all DynamoDB tables"
  value = {
    projects                    = aws_dynamodb_table.projects.name
    user_flows                  = aws_dynamodb_table.user_flows.name
    high_level_requirements     = aws_dynamodb_table.high_level_requirements.name
    low_level_requirements      = aws_dynamodb_table.low_level_requirements.name
    test_cases                  = aws_dynamodb_table.test_cases.name
    waitlist                    = aws_dynamodb_table.waitlist.name
  }
}

output "all_table_arns" {
  description = "ARNs of all DynamoDB tables"
  value = {
    projects                    = aws_dynamodb_table.projects.arn
    user_flows                  = aws_dynamodb_table.user_flows.arn
    high_level_requirements     = aws_dynamodb_table.high_level_requirements.arn
    low_level_requirements      = aws_dynamodb_table.low_level_requirements.arn
    test_cases                  = aws_dynamodb_table.test_cases.arn
    waitlist                    = aws_dynamodb_table.waitlist.arn
  }
} 