#!/bin/bash

# Script to import existing AWS resources into Terraform state
# This prevents Terraform from trying to create resources that already exist

set -e

echo "Importing existing AWS resources into Terraform state..."

# Environment and project name from your variables
ENVIRONMENT="prod"
PROJECT_NAME="vishmaker"

echo "=== Importing IAM Roles ==="
# Import IAM roles
terraform import 'aws_iam_role.lambda_role["auth_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-auth-role"
terraform import 'aws_iam_role.lambda_role["projects_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-projects-role"
terraform import 'aws_iam_role.lambda_role["llm_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-llm-role"
terraform import 'aws_iam_role.lambda_role["requirements_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-requirements-role"

echo "=== Importing CloudWatch Log Groups ==="
# Import CloudWatch log groups
terraform import 'aws_cloudwatch_log_group.lambda_logs["auth_api"]' "/aws/lambda/${ENVIRONMENT}-${PROJECT_NAME}-auth"
terraform import 'aws_cloudwatch_log_group.lambda_logs["projects_api"]' "/aws/lambda/${ENVIRONMENT}-${PROJECT_NAME}-projects"
terraform import 'aws_cloudwatch_log_group.lambda_logs["llm_api"]' "/aws/lambda/${ENVIRONMENT}-${PROJECT_NAME}-llm"
terraform import 'aws_cloudwatch_log_group.lambda_logs["requirements_api"]' "/aws/lambda/${ENVIRONMENT}-${PROJECT_NAME}-requirements"

echo "=== Importing IAM Policies ==="
# Import IAM policies
terraform import 'aws_iam_policy.dynamodb_rw_policy' "${ENVIRONMENT}-${PROJECT_NAME}-dynamodb-access-policy"

echo "=== Importing DynamoDB Tables ==="
# Import DynamoDB tables (in case any are still missing)
TABLES=(
    "projects"
    "user-flows"
    "high-level-requirements"
    "low-level-requirements"
    "test-cases"
    "waitlist"
)

for table in "${TABLES[@]}"; do
    full_table_name="${ENVIRONMENT}-${PROJECT_NAME}-${table}"
    echo "Importing table: $full_table_name"
    terraform import "aws_dynamodb_table.tables[\"$table\"]" "$full_table_name" 2>/dev/null || echo "Table $table already imported or doesn't exist"
done

echo "Import complete! Run 'terraform plan' to verify no changes are needed."
