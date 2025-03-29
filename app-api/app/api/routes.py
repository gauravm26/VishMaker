from fastapi import APIRouter
from app.api.llm_controller import router as llm_router

# Main API router
router = APIRouter()

# Include the LLM router
llm_api_router = APIRouter(
    prefix="/llm", 
    tags=["LLM Services"]
)
llm_api_router.include_router(llm_router)

# Export both routers for use in main.py 