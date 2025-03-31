# features/requirement_generation/core/services.py
from sqlalchemy.orm import Session
from features.project_management.core.services import project_service as pj_service
from features.project_management.core.services import ProjectService as PjServiceClass
# --- ADD IMPORTS ---
from .repositories import requirement_repo, RequirementRepository
from typing import List, Dict, Any, Optional
from shared.core.models.requirement import UserFlow # For type hint if needed
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

    def generate_requirements_for_project(self, db: Session, project_id: int, component_id: str):
        """Generate user flow requirements for a project using LLM
        
        Args:
            db: Database session
            project_id: ID of the project
            component_id: ID of the component to use for LLM processing (required)
        """
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")
        if not project.initial_prompt:
            raise ValueError(f"Project {project_id} does not have an initial prompt.")

        print(f"--- Starting Requirement Generation for Project {project_id} ---")
        print(f"Prompt: {project.initial_prompt}")
        print(f"Component ID: {component_id}")

        # Initialize BedrockService and get config
        config = load_config()
        bedrock_service = BedrockService()
        
        # Find component mapping from config
        component_mapping = None
        for component_key, component_data in config['llm'].get('componentModelMapping', {}).items():
            if component_data.get('componentId') == component_id:
                component_mapping = component_data
                break
        
        if not component_mapping:
            raise ValueError(f"Component '{component_id}' not found in configuration")

        print(f"Using component: {component_mapping.get('componentId')}")

        user_flow_data = []
        try:
            # Process the model chain with the project's prompt
            current_text = project.initial_prompt
            
            # Loop through each model instruction
            for model_instruction in component_mapping.get('modelInstructions', []):
                model_key = model_instruction.get('model')
                instruction_key = model_instruction.get('instruction')
                
                print(f"Processing with model: {model_key}, instruction: {instruction_key}")
                
                # Get instruction from config
                instruction = None
                for instr_key, instr_data in config['llm'].get('instructions', {}).items():
                    if instr_key == instruction_key:
                        instruction = instr_data
                        break
                
                if not instruction:
                    raise ValueError(f"Instruction '{instruction_key}' not found in configuration")
                
                # Invoke the model
                content, _ = bedrock_service.invoke_model(model_key, instruction, current_text)
                current_text = content  # Use the output as input for the next model
            
            # At this point, current_text should contain pipe-delimited user flow steps
            print("Processing LLM output to structured data...")
            
            # Parse pipe-delimited content into structured flow data
            flow_name = "Main User Flow"
            flow_description = f"Generated flow for project: {project.name}"
            steps = []
            
            lines = current_text.strip().split('\n')
            for i, line in enumerate(lines):
                if '|' in line:
                    parts = line.split('|', 1)  # Split on first pipe only
                    if len(parts) == 2:
                        step_name = parts[0].strip()
                        step_description = parts[1].strip()
                        steps.append({
                            "name": step_name,
                            "order": i
                        })
            
            # Format for the repository's save_requirements method
            user_flow_data = {
                "flows": [
                    {
                        "name": flow_name,
                        "description": flow_description,
                        "steps": steps
                    }
                ],
                # Empty placeholders for future expansion
                "hl_reqs": [],
                "ll_reqs": [],
                "test_cases": []
            }
            
            print(f"Generated user flow with {len(steps)} steps")
            
        except Exception as e:
            import traceback
            print(f"ERROR during LLM processing: {str(e)}")
            print(traceback.format_exc())
            # Return simulated data as fallback for development
            user_flow_data = {
                "flows": [
                    {
                        "name": "Fallback Flow",
                        "description": "Generated fallback flow due to LLM error.",
                        "steps": [
                            {"name": "Start", "order": 0},
                            {"name": "Process", "order": 1},
                            {"name": "Complete", "order": 2}
                        ]
                    }
                ],
                "hl_reqs": [],
                "ll_reqs": [],
                "test_cases": []
            }

        # Save the processed data to the database
        print("Saving requirements to database...")
        try:
            self.repo.save_requirements(db, project_id, user_flow_data)
            print("Database save complete.")
        except Exception as e:
            db.rollback() # Rollback on error
            print(f"ERROR saving requirements: {e}")
            raise # Re-raise the exception to be caught by the endpoint

        print(f"--- Finished Requirement Generation for Project {project_id} ---")
        return {
            "message": "Requirement generation and saving complete.",
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