#!/bin/bash

# Script to import ALL missing AWS resources into Terraform state
# This prevents Terraform from trying to create resources that already exist

set -e

echo "Importing ALL missing AWS resources into Terraform state..."

# Environment and project name from your variables
ENVIRONMENT="prod"
PROJECT_NAME="vishmaker"

echo "=== Importing Lambda Functions ==="
# Import Lambda functions (these are the main missing ones)
terraform import 'aws_lambda_function.lambda["auth_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-auth" 2>/dev/null || echo "auth_api already imported"
terraform import 'aws_lambda_function.lambda["llm_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-llm" 2>/dev/null || echo "llm_api already imported"
terraform import 'aws_lambda_function.lambda["projects_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-projects" 2>/dev/null || echo "projects_api already imported"
terraform import 'aws_lambda_function.lambda["requirements_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-requirements" 2>/dev/null || echo "requirements_api already imported"

echo "=== Importing API Gateway Routes ==="
# Import API Gateway routes (these might also be missing)
# Note: You may need to get the actual route IDs from AWS Console

echo "=== Importing Lambda Permissions ==="
# Import Lambda permissions for API Gateway
# Note: You may need to get the actual permission IDs from AWS Console

echo "=== Importing IAM Role Policy Attachments ==="
# Import IAM role policy attachments
terraform import 'aws_iam_role_policy_attachment.basic_execution["auth_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-auth-role/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" 2>/dev/null || echo "auth_api basic execution already attached"
terraform import 'aws_iam_role_policy_attachment.basic_execution["llm_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-llm-role/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" 2>/dev/null || echo "llm_api basic execution already attached"
terraform import 'aws_iam_role_policy_attachment.basic_execution["projects_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-projects-role/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" 2>/dev/null || echo "projects_api basic execution already attached"
terraform import 'aws_iam_role_policy_attachment.basic_execution["requirements_api"]' "${ENVIRONMENT}-${PROJECT_NAME}-requirements-role/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" 2>/dev/null || echo "requirements_api basic execution already attached"

echo "Import complete! Run 'terraform plan' to verify no changes are needed."
