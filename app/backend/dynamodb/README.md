# DynamoDB Package for VishMaker

This package replaces the PostgreSQL database with DynamoDB for a serverless architecture.

## 📋 Overview

The DynamoDB package provides:
- **Infrastructure**: Terraform configuration for DynamoDB tables
- **Core functionality**: Connection management, CRUD operations, and utilities
- **Models**: Located in individual lambda functions (not in this package)

## 🏗️ Architecture

### Package Structure

```
app/backend/dynamodb/
├── infrastructure/          # Terraform configuration
│   ├── dynamodb.tf         # DynamoDB tables
│   ├── variables.tf        # Module variables
│   └── outputs.tf          # Table names and ARNs
├── code/                   # Core functionality (renamed from core)
│   ├── __init__.py
│   └── dynamodb_core.py    # Core DynamoDB operations
├── requirements.txt        # Dependencies
├── README.md              # Documentation
└── __init__.py            # Package exports
```

### Models Location

Models are now located in individual lambda functions:

```
app/backend/lambdas/users/code/models/
├── __init__.py
├── requirement.py          # Project, UserFlow, Requirements, TestCases
└── waitlist.py            # Waitlist functionality
```

### Tables Structure

1. **Projects Table**
   - Primary Key: `id` (UUID)
   - Sort Key: `user_id` (Cognito user ID)
   - GSIs: `user_id-index`, `name-index`

2. **User Flows Table**
   - Primary Key: `uiid` (UUID)
   - Sort Key: `project_id` (Project ID)
   - GSI: `project_id-index`

3. **High Level Requirements Table**
   - Primary Key: `uiid` (UUID)
   - Sort Key: `parent_uiid` (User Flow UIID)
   - GSI: `parent_uiid-index`

4. **Low Level Requirements Table**
   - Primary Key: `uiid` (UUID)
   - Sort Key: `parent_uiid` (High Level Requirement UIID)
   - GSI: `parent_uiid-index`

5. **Test Cases Table**
   - Primary Key: `uiid` (UUID)
   - Sort Key: `parent_uiid` (Low Level Requirement UIID)
   - GSI: `parent_uiid-index`

6. **Waitlist Table**
   - Primary Key: `email` (Email address)
   - GSI: `status-index`

## 🚀 Usage

### Basic Setup

```python
from dynamodb import test_connection, check_all_tables_exist

# Test connection
connection = test_connection()
print(connection['message'])

# Check tables
tables = check_all_tables_exist()
print(tables['message'])
```

### In Lambda Functions

```python
# In users lambda
from models.requirement import ProjectEntity, ProjectCreate
from models.waitlist import WaitlistEntity, WaitlistCreate

# Create a project
project_data = ProjectCreate(
    name="My Project",
    initial_prompt="Create a web app",
    user_id="user123"
)
result = ProjectEntity.create(project_data)

# Add to waitlist
waitlist_data = WaitlistCreate(
    email="user@example.com",
    status="pending"
)
result = WaitlistEntity.create(waitlist_data)
```

## 🔧 Infrastructure

### Deploy DynamoDB Tables

```bash
# Navigate to infrastructure directory
cd app/backend/dynamodb/infrastructure

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply deployment
terraform apply
```

### Environment Variables

Set these environment variables in your lambda functions:

```bash
# AWS Configuration
AWS_REGION=us-east-1

# DynamoDB Table Names (optional - defaults provided)
PROJECTS_TABLE_NAME=prod-vishmaker-projects
USER_FLOWS_TABLE_NAME=prod-vishmaker-user-flows
HIGH_LEVEL_REQUIREMENTS_TABLE_NAME=prod-vishmaker-high-level-requirements
LOW_LEVEL_REQUIREMENTS_TABLE_NAME=prod-vishmaker-low-level-requirements
TEST_CASES_TABLE_NAME=prod-vishmaker-test-cases
WAITLIST_TABLE_NAME=prod-vishmaker-waitlist
```

## 📊 Key Differences from PostgreSQL

### Advantages
- **Serverless**: No database management required
- **Scalability**: Automatic scaling based on demand
- **Cost**: Pay-per-request pricing
- **Integration**: Native AWS service integration

### Considerations
- **Query Limitations**: No complex SQL queries
- **Relationships**: No foreign key constraints
- **Transactions**: Limited transaction support
- **Data Types**: Limited data type support

## 🔍 Monitoring

### CloudWatch Metrics
- `ConsumedReadCapacityUnits`
- `ConsumedWriteCapacityUnits`
- `ThrottledRequests`
- `ProvisionedReadCapacityUnits`
- `ProvisionedWriteCapacityUnits`

### Table Status
```python
from dynamodb import get_table_info

# Get table information
info = get_table_info("prod-vishmaker-projects")
print(f"Status: {info['data']['table_status']}")
print(f"Item Count: {info['data']['item_count']}")
```

## 🧪 Testing

### Run Core Tests
```bash
cd app/backend/dynamodb
python -m code.dynamodb_core
```

### Test Models in Lambda
```python
# In users lambda
from models.requirement import ProjectEntity, ProjectCreate

# Test project creation
project_data = ProjectCreate(
    name="Test Project",
    user_id="test-user"
)
result = ProjectEntity.create(project_data)
assert result['status'] == 'success'
```

## 📝 Migration from PostgreSQL

### Data Migration
1. Export data from PostgreSQL
2. Transform data to DynamoDB format
3. Import data using AWS CLI or SDK

### Code Migration
1. Replace SQLAlchemy imports with DynamoDB models
2. Update CRUD operations to use entity classes
3. Replace SQL queries with DynamoDB queries
4. Update environment variables

## 🔐 Security

### IAM Permissions
Ensure Lambda functions have appropriate DynamoDB permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:us-east-1:123456789012:table/prod-vishmaker-*"
            ]
        }
    ]
}
```

## 📚 API Reference

### Core Functions
- `code/dynamodb_core.py` - Core functionality

### Models (in lambda functions)
- `lambdas/users/code/models/requirement.py` - Requirement models
- `lambdas/users/code/models/waitlist.py` - Waitlist models

## 🔄 Recent Changes

- **Renamed**: `core/` → `code/` to follow standards
- **Moved**: Models from `dynamodb/models/` to `lambdas/users/code/models/`
- **Updated**: Import paths in all lambda functions
- **Improved**: Package structure and organization 