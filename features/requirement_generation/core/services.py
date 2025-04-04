# features/requirement_generation/core/services.py
from sqlalchemy.orm import Session, joinedload
from features.project_management.core.services import project_service as pj_service
from features.project_management.core.services import ProjectService as PjServiceClass
# --- ADD IMPORTS ---
from typing import List, Dict, Any, Optional
from infrastructure.db.requirement import UserFlowEntity as UserFlow, HighLevelRequirementEntity as HighLevelRequirement, LowLevelRequirementEntity as LowLevelRequirement, TestCaseEntity as TestCase
from infrastructure.db.requirement import ProjectEntity as Project # Need project for linking
import sys, os
from pathlib import Path

# Add infrastructure to path for BedrockService import
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(project_root))

from infrastructure.llms.llm_models import BedrockService, load_config
# --- END IMPORTS ---

class RequirementGenerationService:

    # Inject ProjectService
    def __init__(
        self,
        project_svc: PjServiceClass = pj_service
    ):
         self.project_service = project_svc

    def save_llm_generated_data(self, db: Session, project_id: int, table_type: str, raw_content: str):
        """
        Generic method to save LLM-generated data to the appropriate table.
        
        Args:
            db: Database session
            project_id: ID of the project to save data for
            table_type: Type of table to save to ('user_flow', 'high_level_requirement', etc.)
            raw_content: Raw pipe-delimited content from the LLM
            
        Returns:
            bool: True if successful
        """
        # Verify project exists
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")
        
        # Parse the raw content into a standardized format
        parsed_data = self._parse_pipe_delimited_content(raw_content)
        
        # Call appropriate method based on table_type
        if table_type == "user_flow":
            # Convert standardized format to user flow format
            flows_data = self._convert_to_user_flow_format(parsed_data)
            generated_data = {
                "flows": flows_data,
                "ll_reqs": [], 
                "test_cases": []
            }
            return self.save_requirements(db, project_id, generated_data)
            
        elif table_type == "high_level_requirement":
            # Convert standardized format to high-level requirement format
            hlr_data = self._convert_to_hlr_format(parsed_data)
            generated_data = {
                "hlrs": hlr_data,
                "ll_reqs": [],
                "test_cases": []
            }
            return self.save_high_level_requirements(db, project_id, generated_data)
            
        elif table_type == "low_level_requirement":
            # Convert standardized format to low-level requirement format
            llr_data = self._convert_to_llr_format(parsed_data)
            generated_data = {
                "ll_reqs": llr_data,
                "test_cases": []
            }
            return self.save_low_level_requirements(db, project_id, generated_data)
            
        elif table_type == "test_case":
            # Convert standardized format to test case format
            test_case_data = self._convert_to_test_case_format(parsed_data)
            generated_data = {
                "test_cases": test_case_data
            }
            return self.save_test_cases(db, project_id, generated_data)
            
        else:
            # Default to user flow
            flows_data = self._convert_to_user_flow_format(parsed_data)
            generated_data = {
                "flows": flows_data,
                "ll_reqs": [], 
                "test_cases": []
            }
            return self.save_requirements(db, project_id, generated_data)
    
    def _parse_pipe_delimited_content(self, content: str) -> List[Dict[str, Any]]:
        """
        Parse pipe-delimited LLM output into a standardized format.
        
        Expected format:
        Name/Title | Description/Details
        
        Returns:
        List of dictionaries with name, description, and order
        """
        if not content or not content.strip():
            raise ValueError("Content is empty")
        
        # Check if content is in pipe-delimited format and fix if needed
        if not self._validate_pipe_delimited_format(content):
            content = self._fix_output_format(content)
        
        # Parse each line
        lines = content.strip().split('\n')
        items = []
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            if '|' not in line:
                # Try to fix lines without pipe delimiter
                if ':' in line:
                    parts = line.split(':', 1)
                    line = f"{parts[0].strip()} | {parts[1].strip()}"
                elif '.' in line:
                    parts = line.split('.', 1)
                    line = f"{parts[0].strip()} | {parts[1].strip()}"
                else:
                    line = f"Item {i+1} | {line}"
                
            parts = line.split('|', 1)
            name = parts[0].strip()
            description = parts[1].strip() if len(parts) > 1 else ""
            
            items.append({
                "name": name,
                "description": description,
                "order": i
            })
        
        return items
    
    def _validate_pipe_delimited_format(self, text: str) -> bool:
        """Validate that the text is in pipe-delimited format"""
        lines = text.strip().split('\n')
        return all('|' in line for line in lines if line.strip())
    
    def _fix_output_format(self, text: str) -> str:
        """Attempt to fix the output format if it's not pipe-delimited"""
        lines = text.strip().split('\n')
        formatted_lines = []
        
        for line in lines:
            if line.strip():
                if '|' not in line:
                    # Attempt to split into name and description
                    parts = line.split('.', 1)
                    if len(parts) == 2:
                        formatted_lines.append(f"{parts[0].strip()} | {parts[1].strip()}")
                    else:
                        formatted_lines.append(f"Step {len(formatted_lines) + 1} | {line.strip()}")
                else:
                    formatted_lines.append(line)
        
        return '\n'.join(formatted_lines)
    
    # Helper methods to convert standardized format to specific formats
    def _convert_to_user_flow_format(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert standardized data to user flow format"""
        flows = []
        
        for item in data:
            # Create a separate user flow for each item, directly using name/description
            flows.append({
                "name": item.get("name", "Untitled Flow"),
                "description": item.get("description", ""),
                "high_level_requirement_list": []  # Empty list as we're using each item as a flow, not as HLRs
            })
        
        return flows
    
    def _convert_to_hlr_format(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert standardized data to high-level requirement format"""
        return data  # Already in right format with name, description, order
    
    def _convert_to_llr_format(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert standardized data to low-level requirement format"""
        return [{"req": item.get("name", ""), "tech": item.get("description", "")} for item in data]
    
    def _convert_to_test_case_format(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert standardized data to test case format"""
        return [{"desc": item.get("name", ""), "expected": item.get("description", "")} for item in data]

    # --- ADD REPOSITORY METHODS ---
    def get_project_requirements(self, db: Session, project_id: int) -> List[UserFlow]:
        """
        Retrieves all user flows and their nested requirements for a project.
        Uses joinedload to eagerly load related objects to avoid N+1 query problems.
        """
        # Verify project exists first
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")
        
        # Query the user flows with eager loading
        flows = (
            db.query(UserFlow)
            .options(
                joinedload(UserFlow.high_level_requirement_list) # Load HLRs directly for each flow
                .joinedload(HighLevelRequirement.low_level_requirement_list) # Load LLRs for each HLR
                .joinedload(LowLevelRequirement.test_case_list) # Load test cases for each LLR
            )
            .filter(UserFlow.project_id == project_id)
            .order_by(UserFlow.created_at) # Optional ordering
            .all()
        )
        
        # Return the flows directly - Pydantic will handle the conversion from ORM objects
        return flows
    
    def save_requirements(self, db: Session, project_id: int, generated_data: Dict[str, List[Dict[str, Any]]]):
        """
        Saves the structured requirements data to the database.
        Expects generated_data in a specific structure (adapt as needed based on LLM output).
        Example structure:
        {
            "flows": [{"name": "Flow 1", "description": "...", "high_level_requirement_list": [{"text": "HLR 1", "order": 0}, ...]}, ...],
            "ll_reqs": [{"hl_req_text": "HLR 1", "flow_name": "Flow 1", "req": "LLR 1.1", "tech": "..."}, ...],
            "test_cases": [{"parent_llr_text": "LLR 1.1", "desc": "Test Case 1", "expected": "Expected result"}, ...]
        }
        """
        # Verify project exists
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")
        
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

            # Check if we have high_level_requirement_list in the flow_data
            high_level_reqs = flow_data.get("high_level_requirement_list") or flow_data.get("high_level_requirements", [])
            
            # If no high-level requirements are provided, create one based on the flow itself
            if not high_level_reqs:
                # Create a high-level requirement with the flow name as the text
                db_hlr = HighLevelRequirement(
                    requirement_text=f"Implement {flow_data['name']}",
                    order=0,
                    user_flow_id=db_flow.id
                )
                db.add(db_hlr)
                db.flush()
                hlr_map[f"{db_flow.name}::Implement {flow_data['name']}"] = db_hlr
            else:
                for i, hlr_data in enumerate(high_level_reqs):
                    # Support both dictionary structures that might be used
                    req_text = hlr_data.get("text") or hlr_data.get("requirement_text", "")
                    if not req_text:
                        continue
                        
                    db_hlr = HighLevelRequirement(
                        requirement_text=req_text,
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
        return True
        
    def save_high_level_requirements(self, db: Session, project_id: int, generated_data: Dict[str, List[Dict[str, Any]]]):
        """
        Saves high-level requirements data for a project.
        
        Args:
            db: Database session
            project_id: ID of the project to save requirements for
            generated_data: Dictionary containing structured high-level requirement data
        """
        # Verify project exists
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")
            
        # Validate minimal required structure
        if "hlrs" not in generated_data or not generated_data["hlrs"]:
            raise ValueError("Generated data must contain at least one high-level requirement")
            
        # Get existing flows for this project
        existing_flows = self.get_project_requirements(db, project_id)
        
        if not existing_flows:
            raise ValueError(f"No flows found for project with ID {project_id}. Create a flow first.")
        
        # Take the first flow to attach high-level requirements to
        flow_id = existing_flows[0].id
        
        # Create a modified structure compatible with save_requirements
        modified_data = {
            "flows": [{
                "id": flow_id,  # Use existing flow ID
                "high_level_requirements": generated_data["hlrs"]
            }],
            "ll_reqs": generated_data.get("ll_reqs", []),
            "test_cases": generated_data.get("test_cases", [])
        }
        
        # Call repository to save the requirements
        return self.save_requirements(db, project_id, modified_data)
        
    def save_low_level_requirements(self, db: Session, project_id: int, generated_data: Dict[str, List[Dict[str, Any]]]):
        """
        Saves low-level requirements data for a project.
        
        Args:
            db: Database session
            project_id: ID of the project to save requirements for
            generated_data: Dictionary containing structured low-level requirement data
        """
        # Verify project exists
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")
            
        # Validate minimal required structure
        if "ll_reqs" not in generated_data or not generated_data["ll_reqs"]:
            raise ValueError("Generated data must contain at least one low-level requirement")
        
        # For now, we'll reuse the existing save_requirements method
        return self.save_requirements(db, project_id, generated_data)
        
    def save_test_cases(self, db: Session, project_id: int, generated_data: Dict[str, List[Dict[str, Any]]]):
        """
        Saves test case data for a project.
        
        Args:
            db: Database session
            project_id: ID of the project to save requirements for
            generated_data: Dictionary containing structured test case data
        """
        # Verify project exists
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")
            
        # Validate minimal required structure
        if "test_cases" not in generated_data or not generated_data["test_cases"]:
            raise ValueError("Generated data must contain at least one test case")
        
        # For now, we'll reuse the existing save_requirements method
        return self.save_requirements(db, project_id, generated_data)

# Instantiate the service (ensure it gets the default repo instance)
req_gen_service = RequirementGenerationService()