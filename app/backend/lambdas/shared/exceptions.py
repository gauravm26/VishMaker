from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
from typing import Any, Dict
import traceback

logger = logging.getLogger(__name__)

# Custom Exception Classes
class VishMakerException(Exception):
    """Base exception for VishMaker application."""
    
    def __init__(self, message: str, error_code: str = None, details: Dict[str, Any] = None):
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)

class AuthenticationError(VishMakerException):
    """Raised when authentication fails."""
    pass

class AuthorizationError(VishMakerException):
    """Raised when user lacks permission for action."""
    pass

class ValidationError(VishMakerException):
    """Raised when input validation fails."""
    pass

class ResourceNotFoundError(VishMakerException):
    """Raised when requested resource is not found."""
    pass

class ResourceConflictError(VishMakerException):
    """Raised when resource already exists or conflicts."""
    pass

class DatabaseError(VishMakerException):
    """Raised when database operation fails."""
    pass

class ExternalServiceError(VishMakerException):
    """Raised when external service (LLM, etc.) fails."""
    pass

class ConfigurationError(VishMakerException):
    """Raised when configuration is invalid or missing."""
    pass

# Error Response Formatters
def create_error_response(
    status_code: int,
    message: str,
    error_code: str = None,
    details: Dict[str, Any] = None,
    request_id: str = None
) -> Dict[str, Any]:
    """Create standardized error response."""
    
    error_response = {
        "error": {
            "message": message,
            "code": error_code or f"HTTP_{status_code}",
            "status_code": status_code
        }
    }
    
    if details:
        error_response["error"]["details"] = details
    
    if request_id:
        error_response["error"]["request_id"] = request_id
    
    return error_response

# Exception Handlers
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle FastAPI validation errors."""
    
    logger.warning(f"Validation error: {exc.errors()}")
    
    # Format validation errors for client
    details = {
        "validation_errors": []
    }
    
    for error in exc.errors():
        field_error = {
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        }
        if "input" in error:
            field_error["input"] = error["input"]
        
        details["validation_errors"].append(field_error)
    
    error_response = create_error_response(
        status_code=422,
        message="Input validation failed",
        error_code="VALIDATION_ERROR",
        details=details
    )
    
    return JSONResponse(
        status_code=422,
        content=error_response
    )

async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions."""
    
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
    
    error_response = create_error_response(
        status_code=exc.status_code,
        message=exc.detail,
        error_code=f"HTTP_{exc.status_code}"
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )

async def vishmaker_exception_handler(request: Request, exc: VishMakerException):
    """Handle custom VishMaker exceptions."""
    
    # Map exception types to HTTP status codes
    status_code_map = {
        AuthenticationError: 401,
        AuthorizationError: 403,
        ValidationError: 400,
        ResourceNotFoundError: 404,
        ResourceConflictError: 409,
        DatabaseError: 500,
        ExternalServiceError: 502,
        ConfigurationError: 500,
        VishMakerException: 500  # Default
    }
    
    status_code = status_code_map.get(type(exc), 500)
    
    logger.error(f"VishMaker exception: {exc.error_code} - {exc.message}", extra={
        "error_code": exc.error_code,
        "details": exc.details
    })
    
    error_response = create_error_response(
        status_code=status_code,
        message=exc.message,
        error_code=exc.error_code,
        details=exc.details
    )
    
    return JSONResponse(
        status_code=status_code,
        content=error_response
    )

async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    
    # Don't expose internal error details in production
    import os
    is_development = os.environ.get('ENVIRONMENT', 'prod').lower() in ['dev', 'development']
    
    if is_development:
        error_response = create_error_response(
            status_code=500,
            message=f"Internal server error: {str(exc)}",
            error_code="INTERNAL_ERROR",
            details={"traceback": traceback.format_exc()}
        )
    else:
        error_response = create_error_response(
            status_code=500,
            message="An unexpected error occurred",
            error_code="INTERNAL_ERROR"
        )
    
    return JSONResponse(
        status_code=500,
        content=error_response
    )

# Utility Functions
def handle_database_error(error: Exception, operation: str) -> DatabaseError:
    """Convert database exceptions to VishMaker exceptions."""
    
    error_message = f"Database {operation} failed: {str(error)}"
    
    # Check for specific database error types
    if "UniqueViolation" in str(type(error)) or "unique constraint" in str(error).lower():
        raise ResourceConflictError(
            message=f"Resource already exists",
            error_code="RESOURCE_CONFLICT",
            details={"operation": operation, "database_error": str(error)}
        )
    elif "ForeignKeyViolation" in str(type(error)) or "foreign key" in str(error).lower():
        raise ValidationError(
            message="Invalid reference to related resource",
            error_code="INVALID_REFERENCE",
            details={"operation": operation, "database_error": str(error)}
        )
    else:
        raise DatabaseError(
            message=error_message,
            error_code="DATABASE_ERROR",
            details={"operation": operation, "database_error": str(error)}
        )

def handle_external_service_error(error: Exception, service_name: str) -> ExternalServiceError:
    """Convert external service exceptions to VishMaker exceptions."""
    
    raise ExternalServiceError(
        message=f"{service_name} service error: {str(error)}",
        error_code="EXTERNAL_SERVICE_ERROR",
        details={"service": service_name, "error": str(error)}
    )

def require_resource_ownership(resource_user_id: str, current_user_id: str, resource_type: str = "resource"):
    """Check if current user owns the resource."""
    
    if resource_user_id != current_user_id:
        raise AuthorizationError(
            message=f"Access denied: you don't have permission to access this {resource_type}",
            error_code="ACCESS_DENIED",
            details={
                "resource_type": resource_type,
                "required_user_id": resource_user_id,
                "current_user_id": current_user_id
            }
        )

# Exception Handler Registry
EXCEPTION_HANDLERS = {
    RequestValidationError: validation_exception_handler,
    StarletteHTTPException: http_exception_handler,
    VishMakerException: vishmaker_exception_handler,
    Exception: general_exception_handler
} 