import sys
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

# Add shared utilities to path
current_dir = Path(__file__).parent
lambdas_dir = current_dir.parent.parent
shared_dir = lambdas_dir / "shared"
sys.path.append(str(shared_dir))

# Add project root to path for importing existing modules
project_root = lambdas_dir.parent.parent
sys.path.append(str(project_root))

from router import api_router
from shared.logger import setup_logger, log_api_request, log_api_response
from shared.config_loader import get_project_name, get_api_v1_str
from shared.exceptions import EXCEPTION_HANDLERS

# Initialize logger
logger = setup_logger('llm_api')

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    app = FastAPI(
        title=f"{get_project_name()} LLM API",
        description="LLM API - Handle AI/ML operations, code generation, and LLM processing",
        version="1.0.0",
        openapi_url=f"{get_api_v1_str()}/openapi.json",
        docs_url=f"{get_api_v1_str()}/docs",
        redoc_url=f"{get_api_v1_str()}/redoc"
    )
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
        expose_headers=["Content-Type", "X-Content-Type-Options"],
    )
    
    # Register exception handlers
    for exception_type, handler in EXCEPTION_HANDLERS.items():
        app.add_exception_handler(exception_type, handler)
    
    # Health check endpoint
    @app.get("/ping")
    async def ping():
        """Health check endpoint."""
        logger.info("Health check requested")
        return {"message": "pong", "service": "llm_api"}
    
    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "message": f"{get_project_name()} LLM API",
            "version": "1.0.0",
            "service": "llm_api"
        }
    
    # Include API routes
    app.include_router(api_router, prefix=get_api_v1_str())
    
    # Middleware for request/response logging
    @app.middleware("http")
    async def log_requests(request, call_next):
        import time
        
        start_time = time.time()
        
        # Log request
        log_api_request(logger, request.method, str(request.url.path))
        
        # Process request
        response = await call_next(request)
        
        # Log response
        process_time = int((time.time() - start_time) * 1000)  # Convert to ms
        log_api_response(
            logger, 
            request.method, 
            str(request.url.path), 
            response.status_code, 
            process_time
        )
        
        return response
    
    logger.info("LLM API application initialized")
    return app

# Create the FastAPI app
app = create_app()

# Lambda handler using Mangum
handler = Mangum(app, lifespan="off")

# For local development
if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting LLM API in development mode")
    uvicorn.run(
        "main:app",
        host="0.0.0.0", 
        port=8003,  # Different port from other APIs
        reload=True,
        log_level="info"
    ) 