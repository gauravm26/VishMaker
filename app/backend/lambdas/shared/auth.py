import os
import json
import jwt
import requests
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import lru_cache
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer()

@lru_cache()
def get_cognito_config():
    """Get Cognito configuration from environment variables."""
    print("🔐 DEBUG: Getting Cognito configuration from environment variables")
    config = {
        'region': os.environ.get('AWS_REGION', 'us-east-1'),
        'user_pool_id': os.environ.get('COGNITO_USER_POOL_ID'),
        'client_id': os.environ.get('COGNITO_CLIENT_ID')
    }
    print(f"🔐 DEBUG: Cognito config - region: {config['region']}, user_pool_id: {config['user_pool_id']}, client_id: {config['client_id']}")
    logger.info(f"Cognito config - region: {config['region']}, user_pool_id: {config['user_pool_id']}, client_id: {config['client_id']}")
    return config

@lru_cache()
def get_cognito_keys():
    """Fetch and cache Cognito public keys for JWT verification."""
    print("🔐 DEBUG: Fetching Cognito public keys")
    config = get_cognito_config()
    if not config['user_pool_id']:
        error_msg = "Cognito configuration not found"
        print(f"❌ DEBUG: {error_msg}")
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cognito configuration not found"
        )
    
    keys_url = f"https://cognito-idp.{config['region']}.amazonaws.com/{config['user_pool_id']}/.well-known/jwks.json"
    print(f"🔐 DEBUG: Fetching keys from URL: {keys_url}")
    logger.info(f"Fetching Cognito keys from: {keys_url}")
    
    try:
        print("🔐 DEBUG: Making HTTP request to fetch keys")
        response = requests.get(keys_url)
        print(f"🔐 DEBUG: HTTP response status: {response.status_code}")
        response.raise_for_status()
        keys = response.json()
        print(f"🔐 DEBUG: Successfully fetched keys, count: {len(keys.get('keys', []))}")
        logger.info(f"Successfully fetched {len(keys.get('keys', []))} Cognito keys")
        return keys
    except Exception as e:
        error_msg = f"Failed to fetch Cognito keys: {e}"
        print(f"❌ DEBUG: {error_msg}")
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch authentication keys"
        )

def verify_jwt_token(token: str) -> Dict[str, Any]:
    """Verify JWT token and return claims."""
    print("🔐 DEBUG: Starting JWT token verification")
    logger.info("Starting JWT token verification")
    
    config = get_cognito_config()
    print("🔐 DEBUG: Got Cognito config for verification")
    
    keys = get_cognito_keys()
    print("🔐 DEBUG: Got Cognito keys for verification")
    
    try:
        # Decode header to get key ID
        print("🔐 DEBUG: Decoding unverified header to get key ID")
        unverified_header = jwt.get_unverified_header(token)
        key_id = unverified_header.get('kid')
        print(f"🔐 DEBUG: Key ID from header: {key_id}")
        
        if not key_id:
            error_msg = "Invalid token: missing key ID"
            print(f"❌ DEBUG: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing key ID"
            )
        
        # Find the correct key
        print("🔐 DEBUG: Looking for matching key in keys list")
        key = None
        for k in keys.get('keys', []):
            if k.get('kid') == key_id:
                key = jwt.algorithms.RSAAlgorithm.from_jwk(k)
                print("🔐 DEBUG: Found matching key")
                break
        
        if not key:
            error_msg = "Invalid token: key not found"
            print(f"❌ DEBUG: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: key not found"
            )
        
        # Verify and decode token
        print("🔐 DEBUG: About to decode and verify token")
        issuer = f"https://cognito-idp.{config['region']}.amazonaws.com/{config['user_pool_id']}"
        print(f"🔐 DEBUG: Expected issuer: {issuer}")
        print(f"🔐 DEBUG: Expected audience: {config['client_id']}")
        
        claims = jwt.decode(
            token,
            key,
            algorithms=['RS256'],
            audience=config['client_id'],
            issuer=issuer
        )
        
        print(f"🔐 DEBUG: Token verification successful, claims keys: {list(claims.keys())}")
        logger.info(f"Token verification successful, claims keys: {list(claims.keys())}")
        return claims
        
    except jwt.ExpiredSignatureError as e:
        error_msg = f"Token has expired: {e}"
        print(f"❌ DEBUG: {error_msg}")
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        error_msg = f"Invalid token: {e}"
        print(f"❌ DEBUG: {error_msg}")
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        error_msg = f"Token verification error: {e}"
        print(f"❌ DEBUG: {error_msg}")
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed"
        )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Extract and validate user from JWT token."""
    print("🔐 DEBUG: Starting get_current_user")
    logger.info(f"🔐 Auth Debug: Starting get_current_user")
    
    try:
        # Remove 'Bearer ' prefix if present
        token = credentials.credentials
        print(f"🔐 DEBUG: Raw token length: {len(token)}")
        print(f"🔐 DEBUG: Token starts with Bearer: {token.startswith('Bearer ')}")
        logger.info(f"🔐 Auth Debug: Raw token length: {len(token)}")
        logger.info(f"🔐 Auth Debug: Token starts with Bearer: {token.startswith('Bearer ')}")
        
        if token.startswith('Bearer '):
            token = token[7:]
            print(f"🔐 DEBUG: Removed Bearer prefix, token length: {len(token)}")
            logger.info(f"🔐 Auth Debug: Removed Bearer prefix, token length: {len(token)}")
        
        print("🔐 DEBUG: About to verify JWT token")
        logger.info(f"🔐 Auth Debug: About to verify JWT token")
        claims = verify_jwt_token(token)
        print(f"🔐 DEBUG: JWT verification successful")
        logger.info(f"🔐 Auth Debug: JWT verification successful, claims: {claims}")
        
        # Extract user information from claims
        print("🔐 DEBUG: Extracting user information from claims")
        user_info = {
            'user_id': claims.get('sub'),  # Cognito user ID
            'email': claims.get('email'),
            'email_verified': claims.get('email_verified', False),
            'username': claims.get('cognito:username', claims.get('email')),
            'token_use': claims.get('token_use'),
            'exp': claims.get('exp')
        }
        
        print(f"🔐 DEBUG: Extracted user info - user_id: {user_info['user_id']}, email: {user_info['email']}, username: {user_info['username']}")
        logger.info(f"Extracted user info - user_id: {user_info['user_id']}, email: {user_info['email']}, username: {user_info['username']}")
        
        if not user_info['user_id']:
            error_msg = "Invalid token: missing user ID"
            print(f"❌ DEBUG: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        print("🔐 DEBUG: get_current_user completed successfully")
        logger.info("get_current_user completed successfully")
        return user_info
        
    except HTTPException:
        print("🔐 DEBUG: Re-raising HTTPException from get_current_user")
        raise
    except Exception as e:
        error_msg = f"Error extracting user from token: {e}"
        print(f"❌ DEBUG: {error_msg}")
        logger.error(f"Error extracting user from token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

# Optional dependency for endpoints that may or may not require auth
async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict[str, Any]]:
    """Get current user if token is provided, otherwise return None."""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None

def require_user_role(required_role: str):
    """Decorator to require specific user role (future enhancement)."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # For now, just check if user is authenticated
            # In the future, add role-based access control
            return await func(*args, **kwargs)
        return wrapper
    return decorator 