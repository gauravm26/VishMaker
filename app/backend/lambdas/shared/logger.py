import logging
import json
import os
from datetime import datetime
from typing import Dict, Any

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    """
    Set up a structured logger for Lambda functions.
    
    Args:
        name: Logger name (e.g., 'project_api', 'llm_api')
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Set log level
    log_level = getattr(logging, level.upper(), logging.INFO)
    logger.setLevel(log_level)
    
    # Create handler
    handler = logging.StreamHandler()
    handler.setLevel(log_level)
    
    # Create formatter for structured logging
    if os.environ.get('AWS_LAMBDA_FUNCTION_NAME'):
        # Lambda environment - use JSON formatted logs
        formatter = JsonFormatter()
    else:
        # Local development - use simple format
        formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        )
    
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    # Don't propagate to parent loggers
    logger.propagate = False
    
    return logger

class JsonFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging in Lambda."""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'function_name': os.environ.get('AWS_LAMBDA_FUNCTION_NAME', 'local'),
            'request_id': os.environ.get('AWS_LAMBDA_LOG_GROUP_NAME', 'local'),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        if hasattr(record, 'project_id'):
            log_data['project_id'] = record.project_id
        if hasattr(record, 'request_duration'):
            log_data['request_duration_ms'] = record.request_duration
        
        return json.dumps(log_data)

def log_api_request(logger: logging.Logger, method: str, path: str, user_id: str = None):
    """Log API request with context."""
    extra_fields = {}
    if user_id:
        extra_fields['user_id'] = user_id
    
    logger.info(f"API Request: {method} {path}", extra=extra_fields)

def log_api_response(logger: logging.Logger, method: str, path: str, status_code: int, 
                     duration_ms: int, user_id: str = None):
    """Log API response with timing and status."""
    extra_fields = {
        'request_duration': duration_ms,
        'status_code': status_code
    }
    if user_id:
        extra_fields['user_id'] = user_id
    
    logger.info(f"API Response: {method} {path} -> {status_code}", extra=extra_fields)

def log_database_operation(logger: logging.Logger, operation: str, table: str, 
                          user_id: str = None, project_id: int = None):
    """Log database operations with context."""
    extra_fields = {}
    if user_id:
        extra_fields['user_id'] = user_id
    if project_id:
        extra_fields['project_id'] = project_id
    
    logger.info(f"DB Operation: {operation} on {table}", extra=extra_fields)

def log_llm_request(logger: logging.Logger, model_id: str, tokens: int, 
                   user_id: str = None, project_id: int = None):
    """Log LLM API requests with usage metrics."""
    extra_fields = {
        'model_id': model_id,
        'token_count': tokens
    }
    if user_id:
        extra_fields['user_id'] = user_id
    if project_id:
        extra_fields['project_id'] = project_id
    
    logger.info(f"LLM Request: {model_id} ({tokens} tokens)", extra=extra_fields)

# Pre-configured loggers for common use cases
project_api_logger = setup_logger('project_api')
llm_api_logger = setup_logger('llm_api')
auth_logger = setup_logger('auth')
db_logger = setup_logger('database') 