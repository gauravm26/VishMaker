import logging
from fastapi import APIRouter, HTTPException, status, Depends, Request
import schemas
from cognito import CognitoAdapter, get_cognito_adapter

logger = logging.getLogger(__name__)

# ===============================
# API ROUTER
# ===============================
api_router = APIRouter()  # ← ADD THIS BACK!

# ===============================
# AUTHENTICATION ROUTES
# ===============================
auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Get the Cognito adapter directly
print("Initializing Cognito adapter...")
try:
    cognito_adapter = get_cognito_adapter()
    print("Cognito adapter initialized successfully")
except Exception as e:
    print(f"Failed to initialize Cognito adapter: {str(e)}")
    cognito_adapter = None

@auth_router.post("/signin", response_model=dict)
async def sign_in(user_credentials: schemas.UserSignIn, request: Request):
    """Sign in a user via Cognito."""
    print("=" * 60)
    print("SIGN IN ENDPOINT CALLED")
    print("=" * 60)
    
    # Log request details
    print(f"Request method: {request.method}")
    print(f"Request URL: {request.url}")
    print(f"Request headers: {dict(request.headers)}")
    print(f"Request client: {request.client}")
    
    # Log user credentials (mask password for security)
    masked_credentials = {
        "email": user_credentials.email,
        "password": "***" if user_credentials.password else "None"
    }
    print(f"User credentials received: {masked_credentials}")
    
    try:
        print(f"Sign in attempt for user: {user_credentials.email}")
        
        if not cognito_adapter:
            print("Cognito adapter is not available")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail="Authentication service unavailable"
            )
        
        print("Calling Cognito adapter sign_in method...")
        result = cognito_adapter.sign_in(user_credentials)
        print(f"Successful sign in for user: {user_credentials.email}")
        print(f"Sign in result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
        print(f"Sign in result: {result}")
        
        print("=" * 60)
        print("SIGN IN ENDPOINT COMPLETED SUCCESSFULLY")
        print("=" * 60)
        
        return result
        
    except Exception as e:
        print("=" * 60)
        print("SIGN IN ENDPOINT FAILED")
        print("=" * 60)
        print(f"Exception type: {type(e)}")
        print(f"Exception message: {str(e)}")
        print(f"Exception details: {e}")
        
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        
        print("=" * 60)
        
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

@auth_router.post("/signup", response_model=dict)
async def sign_up(user_details: schemas.UserSignUp, request: Request):
    """Register a new user via Cognito."""
    print(f"Sign up attempt for user: {user_details.email}")
    print(f"Request method: {request.method}")
    print(f"Request URL: {request.url}")
    
    try:
        result = cognito_adapter.sign_up(user_details)
        print(f"Successful sign up for user: {user_details.email}")
        return result
    except Exception as e:
        print(f"Sign up failed for user {user_details.email}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/confirm-signup", response_model=dict)
async def confirm_sign_up(credentials: schemas.ConfirmSignUp, request: Request):
    """Confirm user registration via Cognito."""
    print(f"Sign up confirmation attempt for user: {credentials.email}")
    print(f"Request method: {request.method}")
    print(f"Request URL: {request.url}")
    
    try:
        result = cognito_adapter.sign_up(credentials)
        print(f"Successful sign up confirmation for user: {credentials.email}")
        return result
    except Exception as e:
        print(f"Sign up confirmation failed for user {credentials.email}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/forgot-password", response_model=dict)
async def forgot_password(request_data: schemas.ForgotPassword, request: Request):
    """Initiate password reset via Cognito."""
    print(f"Forgot password request for user: {request_data.email}")
    print(f"Request method: {request.method}")
    print(f"Request URL: {request.url}")
    
    try:
        result = cognito_adapter.forgot_password(request_data)
        print(f"Forgot password email sent for user: {request_data.email}")
        return result
    except Exception as e:
        print(f"Forgot password failed for user {request_data.email}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/confirm-forgot-password", response_model=dict)
async def confirm_forgot_password(request_data: schemas.ConfirmForgotPassword, request: Request):
    """Complete password reset via Cognito."""
    print(f"Confirm forgot password attempt for user: {request_data.email}")
    print(f"Request method: {request.method}")
    print(f"Request URL: {request.url}")
    
    try:
        result = cognito_adapter.confirm_forgot_password(request_data)
        print(f"Password successfully reset for user: {request_data.email}")
        return result
    except Exception as e:
        print(f"Confirm forgot password failed for user {request_data.email}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/signout", response_model=dict)
async def sign_out(request_data: schemas.SignOutRequest, request: Request):
    """Sign out user and invalidate Cognito session."""
    print(f"Sign out request received")
    print(f"Request method: {request.method}")
    print(f"Request URL: {request.url}")
    
    try:
        result = cognito_adapter.sign_out(request_data.session_token)
        print(f"Successful sign out")
        return result
    except Exception as e:
        print(f"Sign out failed: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/refresh-token", response_model=dict)
async def refresh_token(request_data: schemas.RefreshTokenRequest, request: Request):
    """Refresh access token via Cognito."""
    print(f"Token refresh request")
    print(f"Request method: {request.method}")
    print(f"Request URL: {request.url}")
    
    try:
        result = cognito_adapter.refresh_token(request_data)
        print(f"Successful token refresh")
        return result
    except Exception as e:
        print(f"Token refresh failed: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

@auth_router.get("/me", response_model=dict)
async def get_current_user(request: Request):
    """Get current authenticated user information."""
    print(f"Getting current user info")
    print(f"Request method: {request.method}")
    print(f"Request URL: {request.url}")
    print(f"Request headers: {dict(request.headers)}")
    
    try:
        # Get the current user from the session token
        # In a real implementation, you'd extract the token from the request headers
        # For now, we'll use the Cognito adapter to get user info
        # This is a simplified version - in production you'd decode the JWT token
        
        # For now, return a placeholder - in production you'd decode the JWT and get real user info
        # The frontend should handle this by calling the /me endpoint with the access token
        return {
            "user": {
                "id": "current_user_id",  # This would come from JWT claims
                "email": "current_user@example.com",  # This would come from JWT claims
                "email_verified": True
            }
        }
    except Exception as e:
        print(f"Get current user failed: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# ===============================
# INCLUDE ALL ROUTERS
# ===============================
print("Including auth_router in api_router...")
api_router.include_router(auth_router)
print("Auth router included successfully") 