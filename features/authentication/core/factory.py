import os
import json
from functools import lru_cache

from ..adapters.cognito_adapter import CognitoAdapter
from ..adapters.local_adapter import LocalAuthAdapter

@lru_cache(maxsize=1)
def get_auth_config():
    """
    Loads authentication configuration from a JSON file.
    The path to the config file is determined by the `AUTH_CONFIG_PATH` environment variable.
    """
    config_path = os.environ.get('AUTH_CONFIG_PATH', 'global/config.json')
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config.get('cloud', {}).get('aws', {})
    except FileNotFoundError:
        raise RuntimeError(f"Authentication config file not found at {config_path}")
    except json.JSONDecodeError:
        raise RuntimeError(f"Invalid JSON in config file at {config_path}")

@lru_cache(maxsize=1)
def get_auth_service():
    """
    Factory function to create and return an instance of the authentication adapter.
    For testing, uses LocalAuthAdapter. For production, uses CognitoAdapter.
    """
    # Check if we're in testing mode
    use_local = os.environ.get('USE_LOCAL_AUTH', 'true').lower() == 'true'
    
    if use_local:
        print("Using LocalAuthAdapter for testing")
        return LocalAuthAdapter()
    
    # Use Cognito for production
    aws_config = get_auth_config()
    
    region = aws_config.get('aws_region')
    user_pool_id = aws_config.get('user_pool_id')
    client_id = aws_config.get('client_id')

    if not all([region, user_pool_id, client_id]):
        raise RuntimeError("Missing required AWS Cognito configuration in config file")

    return CognitoAdapter(
        region=region,
        user_pool_id=user_pool_id,
        client_id=client_id
    ) 