# features/project_management/core/services.py
from sqlalchemy.orm import Session
from sqlalchemy import text
from features.project_management.api import schemas
from typing import List, Optional
from infrastructure.db.requirement import ProjectEntity as ProjectModel

class ProjectService:

    def get_project(self, db: Session, project_id: int) -> Optional[ProjectModel]:
        """Get a single project by ID."""
        # Direct database access (formerly in repository)
        return db.query(ProjectModel).filter(ProjectModel.id == project_id).first()

    def get_all_projects(self, db: Session, skip: int = 0, limit: int = 100) -> List[ProjectModel]:
        """Get a list of projects."""
        # Direct database access (formerly in repository)
        return db.query(ProjectModel).offset(skip).limit(limit).all()

    def create_new_project(self, db: Session, project_create: schemas.ProjectCreate) -> ProjectModel:
        """Create a new project."""
        # Business logic validation
        if not project_create.name:
            raise ValueError("Project name cannot be empty") # Example business rule
        
        # Direct database access (formerly in repository)
        db_project = ProjectModel(
            name=project_create.name,
            initial_prompt=project_create.initial_prompt
            # created_at/updated_at are handled by the database defaults/triggers
        )
        db.add(db_project) # Add to session
        db.commit()      # Commit transaction
        db.refresh(db_project) # Refresh instance to get ID and default values from DB
        return db_project

    def update_existing_project(self, db: Session, project_id: int, project_update: schemas.ProjectUpdate) -> Optional[ProjectModel]:
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

    def delete_single_project(self, db: Session, project_id: int) -> Optional[ProjectModel]:
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

    # Alias methods to maintain backward compatibility if needed
    def get_projects(self, db: Session, skip: int = 0, limit: int = 100) -> List[ProjectModel]:
        return self.get_all_projects(db, skip, limit)
        
    def create_project(self, db: Session, project: schemas.ProjectCreate) -> ProjectModel:
        return self.create_new_project(db, project)
        
    def update_project(self, db: Session, project_id: int, project_update: schemas.ProjectUpdate) -> Optional[ProjectModel]:
        return self.update_existing_project(db, project_id, project_update)
        
    def delete_project(self, db: Session, project_id: int) -> Optional[ProjectModel]:
        return self.delete_single_project(db, project_id)

# Instantiate the service (can be used directly or injected)
project_service = ProjectService()
