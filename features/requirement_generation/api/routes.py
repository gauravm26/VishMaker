# features/requirement_generation/api/routes.py
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field

from infrastructure.db.db_core import get_db # DB session dependency
from features.requirement_generation.core.services import req_gen_service, RequirementGenerationService
from features.requirement_generation.api import schemas # API Schemas

router = APIRouter(
    prefix="/requirements", # Endpoint group: /api/v1/requirements/...
    tags=["Requirement Generation"] # Tag for OpenAPI docs
)

# Request model for triggering generation
class GenerationRequest(BaseModel):
    component_id: str = Field(..., description="The HTML component ID that triggered the generation")

@router.post(
    "/generate/{project_id}", # Trigger generation for a specific project
    response_model=schemas.GenerationTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED # 202 Accepted is suitable for triggering long tasks
)
def trigger_requirement_generation_endpoint(
    project_id: int,
    request: GenerationRequest = Body(...),
    db: Session = Depends(get_db),
    service: RequirementGenerationService = Depends(lambda: req_gen_service)
):
    """
    Triggers the generation of user flows and requirements for a project based on its initial prompt.
    
    Args:
        project_id: ID of the project
        request: Request body containing the required component_id
    """
    try:
        print(f"Using component_id from request: {request.component_id}")
        result = service.generate_requirements_for_project(
            db=db, 
            project_id=project_id, 
            component_id=request.component_id
        )
        
        # In a real async setup, result might just contain a task_id
        return schemas.GenerationTriggerResponse(
            message=result.get("message", "Processing started."),
            project_id=project_id
            # task_id=result.get("task_id")
        )
    except ValueError as e: # Catch specific errors like 'Project not found' or 'No prompt'
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) # Or 400 Bad Request
    except Exception as e:
        # Log the error e
        print(f"ERROR generating requirements: {e}") # Basic logging
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during requirement generation")


@router.get(
    "/{project_id}",
    response_model=schemas.ProjectRequirementsResponse # Use the new response schema
)
def get_project_requirements_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    service: RequirementGenerationService = Depends(lambda: req_gen_service)
):
    """
    Retrieves the generated user flows, steps, and nested requirements for a specific project.
    """
    try:
        flows = service.get_project_requirements(db=db, project_id=project_id)
        return schemas.ProjectRequirementsResponse(project_id=project_id, flows=flows)
    except ValueError as e: # Catch 'Project not found' from service
         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        # Log error e
        print(f"ERROR retrieving requirements for project {project_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error retrieving requirements")