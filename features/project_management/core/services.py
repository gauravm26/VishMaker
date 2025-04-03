# features/project_management/core/services.py
from sqlalchemy.orm import Session
from features.project_management.core.repositories import project_repo, ProjectRepository # Import instance and class
from features.project_management.api import schemas
from typing import List, Optional
from infrastructure.db.requirement import ProjectEntity as ProjectModel

class ProjectService:

    def __init__(self, repo: ProjectRepository = project_repo):
         # Allow injecting a different repository implementation (useful for testing)
        self.repo = repo

    def get_project(self, db: Session, project_id: int) -> Optional[ProjectModel]:
        """Get a single project by ID."""
        # Future: Add business logic here (e.g., permissions check)
        return self.repo.get_project(db, project_id)

    def get_all_projects(self, db: Session, skip: int = 0, limit: int = 100) -> List[ProjectModel]:
        """Get a list of projects."""
        # Future: Add business logic here
        return self.repo.get_projects(db, skip=skip, limit=limit)

    def create_new_project(self, db: Session, project_create: schemas.ProjectCreate) -> ProjectModel:
        """Create a new project."""
        # Future: Add more complex validation or default setting logic here
        if not project_create.name:
            raise ValueError("Project name cannot be empty") # Example business rule
        return self.repo.create_project(db, project_create)

    def update_existing_project(self, db: Session, project_id: int, project_update: schemas.ProjectUpdate) -> Optional[ProjectModel]:
        """Update an existing project."""
        # Future: Add business logic here (e.g., check if user owns project)
        return self.repo.update_project(db, project_id, project_update)

    def delete_single_project(self, db: Session, project_id: int) -> Optional[ProjectModel]:
        """Delete a project."""
        # Future: Add business logic (e.g., cleanup related resources)
        return self.repo.delete_project(db, project_id)


# Instantiate the service (can be used directly or injected)
project_service = ProjectService()
