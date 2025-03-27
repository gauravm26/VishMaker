# features/project_management/api/routes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from infrastructure.db.base import get_db # DB session dependency
from features.project_management.core.services import project_service, ProjectService # The service layer
from features.project_management.api import schemas # API Schemas

# Create a router specific to this feature
# We can define prefix and tags here for organization
router = APIRouter(
    prefix="/projects", # All routes in this file will start with /projects
    tags=["Project Management"] # Tag for OpenAPI documentation grouping
)

@router.post(
    "/",
    response_model=schemas.Project, # Specify the expected response schema
    status_code=status.HTTP_201_CREATED # Set default status code for successful creation
)
def create_project_endpoint(
    project_in: schemas.ProjectCreate, # Request body validated against ProjectCreate schema
    db: Session = Depends(get_db), # Dependency injection for DB session
    service: ProjectService = Depends(lambda: project_service) # Dependency injection for service (using default instance)
):
    """
    Create a new project.
    """
    try:
        created_project = service.create_new_project(db=db, project_create=project_in)
        return created_project
    except ValueError as e: # Catch potential validation errors from the service
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e: # Generic error handler
        # Log the error e here in a real application
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during project creation")


@router.get(
    "/",
    response_model=List[schemas.Project] # Returns a list of projects
    # Consider using ProjectListResponse if you want total count etc.
    # response_model=schemas.ProjectListResponse
)
def read_projects_endpoint(
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"), # Query parameter with validation
    limit: int = Query(100, ge=1, le=200, description="Maximum number of records to return"), # Query parameter with validation
    db: Session = Depends(get_db),
    service: ProjectService = Depends(lambda: project_service)
):
    """
    Retrieve a list of projects with optional pagination.
    """
    projects = service.get_all_projects(db, skip=skip, limit=limit)
    # If using ProjectListResponse:
    # total = db.query(ProjectModel).count() # You might need a count method in repo/service
    # return schemas.ProjectListResponse(projects=projects, total=total)
    return projects


@router.get(
    "/{project_id}",
    response_model=schemas.Project
)
def read_project_endpoint(
    project_id: int, # Path parameter
    db: Session = Depends(get_db),
    service: ProjectService = Depends(lambda: project_service)
):
    """
    Get a specific project by its ID.
    """
    db_project = service.get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return db_project


# Using PUT for full update for simplicity now. PATCH is better for partial updates.
@router.put(
    "/{project_id}",
    response_model=schemas.Project
)
def update_project_endpoint(
    project_id: int,
    project_in: schemas.ProjectUpdate, # Use ProjectUpdate which allows optional fields
    db: Session = Depends(get_db),
    service: ProjectService = Depends(lambda: project_service)
):
    """
    Update an existing project.
    Note: This PUT implementation allows partial updates based on ProjectUpdate schema.
    A strict PUT might require all fields or use a different schema (e.g., ProjectBase).
    """
    updated_project = service.update_existing_project(db, project_id=project_id, project_update=project_in)
    if updated_project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return updated_project


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT # Standard practice for successful DELETE
)
def delete_project_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    service: ProjectService = Depends(lambda: project_service)
):
    """
    Delete a project by its ID.
    """
    deleted_project = service.delete_single_project(db, project_id=project_id)
    if deleted_project is None:
        # We still return 204 even if not found, as DELETE is idempotent.
        # Alternatively, could return 404 if required.
        pass # Project didn't exist, but the desired state (non-existence) is achieved.
    # No body content is returned for 204 status code
    return None # FastAPI handles the 204 response correctly when returning None
