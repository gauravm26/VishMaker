# app-api/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

#--Import Routers--
from features.project_management.api import routes as project_routes
from features.requirement_generation.api import routes as req_gen_routes
from config.settings import settings

# Import the LLM router from the LLM controller directly
from app.api.llm_controller import router as llm_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" # Standard OpenAPI endpoint
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

@app.get(settings.API_V1_STR, include_in_schema=False)
async def api_root_redirect():
    """Redirect from /api/v1 to /docs for API documentation."""
    return RedirectResponse(url="/docs")

# Include feature routers
app.include_router(project_routes.router, prefix=settings.API_V1_STR)
app.include_router(req_gen_routes.router, prefix=settings.API_V1_STR)

# Include LLM router with prefix
app.include_router(
    llm_router, 
    prefix=f"{settings.API_V1_STR}/llm",
    tags=["LLM Services"]
)

if __name__ == "__main__":
    # This is for debugging locally if you run main.py directly
    # Production runs use 'uvicorn app.main:app --reload' from the app-api directory
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.BACKEND_PORT)
