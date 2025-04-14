"""
API routes for code generation feature.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body, Query
from typing import Dict, Any, Optional, List

from features.code_generation.core.services import CodeGenerationService
from features.code_generation.api.schemas import (
    BuildFeatureRequest,
    BuildFeatureResponse,
    CodeFile,
    SaveCodeRequest,
    SaveCodeResponse
)

# Create API router for code generation
router = APIRouter(
    prefix="/code-generation",
    tags=["code-generation"],
    responses={404: {"description": "Not found"}},
)

@router.post("/build-feature", response_model=BuildFeatureResponse)
async def build_feature(
    request: BuildFeatureRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """
    Build code for a feature based on a test case.
    
    Args:
        request: The build feature request containing project_id, test_case_id, etc.
        background_tasks: FastAPI background tasks for asynchronous processing
        
    Returns:
        JSON response with the result of the code generation process
    """
    try:
        # Call the service to generate code
        result = await CodeGenerationService.generate_feature_code(
            test_case_id=request.test_case_id,
            project_id=request.project_id,
            test_name=request.test_name,
            test_description=request.test_description,
            parent_uiid=request.parent_uiid
        )
        
        # If successful, save the generated code in the background
        if result.get("success") and result.get("code_files"):
            background_tasks.add_task(
                CodeGenerationService.save_generated_code,
                project_id=request.project_id,
                test_case_id=request.test_case_id,
                code_files=result.get("code_files"),
                metadata=result.get("test_metadata")
            )
        
        return {
            "success": result.get("success", False),
            "message": result.get("message", ""),
            "code_files": result.get("code_files", []),
            "generated_uiids": result.get("generated_uiids", []),
            "error": result.get("error"),
            "test_metadata": result.get("test_metadata")
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Error generating code: {str(e)}",
            "error": str(e),
            "code_files": None,
            "generated_uiids": None,
            "test_metadata": None
        }

@router.get("/project/{project_id}/code", response_model=Dict[str, Any])
async def get_project_code(
    project_id: int,
    test_case_id: Optional[str] = Query(None, description="Optional filter by test case ID")
) -> Dict[str, Any]:
    """
    Get generated code for a project or specific test case.
    
    Args:
        project_id: The ID of the project
        test_case_id: Optional test case ID to filter results
        
    Returns:
        JSON response with the generated code files
    """
    try:
        # Here you would implement retrieving the generated code from wherever it's stored
        # This is a placeholder response
        return {
            "success": True,
            "message": "Retrieved project code",
            "project_id": project_id,
            "test_case_id": test_case_id,
            "code_files": []  # Would contain actual code files in a real implementation
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error retrieving code: {str(e)}",
            "error": str(e)
        }

@router.post("/save-code", response_model=SaveCodeResponse)
async def save_code(request: SaveCodeRequest) -> Dict[str, Any]:
    """
    Save generated code files.
    
    Args:
        request: The save code request containing project_id, test_case_id, and code_files
        
    Returns:
        JSON response with the result of the save operation
    """
    try:
        result = await CodeGenerationService.save_generated_code(
            project_id=request.project_id,
            test_case_id=request.test_case_id,
            code_files=request.code_files,
            metadata=request.metadata
        )
        
        return {
            "success": result.get("success", False),
            "message": result.get("message", ""),
            "saved_files": result.get("saved_files", []),
            "error": result.get("error")
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Error saving code: {str(e)}",
            "error": str(e),
            "saved_files": None
        } 