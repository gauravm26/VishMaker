from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import Dict, Any
import sys
import os
from pathlib import Path

# Add paths for importing existing modules
current_dir = Path(__file__).parent
lambdas_dir = current_dir.parent.parent
shared_dir = lambdas_dir / "shared"
project_root = lambdas_dir.parent.parent

sys.path.append(str(shared_dir))
sys.path.append(str(project_root))

from shared.auth import get_current_user
from shared.logger import setup_logger
from shared.exceptions import ValidationError, handle_database_error

# Import database and services (now self-contained)
from local.db.db_core import get_db
from .features.code_generation.core.services import CodeGenerationService
from .features.code_generation.api import schemas as code_gen_schemas

# Initialize logger
logger = setup_logger('llm_router')

# Create main router
api_router = APIRouter()

# ===============================
# CODE GENERATION ROUTES (PROTECTED)
# ===============================
code_gen_router = APIRouter(prefix="/code", tags=["Code Generation"])

@code_gen_router.post("/generate", response_model=dict)
async def generate_code(
    request: code_gen_schemas.BuildFeatureRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate code for a feature based on test case (requires authentication)."""
    user_id = current_user['email']
    
    try:
        logger.info(f"Generating code for project {request.project_id} by user {user_id}")
        
        # Initialize the CodeGenerationService
        code_gen_service = CodeGenerationService()
        
        # Get the full context for the LLM
        from .features.code_generation.api.routes import get_full_context
        context = await get_full_context(db, request.test_case_id)
        
        # Call the service to generate code with the full context only
        result = await code_gen_service.generate_feature_code(
            project_id=request.project_id,
            context=context
        )
            
        # If successful, save the generated code in the background
        if result.get("success") and result.get("code_files"):
            background_tasks.add_task(
                code_gen_service.save_generated_code,
                project_id=request.project_id,
                test_case_id=request.test_case_id,
                code_files=result.get("code_files"),
                metadata=result.get("test_metadata")
            )
            
        logger.info(f"Successfully generated code for project {request.project_id}")
        return {
            "success": result.get("success", False),
            "message": result.get("message", ""),
            "code_files": result.get("code_files", []),
            "generated_uiids": result.get("generated_uiids", []),
            "error": result.get("error"),
            "test_metadata": result.get("test_metadata")
        }
        
    except Exception as e:
        logger.error(f"Error generating code for project {request.project_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# ===============================
# LLM PROCESSING ROUTES (PROTECTED)
# ===============================
llm_router = APIRouter(prefix="/llm", tags=["LLM Processing"])

@llm_router.post("/process", response_model=dict)
async def process_llm_request(
    request: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Process LLM request (requires authentication)."""
    user_id = current_user['email']
    
    try:
        logger.info(f"Processing LLM request by user {user_id}")
        
        # Add LLM processing logic here
        # This could include various AI/ML operations
        
        logger.info(f"Successfully processed LLM request for user {user_id}")
        return {
            "success": True,
            "message": "LLM request processed successfully",
            "result": "placeholder_result"
        }
        
    except Exception as e:
        logger.error(f"Error processing LLM request for user {user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# ===============================
# INCLUDE ALL ROUTERS
# ===============================
api_router.include_router(code_gen_router)
api_router.include_router(llm_router)