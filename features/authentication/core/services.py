import os
import json
import logging
from typing import Dict, Any, Tuple
from pydantic import ValidationError

from .factory import get_auth_service
from ..api import schemas

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def _get_auth_service():
    """Get the auth service instance."""
    return get_auth_service()

def _handle_validation_error(e: ValidationError) -> Dict[str, Any]:
    """Handle Pydantic validation errors gracefully."""
    error_details = []
    for error in e.errors():
        error_details.append({
            'field': '.'.join(str(loc) for loc in error['loc']),
            'message': error['msg'],
            'type': error['type']
        })
    return {"error": "Validation failed", "details": error_details}

def _handle_auth_error(e: Exception) -> Dict[str, Any]:
    """Handle authentication-specific errors."""
    error_message = str(e)
    
    # Map common error messages to user-friendly responses
    if "UserNotFoundException" in error_message:
        return {"error": "Invalid email or password"}
    elif "NotAuthorizedException" in error_message:
        return {"error": "Invalid email or password"}
    elif "UsernameExistsException" in error_message:
        return {"error": "A user with this email already exists"}
    elif "InvalidPasswordException" in error_message:
        return {"error": "Password does not meet requirements"}
    elif "CodeMismatchException" in error_message:
        return {"error": "Invalid confirmation code"}
    elif "ExpiredCodeException" in error_message:
        return {"error": "Confirmation code has expired"}
    elif "UserNotConfirmedException" in error_message:
        return {"error": "Account not confirmed. Please check your email for confirmation code"}
    else:
        logger.error(f"Authentication error: {error_message}")
        return {"error": error_message}

def process_signin(body: str) -> Tuple[int, Dict[str, Any]]:
    """Process user sign-in request."""
    try:
        logger.info("Processing sign-in request")
        
        # Parse and validate the request body
        user_credentials = schemas.UserSignIn.model_validate_json(body)
        
        # Call the business logic via the adapter
        auth_service = _get_auth_service()
        result = auth_service.sign_in(user_credentials)
        
        logger.info(f"Successful sign-in for user: {user_credentials.email}")
        return 200, result

    except ValidationError as e:
        logger.warning(f"Validation error in sign-in: {e.errors()}")
        return 400, _handle_validation_error(e)
    except Exception as e:
        logger.error(f"Sign-in error: {str(e)}")
        return 401, _handle_auth_error(e)

def process_signup(body: str) -> Tuple[int, Dict[str, Any]]:
    """Process user sign-up request."""
    try:
        logger.info("Processing sign-up request")
        
        user_details = schemas.UserSignUp.model_validate_json(body)
        auth_service = _get_auth_service()
        response = auth_service.sign_up(user_details)
        
        logger.info(f"Successful sign-up for user: {user_details.email}")
        return 201, response
        
    except ValidationError as e:
        logger.warning(f"Validation error in sign-up: {e.errors()}")
        return 400, _handle_validation_error(e)
    except Exception as e:
        logger.error(f"Sign-up error: {str(e)}")
        return 400, _handle_auth_error(e)

def process_confirm_signup(body: str) -> Tuple[int, Dict[str, Any]]:
    """Process user sign-up confirmation request."""
    try:
        logger.info("Processing sign-up confirmation request")
        
        request = schemas.ConfirmSignUp.model_validate_json(body)
        auth_service = _get_auth_service()
        response = auth_service.confirm_sign_up(request)
        
        logger.info(f"Successful sign-up confirmation for user: {request.email}")
        return 200, response
        
    except ValidationError as e:
        logger.warning(f"Validation error in sign-up confirmation: {e.errors()}")
        return 400, _handle_validation_error(e)
    except Exception as e:
        logger.error(f"Sign-up confirmation error: {str(e)}")
        return 400, _handle_auth_error(e)

def process_forgot_password(body: str) -> Tuple[int, Dict[str, Any]]:
    """Process forgot password request."""
    try:
        logger.info("Processing forgot password request")
        
        request = schemas.ForgotPassword.model_validate_json(body)
        auth_service = _get_auth_service()
        response = auth_service.forgot_password(request)
        
        logger.info(f"Forgot password initiated for user: {request.email}")
        return 200, response
        
    except ValidationError as e:
        logger.warning(f"Validation error in forgot password: {e.errors()}")
        return 400, _handle_validation_error(e)
    except Exception as e:
        logger.error(f"Forgot password error: {str(e)}")
        return 400, _handle_auth_error(e)

def process_confirm_forgot_password(body: str) -> Tuple[int, Dict[str, Any]]:
    """Process confirm forgot password request."""
    try:
        logger.info("Processing confirm forgot password request")
        
        request = schemas.ConfirmForgotPassword.model_validate_json(body)
        auth_service = _get_auth_service()
        response = auth_service.confirm_forgot_password(request)
        
        logger.info(f"Password reset confirmed for user: {request.email}")
        return 200, response
        
    except ValidationError as e:
        logger.warning(f"Validation error in confirm forgot password: {e.errors()}")
        return 400, _handle_validation_error(e)
    except Exception as e:
        logger.error(f"Confirm forgot password error: {str(e)}")
        return 400, _handle_auth_error(e)

def process_signout(body: str) -> Tuple[int, Dict[str, Any]]:
    """Process user sign-out request."""
    try:
        logger.info("Processing sign-out request")
        
        request = schemas.SignOutRequest.model_validate_json(body)
        auth_service = _get_auth_service()
        response = auth_service.sign_out(request.session_token)
        
        logger.info("Successful sign-out")
        return 200, response
        
    except ValidationError as e:
        logger.warning(f"Validation error in sign-out: {e.errors()}")
        return 400, _handle_validation_error(e)
    except Exception as e:
        logger.error(f"Sign-out error: {str(e)}")
        return 400, _handle_auth_error(e)

def process_refresh_token(body: str) -> Tuple[int, Dict[str, Any]]:
    """Process token refresh request."""
    try:
        logger.info("Processing token refresh request")
        
        request = schemas.RefreshTokenRequest.model_validate_json(body)
        # For local adapter, we don't implement token refresh
        # Just return a success response
        response = {"message": "Token refresh not implemented in local mode"}
        
        logger.info("Token refresh processed")
        return 200, response
        
    except ValidationError as e:
        logger.warning(f"Validation error in token refresh: {e.errors()}")
        return 400, _handle_validation_error(e)
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        return 400, _handle_auth_error(e)

def process_cors_preflight(body: str) -> Tuple[int, Dict[str, Any]]:
    """Process CORS preflight request."""
    return 200, {"message": "CORS preflight successful"}

def process_request(operation: str, body: str) -> Tuple[int, Dict[str, Any]]:
    """Main request processor that routes to appropriate handler."""
    try:
        if operation == "signin":
            return process_signin(body)
        elif operation == "signup":
            return process_signup(body)
        elif operation == "confirm-signup":
            return process_confirm_signup(body)
        elif operation == "forgot-password":
            return process_forgot_password(body)
        elif operation == "confirm-forgot-password":
            return process_confirm_forgot_password(body)
        elif operation == "signout":
            return process_signout(body)
        elif operation == "refresh-token":
            return process_refresh_token(body)
        elif operation == "cors-preflight":
            return process_cors_preflight(body)
        else:
            logger.error(f"Unknown operation: {operation}")
            return 400, {"error": f"Unknown operation: {operation}"}
            
    except Exception as e:
        logger.error(f"Unexpected error in process_request: {str(e)}")
        return 500, {"error": "Internal server error"}