import json
import logging
from mangum import Mangum
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from router import api_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Authentication API",
    description="AWS Cognito-based authentication service",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vishmaker.com",          # Production frontend domain
        "http://localhost:3000",          # Local development (Create React App)
        "http://localhost:5173"           # Local development (Vite)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router)

@app.get("/ping")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "auth-api"}

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Authentication API", "version": "1.0.0"}

# Lambda handler
def handler(event, context):
    """AWS Lambda handler."""
    try:
        logger.info(f"Lambda invoked with event: {json.dumps(event)}")
        
        # Create Mangum adapter for AWS Lambda
        asgi_handler = Mangum(app)
        
        # Process the event
        response = asgi_handler(event, context)
        
        logger.info(f"Lambda response: {json.dumps(response)}")
        return response
        
    except Exception as e:
        logger.error(f"Lambda handler error: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error"})
        } 