#!/usr/bin/env python3
"""
DynamoDB core module with connection setup and helper functions
Replaces PostgreSQL db_core.py with DynamoDB equivalent
"""
import os
import sys
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from pathlib import Path

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add parent directory to path for importing modules
parent_dir = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(parent_dir))

# Load environment variables from Global/.env
env_path = parent_dir / 'Global' / '.env'
load_dotenv(env_path)

#--------------------------------
# DynamoDB setup
#--------------------------------

# Get AWS region from environment
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Initialize DynamoDB client
try:
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    dynamodb_client = boto3.client('dynamodb', region_name=AWS_REGION)
    logger.info(f"DynamoDB client initialized for region: {AWS_REGION}")
except NoCredentialsError:
    logger.error("AWS credentials not found. Please configure AWS credentials.")
    raise
except Exception as e:
    logger.error(f"Failed to initialize DynamoDB client: {str(e)}")
    raise

# Table names (will be set from environment variables)
TABLE_NAMES = {
    'projects': os.getenv('PROJECTS_TABLE_NAME', 'prod-vishmaker-projects'),
    'user-flows': os.getenv('USER_FLOWS_TABLE_NAME', 'prod-vishmaker-user-flows'),
    'high-level-requirements': os.getenv('HIGH_LEVEL_REQUIREMENTS_TABLE_NAME', 'prod-vishmaker-high-level-requirements'),
    'low-level-requirements': os.getenv('LOW_LEVEL_REQUIREMENTS_TABLE_NAME', 'prod-vishmaker-low-level-requirements'),
    'test-cases': os.getenv('TEST_CASES_TABLE_NAME', 'prod-vishmaker-test-cases'),
    'waitlist': os.getenv('WAITLIST_TABLE_NAME', 'prod-vishmaker-waitlist')
}

#--------------------------------
# Connection utilities
#--------------------------------

def get_table(table_name: str):
    """Get DynamoDB table resource"""
    try:
        table = dynamodb.Table(table_name)
        # Test the table exists by describing it
        table.load()
        return table
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            logger.error(f"Table {table_name} not found")
            raise
        else:
            logger.error(f"Error accessing table {table_name}: {str(e)}")
            raise
    except Exception as e:
        logger.error(f"Unexpected error accessing table {table_name}: {str(e)}")
        raise

def check_table_exists(table_name: str) -> bool:
    """Check if a DynamoDB table exists"""
    try:
        table = dynamodb.Table(table_name)
        table.load()
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            return False
        else:
            logger.error(f"Error checking table {table_name}: {str(e)}")
            return False
    except Exception as e:
        logger.error(f"Unexpected error checking table {table_name}: {str(e)}")
        return False

def list_all_tables() -> List[str]:
    """List all DynamoDB tables"""
    try:
        response = dynamodb_client.list_tables()
        return response.get('TableNames', [])
    except Exception as e:
        logger.error(f"Error listing tables: {str(e)}")
        return []

def test_connection() -> Dict[str, str]:
    """Test the DynamoDB connection and return connection status"""
    try:
        # Try to list tables to test connection
        tables = list_all_tables()
        return {
            "status": "success", 
            "message": f"Successfully connected to DynamoDB. Found {len(tables)} tables."
        }
    except Exception as e:
        return {
            "status": "error", 
            "message": f"DynamoDB connection error: {str(e)}"
        }

#--------------------------------
# Generic CRUD operations
#--------------------------------

def create_item(table_name: str, item: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new item in DynamoDB table"""
    try:
        table = get_table(table_name)
        
        # Add timestamps if not present
        if 'created_at' not in item:
            item['created_at'] = datetime.now(timezone.utc).isoformat()
        if 'updated_at' not in item:
            item['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        response = table.put_item(Item=item)
        logger.info(f"Created item in {table_name}: {item.get('id', item.get('uiid', item.get('email', 'unknown')))}")
        return {"status": "success", "data": item}
    except Exception as e:
        logger.error(f"Error creating item in {table_name}: {str(e)}")
        return {"status": "error", "message": str(e)}

def get_item(table_name: str, key: Dict[str, Any]) -> Dict[str, Any]:
    """Get an item from DynamoDB table"""
    try:
        table = get_table(table_name)
        response = table.get_item(Key=key)
        
        if 'Item' in response:
            return {"status": "success", "data": response['Item']}
        else:
            return {"status": "not_found", "message": "Item not found"}
    except Exception as e:
        logger.error(f"Error getting item from {table_name}: {str(e)}")
        return {"status": "error", "message": str(e)}

def update_item(table_name: str, key: Dict[str, Any], update_expression: str, 
                expression_attribute_values: Dict[str, Any]) -> Dict[str, Any]:
    """Update an item in DynamoDB table"""
    try:
        table = get_table(table_name)
        
        # Add updated_at timestamp
        if 'updated_at' not in expression_attribute_values:
            expression_attribute_values[':updated_at'] = datetime.now(timezone.utc).isoformat()
            if 'updated_at' not in update_expression:
                update_expression += ", updated_at = :updated_at"
        
        response = table.update_item(
            Key=key,
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues="ALL_NEW"
        )
        
        logger.info(f"Updated item in {table_name}: {key}")
        return {"status": "success", "data": response.get('Attributes', {})}
    except Exception as e:
        logger.error(f"Error updating item in {table_name}: {str(e)}")
        return {"status": "error", "message": str(e)}

def delete_item(table_name: str, key: Dict[str, Any]) -> Dict[str, Any]:
    """Delete an item from DynamoDB table"""
    try:
        table = get_table(table_name)
        response = table.delete_item(Key=key)
        
        logger.info(f"Deleted item from {table_name}: {key}")
        return {"status": "success", "message": "Item deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting item from {table_name}: {str(e)}")
        return {"status": "error", "message": str(e)}

def query_items(table_name: str, key_condition_expression: str, 
                expression_attribute_values: Dict[str, Any] = None,
                index_name: str = None) -> Dict[str, Any]:
    """Query items from DynamoDB table"""
    try:
        table = get_table(table_name)
        
        query_kwargs = {
            'KeyConditionExpression': key_condition_expression
        }
        
        if expression_attribute_values:
            query_kwargs['ExpressionAttributeValues'] = expression_attribute_values
        
        if index_name:
            query_kwargs['IndexName'] = index_name
        
        response = table.query(**query_kwargs)
        
        return {
            "status": "success", 
            "data": response.get('Items', []),
            "count": response.get('Count', 0),
            "scanned_count": response.get('ScannedCount', 0)
        }
    except Exception as e:
        logger.error(f"Error querying items from {table_name}: {str(e)}")
        return {"status": "error", "message": str(e)}

def scan_items(table_name: str, filter_expression: str = None,
               expression_attribute_values: Dict[str, Any] = None) -> Dict[str, Any]:
    """Scan items from DynamoDB table"""
    try:
        table = get_table(table_name)
        
        scan_kwargs = {}
        
        if filter_expression:
            scan_kwargs['FilterExpression'] = filter_expression
        
        if expression_attribute_values:
            scan_kwargs['ExpressionAttributeValues'] = expression_attribute_values
        
        response = table.scan(**scan_kwargs)
        
        return {
            "status": "success", 
            "data": response.get('Items', []),
            "count": response.get('Count', 0),
            "scanned_count": response.get('ScannedCount', 0)
        }
    except Exception as e:
        logger.error(f"Error scanning items from {table_name}: {str(e)}")
        return {"status": "error", "message": str(e)}

#--------------------------------
# Utility functions
#--------------------------------

def generate_uuid() -> str:
    """Generate a UUID string"""
    return str(uuid.uuid4())

def format_timestamp(dt: datetime = None) -> str:
    """Format datetime to ISO string"""
    if dt is None:
        dt = datetime.now(timezone.utc)
    return dt.isoformat()

def parse_timestamp(timestamp_str: str) -> datetime:
    """Parse ISO timestamp string to datetime"""
    return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))

#--------------------------------
# Table management
#--------------------------------

def check_all_tables_exist() -> Dict[str, Any]:
    """Check if all required tables exist"""
    missing_tables = []
    existing_tables = []
    
    for table_type, table_name in TABLE_NAMES.items():
        if check_table_exists(table_name):
            existing_tables.append(table_name)
        else:
            missing_tables.append(table_name)
    
    if missing_tables:
        return {
            "status": "error",
            "message": f"Missing tables: {', '.join(missing_tables)}",
            "missing_tables": missing_tables,
            "existing_tables": existing_tables
        }
    else:
        return {
            "status": "success",
            "message": f"All {len(existing_tables)} tables exist",
            "existing_tables": existing_tables
        }

def get_table_info(table_name: str) -> Dict[str, Any]:
    """Get detailed information about a table"""
    try:
        response = dynamodb_client.describe_table(TableName=table_name)
        table_info = response['Table']
        
        return {
            "status": "success",
            "data": {
                "table_name": table_info['TableName'],
                "table_arn": table_info['TableArn'],
                "table_status": table_info['TableStatus'],
                "item_count": table_info.get('ItemCount', 0),
                "billing_mode": table_info.get('BillingModeSummary', {}).get('BillingMode', 'UNKNOWN'),
                "key_schema": table_info['KeySchema'],
                "attribute_definitions": table_info['AttributeDefinitions'],
                "global_secondary_indexes": table_info.get('GlobalSecondaryIndexes', [])
            }
        }
    except Exception as e:
        logger.error(f"Error getting table info for {table_name}: {str(e)}")
        return {"status": "error", "message": str(e)}

#--------------------------------
# Script execution
#--------------------------------

if __name__ == "__main__":
    # When run directly, check DynamoDB connection and tables
    print("\n=== DynamoDB Setup and Verification ===\n")
    
    # 1. Test connection
    connection = test_connection()
    print(f"Connection test: {connection['status']}")
    print(connection['message'])
    
    # 2. Check all tables exist
    if connection['status'] == 'success':
        print("\n--- Checking tables ---")
        table_check = check_all_tables_exist()
        print(f"Table check: {table_check['status']}")
        print(table_check['message'])
        
        if table_check['status'] == 'success':
            print("\n--- Table details ---")
            for table_name in table_check['existing_tables']:
                table_info = get_table_info(table_name)
                if table_info['status'] == 'success':
                    info = table_info['data']
                    print(f"  {info['table_name']}: {info['table_status']} ({info['item_count']} items)")
                else:
                    print(f"  {table_name}: Error getting info")
    
    print("\n=== Setup complete ===") 