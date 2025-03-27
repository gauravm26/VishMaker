# features/project_management/core/repositories.py
from sqlalchemy.orm import Session
from shared.core.models.project import Project as ProjectModel # Rename model import
from features.project_management.api import schemas # Import schemas from the feature's api dir
from typing import List, Optional

class ProjectRepository:

    def get_project(self, db: Session, project_id: int) -> Optional[ProjectModel]:
        """Fetches a single project by its ID."""
        return db.query(ProjectModel).filter(ProjectModel.id == project_id).first()

    def get_projects(self, db: Session, skip: int = 0, limit: int = 100) -> List[ProjectModel]:
        """Fetches a list of projects with pagination."""
        return db.query(ProjectModel).offset(skip).limit(limit).all()

    def create_project(self, db: Session, project: schemas.ProjectCreate) -> ProjectModel:
        """Creates a new project in the database."""
        # Create a SQLAlchemy model instance from the Pydantic schema
        db_project = ProjectModel(
            name=project.name,
            initial_prompt=project.initial_prompt
            # created_at/updated_at are handled by the database defaults/triggers
        )
        db.add(db_project) # Add to session
        db.commit()      # Commit transaction
        db.refresh(db_project) # Refresh instance to get ID and default values from DB
        return db_project

    def update_project(self, db: Session, project_id: int, project_update: schemas.ProjectUpdate) -> Optional[ProjectModel]:
        """Updates an existing project."""
        db_project = self.get_project(db, project_id)
        if not db_project:
            return None

        # Get update data, excluding unset fields to allow partial updates
        update_data = project_update.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(db_project, key, value)

        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        return db_project

    def delete_project(self, db: Session, project_id: int) -> Optional[ProjectModel]:
        """Deletes a project."""
        db_project = self.get_project(db, project_id)
        if not db_project:
            return None

        db.delete(db_project)
        db.commit()
        return db_project # Return the deleted object (or its ID) for confirmation

# Instantiate the repository (can be used directly or injected)
project_repo = ProjectRepository()
