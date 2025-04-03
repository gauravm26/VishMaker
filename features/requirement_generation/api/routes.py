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