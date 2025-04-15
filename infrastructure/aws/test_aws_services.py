"""
Test AWS Services connectivity and functionality.
This script provides tests for various AWS services used in the application.
"""

import boto3
import os
import logging
import sys
import argparse
from dotenv import load_dotenv
from infrastructure.aws.awsservices import (
    get_aws_region,
    get_aws_client,
    get_s3_client,
    list_s3_buckets,
    list_s3_objects
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(dotenv_path="global/.env")

def check_aws_credentials():
    """Check AWS credentials and print diagnostic information."""
    logger.info("Checking AWS credentials...")
    
    # Check AWS credentials
    access_key = os.environ.get('AWS_ACCESS_KEY_ID')
    secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
    session_token = os.environ.get('AWS_SESSION_TOKEN')
    region = os.environ.get('AWS_REGION')
    
    logger.info(f"AWS_ACCESS_KEY_ID is {'set' if access_key else 'not set'}")
    logger.info(f"AWS_SECRET_ACCESS_KEY is {'set' if secret_key else 'not set'}")
    logger.info(f"AWS_SESSION_TOKEN is {'set' if session_token else 'not set'}")
    logger.info(f"AWS_REGION is {'set' if region else 'not set'}")
    
    # Will use AWS credentials if available
    if access_key and secret_key:
        logger.info("Using AWS credentials for connection")
        return {
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "region_name": region or get_aws_region()
        }
    
    # Otherwise, check AWS credential provider chain
    try:
        session = boto3.Session()
        credentials = session.get_credentials()
        if credentials:
            logger.info(f"Credential provider used: {credentials.method}")
            # Only show last 4 characters of access key if available
            if hasattr(credentials, 'access_key') and credentials.access_key:
                masked_key = f"...{credentials.access_key[-4:]}"
                logger.info(f"Using access key: {masked_key}")
            return None  # Let boto3 use the default credential provider chain
        else:
            logger.warning("No AWS credentials found via boto3 credential provider chain")
            return None
    except Exception as e:
        logger.error(f"Error checking AWS credentials: {str(e)}")
        return None

def test_s3_connection():
    """Test connection to AWS S3."""
    logger.info("\n=== Testing AWS S3 Connection ===")
    try:
        # Check credentials first
        check_aws_credentials()
        
        # Get region
        region = get_aws_region()
        logger.info(f"Using AWS region: {region}")
        
        # List buckets
        result = list_s3_buckets()
        
        if result.get("success", False):
            logger.info(f"Successfully connected to AWS S3")
            logger.info(f"Found {result.get('bucket_count', 0)} buckets:")
            
            for bucket in result.get('buckets', []):
                logger.info(f"  - {bucket}")
            
            return True
        else:
            logger.error(f"Failed to list S3 buckets: {result.get('error', 'Unknown error')}")
            return False
        
    except Exception as e:
        logger.error(f"Error connecting to AWS S3: {str(e)}")
        return False

def test_s3_objects(bucket_name):
    """Test listing objects in an S3 bucket."""
    logger.info(f"\n=== Testing S3 Objects in Bucket {bucket_name} ===")
    try:
        # List objects
        result = list_s3_objects(bucket_name)
        
        if result.get("success", False):
            logger.info(f"Successfully listed objects in bucket {bucket_name}")
            logger.info(f"Found {result.get('object_count', 0)} objects")
            
            # Only show first 10 objects to avoid log spam
            objects = result.get('objects', [])[:10]
            for obj in objects:
                logger.info(f"  - {obj}")
            
            if len(result.get('objects', [])) > 10:
                logger.info(f"  ... and {len(result.get('objects', [])) - 10} more")
            
            return True
        else:
            logger.error(f"Failed to list objects: {result.get('error', 'Unknown error')}")
            return False
        
    except Exception as e:
        logger.error(f"Error listing S3 objects: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Test AWS Services')
    parser.add_argument('--all', action='store_true', help='Run all tests')
    parser.add_argument('--s3', action='store_true', help='Test AWS S3 connection')
    parser.add_argument('--bucket', type=str, help='S3 bucket name to test with')
    
    args = parser.parse_args()
    
    # If no specific test is selected, run all tests
    if not (args.all or args.s3):
        args.all = True
    
    results = {}
    
    if args.all or args.s3:
        results['s3_connection'] = test_s3_connection()
    
    # If bucket name is provided, test listing objects
    if args.bucket:
        results['s3_objects'] = test_s3_objects(args.bucket)
    
    # Print summary
    logger.info("\n=== Test Results Summary ===")
    success = True
    for test, result in results.items():
        logger.info(f"{test.replace('_', ' ').title()}: {'PASS' if result else 'FAIL'}")
        success = success and result
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main()) 