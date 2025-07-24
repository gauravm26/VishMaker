"""Minimal DynamoDB helpers for storing requirements."""
import os
import boto3
from botocore.exceptions import BotoCoreError, ClientError

_TABLE_NAME = os.getenv("REQUIREMENTS_TABLE")
_REGION = os.getenv("AWS_REGION", "us-east-1")

if _TABLE_NAME:
    _resource = boto3.resource("dynamodb", region_name=_REGION)
    _table = _resource.Table(_TABLE_NAME)
else:
    _resource = None
    _table = None


def save_requirement(item: dict) -> None:
    """Save a requirement item to DynamoDB if configured."""
    if not _table:
        return
    try:
        _table.put_item(Item=item)
    except (BotoCoreError, ClientError) as e:
        # Log and ignore DynamoDB errors
        print(f"Failed to put item to DynamoDB: {e}")

