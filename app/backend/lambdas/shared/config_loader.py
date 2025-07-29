import json
import os
import boto3
from typing import Dict, Any, Optional
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

class ConfigLoader:
    """Unified configuration loader for Lambda functions."""
    
    def __init__(self):
        self.s3_client = None
        self._config_cache = {}
    
    @property
    def s3(self):
        """Lazy initialization of S3 client."""
        if self.s3_client is None:
            self.s3_client = boto3.client('s3')
        return self.s3_client
    
    @lru_cache(maxsize=1)
    def load_config(self) -> Dict[str, Any]:
        """
        Load configuration from multiple sources in order of preference:
        1. Environment variables (for Lambda)
        2. S3 bucket (for Lambda)
        3. Local file (for development)
        """
        # Try to load from S3 first (Lambda environment)
        if self._is_lambda_environment():
            try:
                return self._load_from_s3()
            except Exception as e:
                logger.warning(f"Failed to load config from S3: {e}")
        
        # Fallback to local file (development)
        try:
            return self._load_from_local_file()
        except Exception as e:
            logger.error(f"Failed to load config from local file: {e}")
            # Return minimal default config
            return self._get_default_config()
    
    def _is_lambda_environment(self) -> bool:
        """Check if running in Lambda environment."""
        return bool(os.environ.get('AWS_LAMBDA_FUNCTION_NAME'))
    
    def _load_from_s3(self) -> Dict[str, Any]:
        """Load configuration from S3 bucket."""
        bucket = os.environ.get('CONFIG_BUCKET')
        key = os.environ.get('CONFIG_KEY', 'config.json')
        
        if not bucket:
            raise ValueError("CONFIG_BUCKET environment variable not set")
        
        logger.info(f"Loading config from S3: s3://{bucket}/{key}")
        
        try:
            response = self.s3.get_object(Bucket=bucket, Key=key)
            config_data = response['Body'].read().decode('utf-8')
            config = json.loads(config_data)
            
            logger.info("Successfully loaded config from S3")
            return config
            
        except Exception as e:
            logger.error(f"Error loading config from S3: {e}")
            raise
    
    def _load_from_local_file(self) -> Dict[str, Any]:
        """Load configuration from local file."""
        # Try multiple possible locations
        possible_paths = [
            'aws_cloud_provisioning_kit/config/config.json',
            'config/config.json',
            'global/config.json',
            '../config/config.json',
            '../../config/config.json'
        ]
        
        for config_path in possible_paths:
            if os.path.exists(config_path):
                logger.info(f"Loading config from local file: {config_path}")
                
                with open(config_path, 'r') as f:
                    config = json.load(f)
                
                logger.info("Successfully loaded config from local file")
                return config
        
        raise FileNotFoundError(f"Config file not found in any of: {possible_paths}")
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return minimal default configuration."""
        return {
            "project": {
                "name": "vishmaker",
                "environment": "dev"
            },
            "aws": {
                "region": os.environ.get('AWS_REGION', 'us-east-1')
            },
            "lambda": {
                "timeout_seconds": 60,
                "memory_mb": 512
            }
        }
    
    def get_database_config(self) -> Dict[str, Any]:
        """Get database-specific configuration."""
        config = self.load_config()
        
        return {
            'endpoint': os.environ.get('DB_ENDPOINT'),
            'database': os.environ.get('DB_NAME', config.get('rds', {}).get('database', 'vishmaker')),
            'username': os.environ.get('DB_USERNAME', config.get('rds', {}).get('username', 'vishmaker_user')),
            'secret_arn': os.environ.get('DATABASE_SECRET_ARN'),
            'engine': config.get('rds', {}).get('engine', 'postgres')
        }
    
    def get_cognito_config(self) -> Dict[str, Any]:
        """Get Cognito-specific configuration."""
        config = self.load_config()
        
        return {
            'region': os.environ.get('AWS_REGION', config.get('aws', {}).get('region', 'us-east-1')),
            'user_pool_id': os.environ.get('COGNITO_USER_POOL_ID'),
            'client_id': os.environ.get('COGNITO_CLIENT_ID'),
            'password_policy': config.get('cognito', {}).get('password_policy', {}),
            'token_validity': config.get('cognito', {}).get('token_validity', {})
        }
    
    def get_llm_config(self) -> Dict[str, Any]:
        """Get LLM-specific configuration."""
        config = self.load_config()
        
        return {
            'secret_arn': os.environ.get('LLM_SECRET_ARN'),
            'bedrock': config.get('llm', {}).get('bedrock', {}),
            'component_model_mapping': config.get('llm', {}).get('component_model_mapping', {})
        }
    
    def get_lambda_config(self, lambda_name: str) -> Dict[str, Any]:
        """Get Lambda-specific configuration."""
        config = self.load_config()
        lambda_config = config.get('lambda', {})
        
        return {
            'function_name': os.environ.get('AWS_LAMBDA_FUNCTION_NAME', lambda_name),
            'timeout': lambda_config.get('timeout_seconds', 60),
            'memory': lambda_config.get('memory_mb', 512),
            'environment_variables': lambda_config.get('environment_variables', {})
        }

# Global config loader instance
config_loader = ConfigLoader()

# Convenience functions for common config access
@lru_cache(maxsize=1)
def get_app_config() -> Dict[str, Any]:
    """Get the full application configuration."""
    return config_loader.load_config()

@lru_cache(maxsize=1)
def get_db_config() -> Dict[str, Any]:
    """Get database configuration."""
    return config_loader.get_database_config()

@lru_cache(maxsize=1)
def get_auth_config() -> Dict[str, Any]:
    """Get authentication configuration."""
    return config_loader.get_cognito_config()

@lru_cache(maxsize=1)
def get_llm_config() -> Dict[str, Any]:
    """Get LLM configuration."""
    return config_loader.get_llm_config()

def get_project_name() -> str:
    """Get project name from config or environment."""
    config = get_app_config()
    return os.environ.get('PROJECT_NAME', config.get('project', {}).get('name', 'vishmaker'))

def get_environment() -> str:
    """Get environment name from config or environment."""
    config = get_app_config()
    return os.environ.get('ENVIRONMENT', config.get('project', {}).get('environment', 'dev'))

def get_api_v1_str() -> str:
    """Get API version string."""
    return os.environ.get('API_V1_STR', '') 