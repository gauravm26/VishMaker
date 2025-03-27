# features/requirement_generation/core/repositories.py
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any, Optional
from shared.core.models.requirement import UserFlow, FlowStep, HighLevelRequirement, LowLevelRequirement
from shared.core.models.project import Project # Need project for linking

class RequirementRepository:

    def save_requirements(self, db: Session, project_id: int, generated_data: Dict[str, List[Dict[str, Any]]]):
        """
        Saves the structured requirements data to the database.
        Expects generated_data in a specific structure (adapt as needed based on LLM output).
        Example structure:
        {
            "flows": [{"name": "Flow 1", "description": "...", "steps": [{"name": "Step 1.1", "order": 0}, ...]}, ...],
            "hl_reqs": [{"flow_step_name": "Step 1.1", "flow_name": "Flow 1", "req": "HLR 1"}, ...],
            "ll_reqs": [{"hl_req_text": "HLR 1", "req": "LLR 1.1", "tech": "..."}, ...]
        }
        NOTE: This structure requires mapping names/text back to IDs, which can be inefficient.
              A better approach might be to structure LLM output with relationships or process it differently.
              This is a simplified example.
        """
        # --- Clear existing requirements for this project (Optional: Or implement update logic) ---
        # This simple version deletes everything first for idempotency during simulation/testing
        existing_flows = db.query(UserFlow).filter(UserFlow.project_id == project_id).all()
        for flow in existing_flows:
            db.delete(flow) # Cascade delete should handle steps, HLRs, LLRs due to model relationships
        db.commit()
        # --- End Clear ---

        flow_map: Dict[str, UserFlow] = {}
        step_map: Dict[str, FlowStep] = {} # Key: "Flow Name::Step Name"
        hlr_map: Dict[str, HighLevelRequirement] = {} # Key: "Step Name::HLR Text"

        # 1. Save Flows and Steps
        for flow_data in generated_data.get("flows", []):
            db_flow = UserFlow(
                name=flow_data["name"],
                description=flow_data.get("description"),
                project_id=project_id
            )
            db.add(db_flow)
            db.flush() # Flush to get the db_flow.id before adding steps
            flow_map[db_flow.name] = db_flow

            for i, step_data in enumerate(flow_data.get("steps", [])):
                db_step = FlowStep(
                    name=step_data["name"],
                    order=step_data.get("order", i), # Use provided order or default to list index
                    user_flow_id=db_flow.id
                )
                db.add(db_step)
                db.flush() # Get db_step.id
                step_map[f"{db_flow.name}::{db_step.name}"] = db_step

        # 2. Save High-Level Requirements
        for hlr_data in generated_data.get("hl_reqs", []):
            flow_name = hlr_data.get("flow_name") # Need flow name to find step correctly
            step_name = hlr_data.get("flow_step_name")
            step_key = f"{flow_name}::{step_name}" if flow_name else step_name # Adjust key format if needed

            target_step = step_map.get(step_key)
            if not target_step:
                print(f"WARNING: Could not find step '{step_key}' for HLR: {hlr_data['req']}")
                continue # Skip if step not found

            db_hlr = HighLevelRequirement(
                requirement_text=hlr_data["req"],
                flow_step_id=target_step.id
            )
            db.add(db_hlr)
            db.flush() # Get db_hlr.id
            # Key needs to be unique enough to find the HLR later for LLR mapping
            hlr_map[f"{step_key}::{db_hlr.requirement_text}"] = db_hlr

        # 3. Save Low-Level Requirements
        for llr_data in generated_data.get("ll_reqs", []):
            # Need a reliable way to link LLR back to HLR
            # Using HLR text + step name assumes HLR text is unique per step. Risky!
            # A better LLM output structure or parsing logic is needed long-term.
            hlr_text_key_part = llr_data.get("hl_req_text") # Assuming LLM provides the parent HLR text

            # Try to find the parent HLR based on text (demonstration - brittle)
            parent_hlr = None
            for key, hlr in hlr_map.items():
                 # This simple text match is not robust
                if key.endswith(f"::{hlr_text_key_part}"):
                     parent_hlr = hlr
                     break # Assume first match is correct

            if not parent_hlr:
                print(f"WARNING: Could not find parent HLR for LLR: {llr_data['req']}")
                continue # Skip if HLR not found

            db_llr = LowLevelRequirement(
                requirement_text=llr_data["req"],
                tech_stack_details=llr_data.get("tech"),
                high_level_requirement_id=parent_hlr.id
            )
            db.add(db_llr)

        db.commit() # Commit all changes

    def get_requirements_for_project(self, db: Session, project_id: int) -> List[UserFlow]:
        """
        Retrieves all user flows and their nested requirements for a project.
        Uses joinedload to eagerly load related objects to avoid N+1 query problems.
        """
        return (
            db.query(UserFlow)
            .options(
                joinedload(UserFlow.steps) # Load steps
                .joinedload(FlowStep.high_level_requirements) # Load HLRs for each step
                .joinedload(HighLevelRequirement.low_level_requirements) # Load LLRs for each HLR
            )
            .filter(UserFlow.project_id == project_id)
            .order_by(UserFlow.created_at) # Optional ordering
            .all()
        )


# Instantiate
requirement_repo = RequirementRepository()
