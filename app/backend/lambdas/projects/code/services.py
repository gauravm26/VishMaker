# features/project_management/core/services.py
from sqlalchemy.orm import Session
from sqlalchemy import text
from features.project_management.api import schemas
from typing import List, Optional
from local.db.requirement import ProjectEntity as ProjectModel

class ProjectService:

    def get_project(self, db: Session, project_id: int) -> Optional[ProjectModel]:
        """Get a single project by ID."""
        # Direct database access (formerly in repository)
        return db.query(ProjectModel).filter(ProjectModel.id == project_id).first()

    def get_all_projects(self, db: Session, skip: int = 0, limit: int = 100) -> List[ProjectModel]:
        """Get a list of projects."""
        # Direct database access (formerly in repository)
        return db.query(ProjectModel).offset(skip).limit(limit).all()

    def create_project(self, db: Session, project: schemas.ProjectCreate) -> ProjectModel:
        """Create a new project."""
        # Business logic validation
        if not project.name:
            raise ValueError("Project name cannot be empty") # Example business rule
        
        # Direct database access (formerly in repository)
        db_project = ProjectModel(
            name=project.name,
            initial_prompt=project.initial_prompt
            # created_at/updated_at are handled by the database defaults/triggers
        )
        db.add(db_project) # Add to session
        db.commit()      # Commit transaction
        db.refresh(db_project) # Refresh instance to get ID and default values from DB
        return db_project

    def create_project_with_user(self, db: Session, project_data: dict) -> ProjectModel:
        """Create a new project with user association."""
        # Business logic validation
        if not project_data.get('name'):
            raise ValueError("Project name cannot be empty")
        
        if not project_data.get('user_id'):
            raise ValueError("User ID is required")
        
        # Direct database access
        db_project = ProjectModel(
            name=project_data['name'],
            initial_prompt=project_data.get('initial_prompt'),
            user_id=project_data['user_id']
        )
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        return db_project

    def get_user_projects(self, db: Session, user_id: str, skip: int = 0, limit: int = 100) -> List[ProjectModel]:
        """Get all projects for a specific user."""
        return db.query(ProjectModel).filter(ProjectModel.user_id == user_id).offset(skip).limit(limit).all()

    def get_user_project(self, db: Session, project_id: int, user_id: str) -> Optional[ProjectModel]:
        """Get a specific project only if it belongs to the user."""
        return db.query(ProjectModel).filter(
            ProjectModel.id == project_id,
            ProjectModel.user_id == user_id
        ).first()

    def delete_user_project(self, db: Session, project_id: int, user_id: str) -> Optional[ProjectModel]:
        """Delete a project only if it belongs to the user."""
        db_project = self.get_user_project(db, project_id, user_id)
        if not db_project:
            return None

        # Delete related entities using the existing logic
        # Use raw SQL to avoid foreign key constraint errors
        db.execute(
            text("""
            DELETE FROM test_cases tc
            WHERE tc.parent_uiid IN (
                SELECT llr.uiid FROM low_level_requirements llr
                JOIN high_level_requirements hlr ON llr.parent_uiid = hlr.uiid
                JOIN user_flows uf ON hlr.parent_uiid = uf.uiid
                WHERE uf.project_id = :project_id
            )
            """),
            {"project_id": project_id}
        )
        
        db.execute(
            text("""
            DELETE FROM low_level_requirements llr
            WHERE llr.parent_uiid IN (
                SELECT hlr.uiid FROM high_level_requirements hlr
                JOIN user_flows uf ON hlr.parent_uiid = uf.uiid
                WHERE uf.project_id = :project_id
            )
            """),
            {"project_id": project_id}
        )
        
        db.execute(
            text("""
            DELETE FROM high_level_requirements hlr
            WHERE hlr.parent_uiid IN (
                SELECT uf.uiid FROM user_flows uf
                WHERE uf.project_id = :project_id
            )
            """),
            {"project_id": project_id}
        )
        
        db.execute(
            text("DELETE FROM user_flows WHERE project_id = :project_id"),
            {"project_id": project_id}
        )
        
        # Finally delete the project itself
        db.delete(db_project)
        db.commit()
        
        return db_project

    def update_project(self, db: Session, project_id: int, project_update: schemas.ProjectUpdate) -> Optional[ProjectModel]:
        """Update an existing project."""
        # Direct database access (formerly in repository)
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
        """Delete a project."""
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
                DELETE FROM test_cases tc
                WHERE tc.parent_uiid IN (
                    SELECT llr.uiid FROM low_level_requirements llr
                    JOIN high_level_requirements hlr ON llr.parent_uiid = hlr.uiid
                    JOIN user_flows uf ON hlr.parent_uiid = uf.uiid
                    WHERE uf.project_id = :project_id
                )
                """),
                {"project_id": project_id}
            )
            
            # 2. Delete low_level_requirements
            db.execute(
                text("""
                DELETE FROM low_level_requirements llr
                WHERE llr.parent_uiid IN (
                    SELECT hlr.uiid FROM high_level_requirements hlr
                    JOIN user_flows uf ON hlr.parent_uiid = uf.uiid
                    WHERE uf.project_id = :project_id
                )
                """),
                {"project_id": project_id}
            )
            
            # 3. Delete high_level_requirements directly linked to user_flows
            db.execute(
                text("""
                DELETE FROM high_level_requirements hlr
                WHERE hlr.parent_uiid IN (
                    SELECT uf.uiid FROM user_flows uf
                    WHERE uf.project_id = :project_id
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


# Instantiate the service (can be used directly or injected)
project_service = ProjectService()
