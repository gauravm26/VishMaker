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
    return {
        'region': os.environ.get('AWS_REGION', 'us-east-1'),
        'user_pool_id': os.environ.get('COGNITO_USER_POOL_ID'),
        'client_id': os.environ.get('COGNITO_CLIENT_ID')
    }

@lru_cache()
def get_cognito_keys():
    """Fetch and cache Cognito public keys for JWT verification."""
    config = get_cognito_config()
    if not config['user_pool_id']:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cognito configuration not found"
        )
    
    keys_url = f"https://cognito-idp.{config['region']}.amazonaws.com/{config['user_pool_id']}/.well-known/jwks.json"
    
    try:
        response = requests.get(keys_url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to fetch Cognito keys: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch authentication keys"
        )

def verify_jwt_token(token: str) -> Dict[str, Any]:
    """Verify JWT token and return claims."""
    config = get_cognito_config()
    keys = get_cognito_keys()
    
    try:
        # Decode header to get key ID
        unverified_header = jwt.get_unverified_header(token)
        key_id = unverified_header.get('kid')
        
        if not key_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing key ID"
            )
        
        # Find the correct key
        key = None
        for k in keys.get('keys', []):
            if k.get('kid') == key_id:
                key = jwt.algorithms.RSAAlgorithm.from_jwk(k)
                break
        
        if not key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: key not found"
            )
        
        # Verify and decode token
        claims = jwt.decode(
            token,
            key,
            algorithms=['RS256'],
            audience=config['client_id'],
            issuer=f"https://cognito-idp.{config['region']}.amazonaws.com/{config['user_pool_id']}"
        )
        
        return claims
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed"
        )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Extract and validate user from JWT token."""
    try:
        # Remove 'Bearer ' prefix if present
        token = credentials.credentials
        if token.startswith('Bearer '):
            token = token[7:]
        
        claims = verify_jwt_token(token)
        
        # Extract user information from claims
        user_info = {
            'user_id': claims.get('sub'),  # Cognito user ID
            'email': claims.get('email'),
            'email_verified': claims.get('email_verified', False),
            'username': claims.get('cognito:username', claims.get('email')),
            'token_use': claims.get('token_use'),
            'exp': claims.get('exp')
        }
        
        if not user_info['user_id']:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        return user_info
        
    except HTTPException:
        raise
    except Exception as e:
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