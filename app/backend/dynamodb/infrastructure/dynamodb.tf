# DynamoDB Tables Infrastructure
# Replaces PostgreSQL RDS with DynamoDB for serverless database

# ==================================================
# DYNAMODB TABLES
# ==================================================

# Projects Table
resource "aws_dynamodb_table" "projects" {
  name           = "${var.environment}-${var.project_name}-projects"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  range_key      = "user_id"

  attribute {
    name = "id"
    type = "S"  # String for UUID
  }

  attribute {
    name = "user_id"
    type = "S"  # String for Cognito user ID
  }

  # Global Secondary Index for querying by user_id
  global_secondary_index {
    name            = "user_id-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying by name
  global_secondary_index {
    name            = "name-index"
    hash_key        = "name"
    projection_type = "ALL"
  }

  tags = merge(var.common_tags, {
    Name = "${var.environment}-${var.project_name}-projects-table"
  })
}

# User Flows Table
resource "aws_dynamodb_table" "user_flows" {
  name           = "${var.environment}-${var.project_name}-user-flows"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "uiid"
  range_key      = "project_id"

  attribute {
    name = "uiid"
    type = "S"  # String for UUID
  }

  attribute {
    name = "project_id"
    type = "S"  # String for project ID
  }

  # Global Secondary Index for querying by project_id
  global_secondary_index {
    name            = "project_id-index"
    hash_key        = "project_id"
    projection_type = "ALL"
  }

  tags = merge(var.common_tags, {
    Name = "${var.environment}-${var.project_name}-user-flows-table"
  })
}

# High Level Requirements Table
resource "aws_dynamodb_table" "high_level_requirements" {
  name           = "${var.environment}-${var.project_name}-high-level-requirements"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "uiid"
  range_key      = "parent_uiid"

  attribute {
    name = "uiid"
    type = "S"  # String for UUID
  }

  attribute {
    name = "parent_uiid"
    type = "S"  # String for parent user flow UIID
  }

  # Global Secondary Index for querying by parent_uiid
  global_secondary_index {
    name            = "parent_uiid-index"
    hash_key        = "parent_uiid"
    projection_type = "ALL"
  }

  tags = merge(var.common_tags, {
    Name = "${var.environment}-${var.project_name}-high-level-requirements-table"
  })
}

# Low Level Requirements Table
resource "aws_dynamodb_table" "low_level_requirements" {
  name           = "${var.environment}-${var.project_name}-low-level-requirements"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "uiid"
  range_key      = "parent_uiid"

  attribute {
    name = "uiid"
    type = "S"  # String for UUID
  }

  attribute {
    name = "parent_uiid"
    type = "S"  # String for parent high level requirement UIID
  }

  # Global Secondary Index for querying by parent_uiid
  global_secondary_index {
    name            = "parent_uiid-index"
    hash_key        = "parent_uiid"
    projection_type = "ALL"
  }

  tags = merge(var.common_tags, {
    Name = "${var.environment}-${var.project_name}-low-level-requirements-table"
  })
}

# Test Cases Table
resource "aws_dynamodb_table" "test_cases" {
  name           = "${var.environment}-${var.project_name}-test-cases"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "uiid"
  range_key      = "parent_uiid"

  attribute {
    name = "uiid"
    type = "S"  # String for UUID
  }

  attribute {
    name = "parent_uiid"
    type = "S"  # String for parent low level requirement UIID
  }

  # Global Secondary Index for querying by parent_uiid
  global_secondary_index {
    name            = "parent_uiid-index"
    hash_key        = "parent_uiid"
    projection_type = "ALL"
  }

  tags = merge(var.common_tags, {
    Name = "${var.environment}-${var.project_name}-test-cases-table"
  })
}

# Waitlist Table
resource "aws_dynamodb_table" "waitlist" {
  name           = "${var.environment}-${var.project_name}-waitlist"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "email"

  attribute {
    name = "email"
    type = "S"  # String for email
  }

  # Global Secondary Index for querying by status
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }

  tags = merge(var.common_tags, {
    Name = "${var.environment}-${var.project_name}-waitlist-table"
  })
} 