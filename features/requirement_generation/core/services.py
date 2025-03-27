# features/requirement_generation/core/services.py
from sqlalchemy.orm import Session
from features.project_management.core.services import project_service as pj_service
from features.project_management.core.services import ProjectService as PjServiceClass
# --- ADD IMPORTS ---
from .repositories import requirement_repo, RequirementRepository
from typing import List, Dict, Any
from shared.core.models.requirement import UserFlow # For type hint if needed
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

    def generate_requirements_for_project(self, db: Session, project_id: int):
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")
        if not project.initial_prompt:
            raise ValueError(f"Project {project_id} does not have an initial prompt.")

        print(f"--- Starting Requirement Generation for Project {project_id} ---")
        print(f"Prompt: {project.initial_prompt}")
        print("Simulating LLM call...")

        # --- SIMULATED LLM Output Structure ( Matches Repo Expectation ) ---
        simulated_llm_output = {
            "flows": [
                {
                    "name": "Authentication",
                    "description": "Handles user login and registration.",
                    "steps": [
                        {"name": "Login Page", "order": 0},
                        {"name": "Submit Credentials", "order": 1},
                        {"name": "Registration Page", "order": 2},
                    ]
                },
                {
                    "name": "Product Browsing",
                    "description": "Allows users to view products.",
                    "steps": [
                        {"name": "View Product List", "order": 0},
                        {"name": "View Product Detail", "order": 1},
                    ]
                }
            ],
            "hl_reqs": [
                {"flow_name": "Authentication", "flow_step_name": "Login Page", "req": "Display username and password fields."},
                {"flow_name": "Authentication", "flow_step_name": "Submit Credentials", "req": "Validate credentials against database."},
                {"flow_name": "Product Browsing", "flow_step_name": "View Product List", "req": "Fetch and display product grid."},
            ],
            "ll_reqs": [
                {"hl_req_text": "Display username and password fields.", "req": "Create React <LoginForm> component with two inputs.", "tech": "React, TSX"},
                {"hl_req_text": "Validate credentials against database.", "req": "Create FastAPI endpoint /auth/token.", "tech": "FastAPI, Python"},
                {"hl_req_text": "Fetch and display product grid.", "req": "Implement GET /products endpoint with pagination.", "tech": "FastAPI, Python"},
                {"hl_req_text": "Fetch and display product grid.", "req": "Create React <ProductGrid> component.", "tech": "React, TSX"},
            ]
        }
        # --- End Simulation ---
        print("LLM Simulation Complete.")

        # --- Use Repository to Save Data ---
        print("Saving requirements to database...")
        try:
            self.repo.save_requirements(db, project_id, simulated_llm_output)
            print("Database save complete.")
        except Exception as e:
            db.rollback() # Rollback on error
            print(f"ERROR saving requirements: {e}")
            raise # Re-raise the exception to be caught by the endpoint
        # --- End Save ---

        print(f"--- Finished Requirement Generation for Project {project_id} ---")
        return {
            "message": "Requirement generation and saving (simulated) complete.",
            "project_id": project_id,
        }

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