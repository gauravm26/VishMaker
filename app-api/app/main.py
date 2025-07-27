# app-api/app/main.py
import os
import json
from pathlib import Path
from typing import Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv

# Load environment variables from .env if it exists
project_root = Path(__file__).parent.parent.parent
env_path = project_root / 'global' / '.env'
if env_path.exists():
    load_dotenv(env_path)

# Add project root to Python path for imports
import sys
sys.path.append(str(project_root))

# Configuration functions
def load_config() -> Dict[str, Any]:
    """Load configuration from global/config.json."""
    config_path = project_root / 'global' / 'config.json'
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

_config = load_config()

def get_project_name() -> str:
    return _config.get('app', {}).get('project_name', 'VishMaker')

def get_api_v1_str() -> str:
    return _config.get('app', {}).get('api_v1_str', '/api/v1')

def get_backend_port() -> int:
    return _config.get('app', {}).get('backend_port', 8000)

def get_frontend_port() -> int:
    return _config.get('app', {}).get('frontend_port', 3000)

def get_backend_cors_origins() -> list:
    return _config.get('app', {}).get('backend_cors_origins', ['*'])

def get_database_url() -> str:
    return os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/vish_db")

def get_aws_access_key_id() -> str:
    return os.getenv("AWS_ACCESS_KEY_ID", "")

def get_aws_secret_access_key() -> str:
    return os.getenv("AWS_SECRET_ACCESS_KEY", "")

def get_aws_region() -> str:
    return os.getenv("AWS_REGION", "us-east-1")

def get_environment() -> str:
    return os.getenv("ENVIRONMENT", "dev")

def get_llm_config() -> Dict[str, Any]:
    return _config.get('llm', {})

def get_tech_stack() -> Dict[str, Any]:
    return _config.get('techstack', {})

#--Import Routers--
from features.project_management.api import routes as project_routes
from features.requirement_generation.api import routes as req_gen_routes
from features.code_generation.api import routes as code_gen_routes
from features.waitlist.api import routes as waitlist_routes
from features.authentication.api import routes as auth_routes

# Import the LLM router from the LLM controller directly
from app.api.llm_controller import router as llm_router

app = FastAPI(
    title=get_project_name(),
    openapi_url=f"{get_api_v1_str()}/openapi.json" # Standard OpenAPI endpoint
)

# Configure CORS (Cross-Origin Resource Sharing)
# Adjust origins as needed for your frontend URL in development/production

# Always use these settings for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # Explicitly list all methods
    allow_headers=["*"],
    expose_headers=["Content-Type", "X-Content-Type-Options"],
)

@app.get("/ping", tags=["Health"])
async def ping():
    """Basic health check endpoint."""
    return {"message": "pong"}

@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    """API health check endpoint."""
    return {"status": "online"}

@app.get(get_api_v1_str(), include_in_schema=False)
async def api_root_redirect():
    """Redirect from /api/v1 to /docs for API documentation."""
    return RedirectResponse(url="/docs")

# Include feature routers
app.include_router(project_routes.router, prefix=get_api_v1_str())
app.include_router(req_gen_routes.router, prefix=get_api_v1_str())
app.include_router(code_gen_routes.router, prefix=get_api_v1_str())
app.include_router(waitlist_routes.router, prefix=get_api_v1_str())
app.include_router(auth_routes.router, prefix=f"{get_api_v1_str()}/auth", tags=["Authentication"])

# Include LLM router with prefix
app.include_router(
    llm_router, 
    prefix=f"{get_api_v1_str()}/llm",
    tags=["LLM Services"]
)

if __name__ == "__main__":
    # This is for debugging locally if you run main.py directly
    # Production runs use 'uvicorn app.main:app --reload' from the app-api directory
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=get_backend_port())
