# features/project_management/core/repositories.py
from sqlalchemy.orm import Session
from sqlalchemy import text
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
        try:
            db_project = self.get_project(db, project_id)
            if not db_project:
                return None

            # Get a copy of project data before deletion (for return value)
            deleted_project = db_project
            
            # Delete related entities to avoid foreign key constraint errors
            # Using raw SQL to avoid circular import issues
            
            # 1. First delete test_cases that are linked to this project via the chain
            db.execute(
                text("""
                DELETE FROM test_cases 
                WHERE low_level_requirement_id IN (
                    SELECT llr.id FROM low_level_requirements llr
                    JOIN high_level_requirements hlr ON llr.high_level_requirement_id = hlr.id
                    JOIN user_flows uf ON hlr.user_flow_id = uf.id
                    WHERE uf.project_id = :project_id
                )
                """),
                {"project_id": project_id}
            )
            
            # 2. Delete low_level_requirements
            db.execute(
                text("""
                DELETE FROM low_level_requirements 
                WHERE high_level_requirement_id IN (
                    SELECT hlr.id FROM high_level_requirements hlr
                    JOIN user_flows uf ON hlr.user_flow_id = uf.id
                    WHERE uf.project_id = :project_id
                )
                """),
                {"project_id": project_id}
            )
            
            # 3. Delete high_level_requirements directly linked to user_flows
            db.execute(
                text("""
                DELETE FROM high_level_requirements 
                WHERE user_flow_id IN (
                    SELECT id FROM user_flows
                    WHERE project_id = :project_id
                )
                """),
                {"project_id": project_id}
            )
            
            # 4. Delete user_flows
            db.execute(
                text("DELETE FROM user_flows WHERE project_id = :project_id"),
                {"project_id": project_id}
            )
            
            # Now delete the project
            db.delete(db_project)
            db.commit()
            
            # Return copied data for confirmation
            return deleted_project
            
        except Exception as e:
            # Rollback the transaction on error
            db.rollback()
            # Log the error
            print(f"Error deleting project {project_id}: {str(e)}")
            # Re-raise the exception to handle it at the API level
            raise

# Instantiate the repository (can be used directly or injected)
project_repo = ProjectRepository()
