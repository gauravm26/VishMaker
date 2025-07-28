from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
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

from shared.auth import get_current_user, get_current_user_optional
from shared.logger import project_api_logger as logger, log_database_operation
from shared.exceptions import (
    ResourceNotFoundError, 
    AuthorizationError, 
    ValidationError,
    handle_database_error,
    require_resource_ownership
)

# Import database and services (now self-contained)
from local.db.db_core import get_db
from .features.project_management.core.services import project_service, ProjectService
from .features.project_management.api import schemas as project_schemas
from .features.requirement_generation.core.services import req_gen_service
from .features.requirement_generation.api import schemas as req_gen_schemas
from .features.waitlist.core.services import waitlist_service
from .features.waitlist.api import schemas as waitlist_schemas
# Authentication imports removed - now handled by dedicated auth lambda

# Create main router
api_router = APIRouter()

# ===============================
# NOTE: Authentication routes have been moved to the dedicated auth lambda
# ===============================

# ===============================
# PROJECT MANAGEMENT ROUTES (PROTECTED)
# ===============================
projects_router = APIRouter(prefix="/projects", tags=["Project Management"])

@projects_router.post("/", response_model=project_schemas.Project, status_code=status.HTTP_201_CREATED)
async def create_project_endpoint(
    project_in: project_schemas.ProjectCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: ProjectService = Depends(lambda: project_service)
):
    """Create a new project for the authenticated user."""
    user_id = current_user['email']
    
    try:
        logger.info(f"Creating project for user: {user_id}")
        log_database_operation(logger, "CREATE", "projects", user_id=user_id)
        
        # Add user_id to the project data
        project_data = project_in.dict()
        project_data['user_id'] = user_id
        
        created_project = service.create_project_with_user(db=db, project_data=project_data)
        
        logger.info(f"Successfully created project {created_project.id} for user {user_id}")
        return created_project
        
    except ValueError as e:
        logger.warning(f"Validation error creating project for user {user_id}: {str(e)}")
        raise ValidationError(
            message=str(e),
            error_code="PROJECT_VALIDATION_ERROR"
        )
    except Exception as e:
        logger.error(f"Error creating project for user {user_id}: {str(e)}")
        handle_database_error(e, "project creation")

@projects_router.get("/", response_model=List[project_schemas.Project])
async def read_projects_endpoint(
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: int = Query(100, ge=1, le=200, description="Maximum number of records to return"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: ProjectService = Depends(lambda: project_service)
):
    """Retrieve projects for the authenticated user."""
    user_id = current_user['email']
    
    try:
        logger.info(f"Fetching projects for user: {user_id} (skip={skip}, limit={limit})")
        log_database_operation(logger, "READ", "projects", user_id=user_id)
        
        projects = service.get_user_projects(db, user_id=user_id, skip=skip, limit=limit)
        
        logger.info(f"Retrieved {len(projects)} projects for user {user_id}")
        return projects
        
    except Exception as e:
        logger.error(f"Error fetching projects for user {user_id}: {str(e)}")
        handle_database_error(e, "project retrieval")

@projects_router.get("/{project_id}", response_model=project_schemas.Project)
async def read_project_endpoint(
    project_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: ProjectService = Depends(lambda: project_service)
):
    """Get a specific project by ID (only if owned by user)."""
    user_id = current_user['email']
    
    try:
        logger.info(f"Fetching project {project_id} for user: {user_id}")
        log_database_operation(logger, "READ", "projects", user_id=user_id, project_id=project_id)
        
        project = service.get_user_project(db, project_id=project_id, user_id=user_id)
        
        if not project:
            logger.warning(f"Project {project_id} not found for user {user_id}")
            raise ResourceNotFoundError(
                message=f"Project {project_id} not found",
                error_code="PROJECT_NOT_FOUND",
                details={"project_id": project_id, "user_id": user_id}
            )
        
        logger.info(f"Successfully retrieved project {project_id} for user {user_id}")
        return project
        
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error fetching project {project_id} for user {user_id}: {str(e)}")
        handle_database_error(e, "project retrieval")

@projects_router.delete("/{project_id}", response_model=dict)
async def delete_project_endpoint(
    project_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: ProjectService = Depends(lambda: project_service)
):
    """Delete a project (only if owned by user)."""
    user_id = current_user['email']
    
    try:
        logger.info(f"Deleting project {project_id} for user: {user_id}")
        log_database_operation(logger, "DELETE", "projects", user_id=user_id, project_id=project_id)
        
        deleted_project = service.delete_user_project(db, project_id=project_id, user_id=user_id)
        
        if not deleted_project:
            logger.warning(f"Project {project_id} not found for deletion by user {user_id}")
            raise ResourceNotFoundError(
                message=f"Project {project_id} not found",
                error_code="PROJECT_NOT_FOUND",
                details={"project_id": project_id, "user_id": user_id}
            )
        
        logger.info(f"Successfully deleted project {project_id} for user {user_id}")
        return {"message": "Project deleted successfully", "project_id": project_id}
        
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error deleting project {project_id} for user {user_id}: {str(e)}")
        handle_database_error(e, "project deletion")

# ===============================
# REQUIREMENT GENERATION ROUTES (PROTECTED)
# ===============================
req_gen_router = APIRouter(prefix="/requirements", tags=["Requirement Generation"])

@req_gen_router.post("/generate")
async def generate_requirements(
    request: req_gen_schemas.RequirementGenerationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate requirements for a project (requires authentication)."""
    user_id = current_user['email']
    
    try:
        logger.info(f"Generating requirements for project {request.project_id} by user {user_id}")
        
        # Verify project ownership
        project = project_service.get_user_project(db, project_id=request.project_id, user_id=user_id)
        if not project:
            logger.warning(f"Project {request.project_id} not found for user {user_id}")
            raise ResourceNotFoundError(
                message=f"Project {request.project_id} not found or access denied",
                error_code="PROJECT_NOT_FOUND",
                details={"project_id": request.project_id, "user_id": user_id}
            )
        
        log_database_operation(logger, "CREATE", "requirements", user_id=user_id, project_id=request.project_id)
        
        # Generate requirements
        result = req_gen_service.generate_requirements(db, request)
        
        logger.info(f"Successfully generated requirements for project {request.project_id}")
        return result
        
    except ResourceNotFoundError:
        raise
    except Exception as e:
        logger.error(f"Error generating requirements for project {request.project_id}: {str(e)}")
        handle_database_error(e, "requirement generation")

# ===============================
# WAITLIST ROUTES (PUBLIC)
# ===============================
waitlist_router = APIRouter(prefix="/waitlist", tags=["Waitlist"])

@waitlist_router.post("/join", response_model=dict)
async def join_waitlist(
    waitlist_data: waitlist_schemas.WaitlistCreate,
    db: Session = Depends(get_db)
):
    """Join the waitlist (public endpoint)."""
    try:
        logger.info(f"Waitlist join request for email: {waitlist_data.email}")
        log_database_operation(logger, "CREATE", "waitlist")
        
        result = waitlist_service.add_to_waitlist(db, waitlist_data)
        
        logger.info(f"Successfully added {waitlist_data.email} to waitlist")
        return result
        
    except Exception as e:
        logger.error(f"Error adding {waitlist_data.email} to waitlist: {str(e)}")
        handle_database_error(e, "waitlist addition")

# ===============================
# INCLUDE ALL ROUTERS
# ===============================
api_router.include_router(projects_router)
api_router.include_router(req_gen_router)
api_router.include_router(waitlist_router) 