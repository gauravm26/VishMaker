import logging
from fastapi import APIRouter, HTTPException, status, Depends
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
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])

# Get the Cognito adapter directly
cognito_adapter = get_cognito_adapter()

@auth_router.post("/signin", response_model=dict)
async def sign_in(user_credentials: schemas.UserSignIn):
    """Sign in a user via Cognito."""
    try:
        logger.info(f"Sign in attempt for user: {user_credentials.email}")
        result = cognito_adapter.sign_in(user_credentials)
        logger.info(f"Successful sign in for user: {user_credentials.email}")
        return result
    except Exception as e:
        logger.error(f"Sign in failed for user {user_credentials.email}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

@auth_router.post("/signup", response_model=dict)
async def sign_up(user_details: schemas.UserSignUp):
    """Register a new user via Cognito."""
    try:
        logger.info(f"Sign up attempt for user: {user_details.email}")
        result = cognito_adapter.sign_up(user_details)
        logger.info(f"Successful sign up for user: {user_details.email}")
        return result
    except Exception as e:
        logger.error(f"Sign up failed for user {user_details.email}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/confirm-signup", response_model=dict)
async def confirm_sign_up(credentials: schemas.ConfirmSignUp):
    """Confirm user registration via Cognito."""
    try:
        logger.info(f"Sign up confirmation attempt for user: {credentials.email}")
        result = cognito_adapter.confirm_sign_up(credentials)
        logger.info(f"Successful sign up confirmation for user: {credentials.email}")
        return result
    except Exception as e:
        logger.error(f"Sign up confirmation failed for user {credentials.email}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/forgot-password", response_model=dict)
async def forgot_password(request: schemas.ForgotPassword):
    """Initiate password reset via Cognito."""
    try:
        logger.info(f"Forgot password request for user: {request.email}")
        result = cognito_adapter.forgot_password(request)
        logger.info(f"Forgot password email sent for user: {request.email}")
        return result
    except Exception as e:
        logger.error(f"Forgot password failed for user {request.email}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/confirm-forgot-password", response_model=dict)
async def confirm_forgot_password(request: schemas.ConfirmForgotPassword):
    """Complete password reset via Cognito."""
    try:
        logger.info(f"Confirm forgot password attempt for user: {request.email}")
        result = cognito_adapter.confirm_forgot_password(request)
        logger.info(f"Password successfully reset for user: {request.email}")
        return result
    except Exception as e:
        logger.error(f"Confirm forgot password failed for user {request.email}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/signout", response_model=dict)
async def sign_out(request: schemas.SignOutRequest):
    """Sign out user and invalidate Cognito session."""
    try:
        logger.info(f"Sign out request received")
        result = cognito_adapter.sign_out(request.session_token)
        logger.info(f"Successful sign out")
        return result
    except Exception as e:
        logger.error(f"Sign out failed: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@auth_router.post("/refresh-token", response_model=dict)
async def refresh_token(request: schemas.RefreshTokenRequest):
    """Refresh access token via Cognito."""
    try:
        logger.info(f"Token refresh request")
        result = cognito_adapter.refresh_token(request)
        logger.info(f"Successful token refresh")
        return result
    except Exception as e:
        logger.error(f"Token refresh failed: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

@auth_router.get("/me", response_model=dict)
async def get_current_user():
    """Get current authenticated user information."""
    try:
        logger.info(f"Getting current user info")
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
        logger.error(f"Get current user failed: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# ===============================
# INCLUDE ALL ROUTERS
# ===============================
api_router.include_router(auth_router) 