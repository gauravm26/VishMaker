"""
DynamoDB package for VishMaker
Replaces PostgreSQL database with DynamoDB for serverless architecture

This package contains:
- Infrastructure: Terraform configuration for DynamoDB tables
- Core functionality: Connection management and CRUD operations
- Models are now in individual lambda functions
"""

__version__ = "1.0.0"
__author__ = "VishMaker Team"

# Export core functionality
from .code.dynamodb_core import (
    get_table,
    check_table_exists,
    list_all_tables,
    test_connection,
    create_item,
    get_item,
    update_item,
    delete_item,
    query_items,
    scan_items,
    generate_uuid,
    format_timestamp,
    parse_timestamp,
    check_all_tables_exist,
    get_table_info,
    TABLE_NAMES
)

__all__ = [
    'get_table',
    'check_table_exists',
    'list_all_tables',
    'test_connection',
    'create_item',
    'get_item',
    'update_item',
    'delete_item',
    'query_items',
    'scan_items',
    'generate_uuid',
    'format_timestamp',
    'parse_timestamp',
    'check_all_tables_exist',
    'get_table_info',
    'TABLE_NAMES'
] 