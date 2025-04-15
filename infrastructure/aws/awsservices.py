"""
AWS services operations.
This module provides functions to interact with various AWS services.
"""

import os
import logging
import json
import boto3
from typing import Dict, Any
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(dotenv_path="global/.env")

# Setup logging
logger = logging.getLogger(__name__)

def load_config(config_path: str = "global/config.json") -> Dict[str, Any]:
    """Load configuration from JSON file."""
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config
    except Exception as e:
        logger.error(f"Error loading config: {str(e)}")
        raise

def get_aws_region() -> str:
    """Get AWS region from environment variables or config."""
    # First try from .env file
    region = os.environ.get("AWS_REGION")
    if region:
        return region
    
    # Then try from environment variables
    region = os.environ.get("AWS_DEFAULT_REGION")
    if region:
        return region
    
    # Finally, try from config.json
    try:
        config = load_config()
        region = config.get("aws", {}).get("region")
        if region:
            return region
    except Exception as e:
        logger.error(f"Error getting AWS region from config: {str(e)}")
    
    # Default to us-east-1 if nothing found
    return "us-east-1"

def get_aws_client(service_name: str) -> Any:
    """
    Get an AWS service client with proper credentials and region.
    
    Args:
        service_name: The AWS service name (e.g., 's3', 'lambda', etc.)
        
    Returns:
        AWS service client
    """
    try:
        region = get_aws_region()
        
        # Get AWS credentials from environment variables
        access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        
        # Create client with explicit credentials if available
        if access_key and secret_key:
            client = boto3.client(
                service_name,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region
            )
        else:
            client = boto3.client(service_name, region_name=region)
            
        return client
    except Exception as e:
        logger.error(f"Error creating AWS client for {service_name}: {str(e)}")
        raise

def get_s3_client() -> Any:
    """
    Get an S3 client with proper credentials and region.
    
    Returns:
        S3 client
    """
    return get_aws_client('s3')

def list_s3_buckets() -> Dict[str, Any]:
    """
    List all S3 buckets in the account.
    
    Returns:
        Dictionary with bucket information
    """
    try:
        s3 = get_s3_client()
        response = s3.list_buckets()
        
        buckets = response.get('Buckets', [])
        bucket_names = [bucket.get('Name') for bucket in buckets]
        
        return {
            "success": True,
            "bucket_count": len(buckets),
            "buckets": bucket_names
        }
    except Exception as e:
        logger.error(f"Error listing S3 buckets: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def upload_to_s3(bucket_name: str, file_path: str, object_key: str = None) -> Dict[str, Any]:
    """
    Upload a file to an S3 bucket.
    
    Args:
        bucket_name: Name of the S3 bucket
        file_path: Path to the file to upload
        object_key: Key to use for the object in S3 (defaults to file basename)
        
    Returns:
        Dictionary with upload result
    """
    try:
        if not os.path.exists(file_path):
            return {
                "success": False,
                "error": f"File not found: {file_path}"
            }
        
        # If no object_key provided, use the file's basename
        if not object_key:
            object_key = os.path.basename(file_path)
        
        s3 = get_s3_client()
        s3.upload_file(file_path, bucket_name, object_key)
        
        # Generate the URL to the uploaded file
        region = get_aws_region()
        url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{object_key}"
        
        return {
            "success": True,
            "bucket": bucket_name,
            "key": object_key,
            "url": url
        }
    except Exception as e:
        logger.error(f"Error uploading file to S3: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def download_from_s3(bucket_name: str, object_key: str, file_path: str) -> Dict[str, Any]:
    """
    Download a file from an S3 bucket.
    
    Args:
        bucket_name: Name of the S3 bucket
        object_key: Key of the object in S3
        file_path: Path where to save the file
        
    Returns:
        Dictionary with download result
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
        
        s3 = get_s3_client()
        s3.download_file(bucket_name, object_key, file_path)
        
        return {
            "success": True,
            "bucket": bucket_name,
            "key": object_key,
            "file_path": file_path
        }
    except Exception as e:
        logger.error(f"Error downloading file from S3: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def list_s3_objects(bucket_name: str, prefix: str = '') -> Dict[str, Any]:
    """
    List objects in an S3 bucket.
    
    Args:
        bucket_name: Name of the S3 bucket
        prefix: Prefix to filter objects (folder path)
        
    Returns:
        Dictionary with object information
    """
    try:
        s3 = get_s3_client()
        response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
        
        objects = response.get('Contents', [])
        object_keys = [obj.get('Key') for obj in objects]
        
        return {
            "success": True,
            "bucket": bucket_name,
            "prefix": prefix,
            "object_count": len(objects),
            "objects": object_keys
        }
    except Exception as e:
        logger.error(f"Error listing objects in S3 bucket: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def delete_s3_object(bucket_name: str, object_key: str) -> Dict[str, Any]:
    """
    Delete an object from an S3 bucket.
    
    Args:
        bucket_name: Name of the S3 bucket
        object_key: Key of the object in S3
        
    Returns:
        Dictionary with delete result
    """
    try:
        s3 = get_s3_client()
        s3.delete_object(Bucket=bucket_name, Key=object_key)
        
        return {
            "success": True,
            "bucket": bucket_name,
            "key": object_key,
            "message": f"Object {object_key} deleted from bucket {bucket_name}"
        }
    except Exception as e:
        logger.error(f"Error deleting object from S3: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        } 