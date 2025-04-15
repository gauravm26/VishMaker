"""
API routes for code generation feature.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body, Query
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from features.code_generation.core.services import CodeGenerationService
from features.code_generation.api.schemas import (
    BuildFeatureRequest,
    BuildFeatureResponse,
    CodeFile,
    SaveCodeRequest,
    SaveCodeResponse
)

# Import database models and connection from infrastructure/db
from infrastructure.db.db_core import get_db
from infrastructure.db.requirement import TestCaseEntity as TestCase
from infrastructure.db.requirement import LowLevelRequirementEntity as LowLevelRequirement
from infrastructure.db.requirement import HighLevelRequirementEntity as HighLevelRequirement
from infrastructure.db.requirement import UserFlowEntity as UserFlow

# Create API router for code generation
router = APIRouter(
    prefix="/code-generation",
    tags=["code-generation"],
    responses={404: {"description": "Not found"}},
)

async def get_full_context(db: Session, test_case_id: str) -> Dict[str, Any]:
    """
    Query the database to create a complete package of context for the LLM.
    
    Args:
        db: Database session
        test_case_id: The ID of the test case
        
    Returns:
        Dict containing all related test cases, requirements, and user flow
    """
    # Get the test case to find its parent_uiid
    test_case = db.query(TestCase).filter(TestCase.id == test_case_id).first()
    if not test_case:
        raise HTTPException(status_code=404, detail=f"Test case {test_case_id} not found")
    
    parent_uiid = test_case.parent_uiid
    
    # Get all related test cases with the same parent_uiid
    related_test_cases = db.query(TestCase).filter(TestCase.parent_uiid == parent_uiid).all()
    
    # Get the low level requirement
    low_level_req = db.query(LowLevelRequirement).filter(LowLevelRequirement.id == parent_uiid).first()
    if not low_level_req:
        raise HTTPException(status_code=404, detail=f"Low level requirement {parent_uiid} not found")
    
    # Get the high level requirement
    high_level_req = db.query(HighLevelRequirement).filter(HighLevelRequirement.id == low_level_req.parent_uiid).first()
    if not high_level_req:
        raise HTTPException(status_code=404, detail=f"High level requirement {low_level_req.parent_uiid} not found")
    
    # Get the user flow
    user_flow = db.query(UserFlow).filter(UserFlow.id == high_level_req.parent_uiid).first()
    if not user_flow:
        raise HTTPException(status_code=404, detail=f"User flow {high_level_req.parent_uiid} not found")
    
    # Create the context package
    context = {
        "test_cases": [tc.to_dict() for tc in related_test_cases],
        "low_level_requirement": low_level_req.to_dict(),
        "high_level_requirement": high_level_req.to_dict(),
        "user_flow": user_flow.to_dict()    
    }
    
    return context

@router.post("/build-feature", response_model=BuildFeatureResponse)
async def build_feature(
    request: BuildFeatureRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Build code for a feature based on a test case.
    
    Args:
        request: The build feature request containing project_id, test_case_id, etc.
        background_tasks: FastAPI background tasks for asynchronous processing
        db: Database session
        
    Returns:
        JSON response with the result of the code generation process
    """
    try:
        # Get the full context for the LLM
        context = await get_full_context(db, request.test_case_id)
        
        # Initialize the CodeGenerationService
        code_gen_service = CodeGenerationService()
        
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
async def save_code(
    request: SaveCodeRequest,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Save generated code files.
    
    Args:
        request: The save code request containing project_id, test_case_id, and code_files
        db: Database session
        
    Returns:
        JSON response with the result of the save operation
    """
    try:
        # Initialize the CodeGenerationService
        code_gen_service = CodeGenerationService()
        
        result = await code_gen_service.save_generated_code(
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