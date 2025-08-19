import json
import logging
from fastapi import FastAPI, Request, HTTPException, APIRouter
from mangum import Mangum
from cognito import get_cognito_adapter
from router import auth_router
from fastapi.responses import JSONResponse
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="VishMaker Auth API",
    description="Authentication service for VishMaker",
    version="1.0.0"
)

# Include the auth router
app.include_router(auth_router)

@app.get("/ping")
async def health_check():
    """Health check endpoint."""
    print("Health check endpoint called")
    return {"status": "healthy", "service": "auth-api"}

@app.get("/")
async def root():
    """Root endpoint."""
    print("Root endpoint called")
    return {"message": "Authentication API", "version": "1.0.0"}

# Lambda handler
def handler(event, context):
    """AWS Lambda handler."""
    try:
        print("=" * 80)
        print("LAMBDA INVOCATION STARTED")
        print("=" * 80)
        
        # Log the full event structure
        print(f"Event type: {type(event)}")
        print(f"Event keys: {list(event.keys()) if isinstance(event, dict) else 'Not a dict'}")
        print(f"Full event: {json.dumps(event, indent=2)}")
        
        # Log context information
        print(f"Context function name: {context.function_name}")
        print(f"Context function version: {context.function_version}")
        print(f"Context invoked function ARN: {context.invoked_function_arn}")
        print(f"Context memory limit: {context.memory_limit_in_mb}")
        print(f"Context remaining time: {context.get_remaining_time_in_millis()}")
        
        # Extract and log HTTP request details if available
        if isinstance(event, dict):
            if 'httpMethod' in event:
                print(f"HTTP Method: {event.get('httpMethod')}")
                print(f"Path: {event.get('path')}")
                print(f"Query String: {event.get('queryStringParameters')}")
                print(f"Headers: {json.dumps(event.get('headers', {}), indent=2)}")
                print(f"Body: {event.get('body')}")
            elif 'requestContext' in event:
                print(f"Request Context: {json.dumps(event.get('requestContext', {}), indent=2)}")
                if 'http' in event.get('requestContext', {}):
                    http_info = event['requestContext']['http']
                    print(f"HTTP Method: {http_info.get('method')}")
                    print(f"Path: {http_info.get('path')}")
                    print(f"User Agent: {http_info.get('userAgent')}")
                    print(f"Source IP: {http_info.get('sourceIp')}")
        
        # Create Mangum adapter for AWS Lambda
        print("Creating Mangum adapter...")
        asgi_handler = Mangum(app)
        
        # Process the event
        print("Processing event with Mangum...")
        response = asgi_handler(event, context)
        
        # Log the response
        print(f"Response type: {type(response)}")
        print(f"Response keys: {list(response.keys()) if isinstance(response, dict) else 'Not a dict'}")
        print(f"Full response: {json.dumps(response, indent=2)}")
        
        print("=" * 80)
        print("LAMBDA INVOCATION COMPLETED SUCCESSFULLY")
        print("=" * 80)
        
        return response
        
    except Exception as e:
        print("=" * 80)
        print("LAMBDA INVOCATION FAILED")
        print("=" * 80)
        print(f"Exception type: {type(e)}")
        print(f"Exception message: {str(e)}")
        print(f"Exception details: {e}")
        
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        
        print("=" * 80)
        
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error", "details": str(e)})
        } 