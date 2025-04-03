# features/requirement_generation/core/services.py
from sqlalchemy.orm import Session
from features.project_management.core.services import project_service as pj_service
from features.project_management.core.services import ProjectService as PjServiceClass
# --- ADD IMPORTS ---
from .repositories import requirement_repo, RequirementRepository
from typing import List, Dict, Any, Optional
from infrastructure.db.requirement import UserFlowEntity as UserFlow # For type hint if needed
import sys, os
from pathlib import Path

# Add infrastructure to path for BedrockService import
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(project_root))

from infrastructure.llms.llm_models import BedrockService, load_config
# --- END IMPORTS ---

class RequirementGenerationService:

    # Inject ProjectService and RequirementRepository
    def __init__(
        self,
        project_svc: PjServiceClass = pj_service,
        req_repo: RequirementRepository = requirement_repo # Inject req repo
    ):
         self.project_service = project_svc
         self.repo = req_repo # Use self.repo for requirement repository

    # --- ADD Method to Get Requirements ---
    def get_project_requirements(self, db: Session, project_id: int) -> List[UserFlow]:
        """Retrieves all requirements for a given project."""
        # Check if project exists (optional, repo might handle implicitly)
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")

        return self.repo.get_requirements_for_project(db, project_id)
    # --- End Get Method ---


# Instantiate the service (ensure it gets the default repo instance)
req_gen_service = RequirementGenerationService()