# features/requirement_generation/core/repositories.py
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any, Optional
from shared.core.models.requirement import UserFlow, HighLevelRequirement, LowLevelRequirement, TestCase
from shared.core.models.project import Project # Need project for linking

class RequirementRepository:

    def save_requirements(self, db: Session, project_id: int, generated_data: Dict[str, List[Dict[str, Any]]]):
        """
        Saves the structured requirements data to the database.
        Expects generated_data in a specific structure (adapt as needed based on LLM output).
        Example structure:
        {
            "flows": [{"name": "Flow 1", "description": "...", "high_level_requirements": [{"text": "HLR 1", "order": 0}, ...]}, ...],
            "ll_reqs": [{"hl_req_text": "HLR 1", "flow_name": "Flow 1", "req": "LLR 1.1", "tech": "..."}, ...],
            "test_cases": [{"parent_llr_text": "LLR 1.1", "desc": "Test Case 1", "expected": "Expected result"}, ...]
        }
        """
        # --- Clear existing requirements for this project (Optional: Or implement update logic) ---
        # This simple version deletes everything first for idempotency during simulation/testing
        existing_flows = db.query(UserFlow).filter(UserFlow.project_id == project_id).all()
        for flow in existing_flows:
            db.delete(flow) # Cascade delete should handle HLRs, LLRs due to model relationships
        db.commit()
        # --- End Clear ---

        flow_map: Dict[str, UserFlow] = {}
        hlr_map: Dict[str, HighLevelRequirement] = {} # Key: "Flow Name::HLR Text"
        llr_map: Dict[str, LowLevelRequirement] = {} # Key: Some unique LLR identifier (e.g., text), Value: DB object

        # 1. Save Flows and High-Level Requirements
        for flow_data in generated_data.get("flows", []):
            db_flow = UserFlow(
                name=flow_data["name"],
                description=flow_data.get("description"),
                project_id=project_id
            )
            db.add(db_flow)
            db.flush() # Flush to get the db_flow.id before adding HLRs
            flow_map[db_flow.name] = db_flow

            for i, hlr_data in enumerate(flow_data.get("high_level_requirements", [])):
                db_hlr = HighLevelRequirement(
                    requirement_text=hlr_data["text"],
                    order=hlr_data.get("order", i), # Use provided order or default to list index
                    user_flow_id=db_flow.id
                )
                db.add(db_hlr)
                db.flush() # Get db_hlr.id
                # Key needs to be unique enough to find the HLR later for LLR mapping
                hlr_map[f"{db_flow.name}::{db_hlr.requirement_text}"] = db_hlr

        # 2. Save Low-Level Requirements
        for llr_data in generated_data.get("ll_reqs", []):
            # Need a reliable way to link LLR back to HLR
            flow_name = llr_data.get("flow_name") 
            hlr_text = llr_data.get("hl_req_text")
            hlr_key = f"{flow_name}::{hlr_text}"

            parent_hlr = hlr_map.get(hlr_key)
            if not parent_hlr:
                print(f"WARNING: Could not find parent HLR '{hlr_key}' for LLR: {llr_data['req']}")
                continue # Skip if HLR not found

            db_llr = LowLevelRequirement(
                requirement_text=llr_data["req"],
                tech_stack_details=llr_data.get("tech"),
                high_level_requirement_id=parent_hlr.id
            )
            db.add(db_llr)
            db.flush() # Get LLR ID
            # Use a combination that's likely unique for the simulation to map LLR
            llr_key = f"{parent_hlr.id}::{db_llr.requirement_text}"
            llr_map[llr_key] = db_llr

        # 3. Save Test Cases
        for tc_data in generated_data.get("test_cases", []):
            # Need a way to link Test Case back to LLR
            parent_llr_text = tc_data.get("parent_llr_text")

            # Find parent LLR using the text match approach
            parent_llr = None
            for key, llr in llr_map.items():
                 # This simple text match is not robust
                 if key.endswith(f"::{parent_llr_text}"):
                      parent_llr = llr
                      break

            if not parent_llr:
                print(f"WARNING: Could not find parent LLR for TestCase: {tc_data['desc']}")
                continue

            db_tc = TestCase(
                description=tc_data["desc"],
                expected_result=tc_data.get("expected"),
                low_level_requirement_id=parent_llr.id
            )
            db.add(db_tc)
        
        db.commit() # Commit all changes

    def get_requirements_for_project(self, db: Session, project_id: int) -> List[UserFlow]:
        """
        Retrieves all user flows and their nested requirements for a project.
        Uses joinedload to eagerly load related objects to avoid N+1 query problems.
        """
        return (
            db.query(UserFlow)
            .options(
                joinedload(UserFlow.high_level_requirements) # Load HLRs directly for each flow
                .joinedload(HighLevelRequirement.low_level_requirements) # Load LLRs for each HLR
                .joinedload(LowLevelRequirement.test_cases) # Load test cases for each LLR
            )
            .filter(UserFlow.project_id == project_id)
            .order_by(UserFlow.created_at) # Optional ordering
            .all()
        )


# Instantiate
requirement_repo = RequirementRepository()
