# features/requirement_generation/core/services.py
from sqlalchemy.orm import Session, joinedload
from features.project_management.core.services import project_service as pj_service
from features.project_management.core.services import ProjectService as PjServiceClass
# --- ADD IMPORTS ---
from typing import List, Dict, Any, Optional
from local.db.requirement import UserFlowEntity as UserFlow, HighLevelRequirementEntity as HighLevelRequirement, LowLevelRequirementEntity as LowLevelRequirement, TestCaseEntity as TestCase
from local.db.requirement import ProjectEntity as Project # Need project for linking
import sys, os
from pathlib import Path
import time

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

    def save_llm_generated_data(self, db: Session, project_id: int, table_type: str, raw_content: str, parent_uiid: Optional[str] = None):
        """
        Generic method to save LLM-generated data to the appropriate table.
        
        Args:
            db: Database session
            project_id: ID of the project to associate with the content
            table_type: Type of table to save to ('user_flow', 'high_level_requirement', 'low_level_requirement', 'test_case')
            raw_content: Raw pipe-delimited content from the LLM
            parent_uiid: UIID of the parent entity (if applicable)
            
        Returns:
            bool: True if successful
        """
        # Verify project exists
        project = self.project_service.get_project(db, project_id)
        if not project:
            raise ValueError(f"Project with ID {project_id} not found.")
        
        # Parse the raw content into a standardized format
        parsed_data = self._parse_pipe_delimited_content(raw_content)
        
        # Insert data directly into the target table based on table_type
        if table_type == "user_flow":
            return self._save_user_flows(db, parsed_data, project_id)
            
        elif table_type == "high_level_requirement":
            return self._save_high_level_requirements(db,  parsed_data, parent_uiid)
            
        elif table_type == "low_level_requirement":
            return self._save_low_level_requirements(db, parsed_data, parent_uiid)
            
        elif table_type == "test_case":
            return self._save_test_cases(db, parsed_data, parent_uiid)
            
        else:
            raise ValueError(f"Unknown table type: {table_type}")
    
    def _parse_pipe_delimited_content(self, content: str) -> List[Dict[str, Any]]:
        """
        Parse pipe-delimited LLM output into a standardized format.
        
        Expected format:
        Name/Title | Description/Details | UIID (optional)
        
        Returns:
        List of dictionaries with name, description, uiid, and order
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
                
            parts = line.split('|')
            name = parts[0].strip()
            description = parts[1].strip() if len(parts) > 1 else ""
            
            # Extract UIID if present, or generate a unique one
            uiid = parts[2].strip() if len(parts) > 2 and parts[2].strip() else f"auto-{i}-{hash(name + description) & 0xffffffff}"
            
            items.append({
                "name": name,
                "description": description,
                "uiid": uiid,
                "order": i
            })
        
        return items
    
    def _validate_pipe_delimited_format(self, text: str) -> bool:
        """
        Validate that the text is in pipe-delimited format.
        Checks that most lines contain at least one pipe character.
        """
        lines = text.strip().split('\n')
        valid_lines = [line for line in lines if line.strip()]
        if not valid_lines:
            return False
            
        # Check if at least 70% of lines have a pipe character
        lines_with_pipe = sum(1 for line in valid_lines if '|' in line)
        return lines_with_pipe / len(valid_lines) >= 0.7
    
    def _fix_output_format(self, text: str) -> str:
        """
        Attempt to fix the output format if it's not pipe-delimited.
        Looks for patterns in the text that might indicate name/description pairs.
        """
        lines = text.strip().split('\n')
        formatted_lines = []
        
        for i, line in enumerate(lines):
            if not line.strip():
                continue
                
            if '|' not in line:
                # Try different splitting strategies
                if ':' in line:
                    # Split by colon (common in key-value pairs)
                    parts = line.split(':', 1)
                    formatted_lines.append(f"{parts[0].strip()} | {parts[1].strip()}")
                elif '. ' in line and line[0].isdigit():
                    # Split numbered items (e.g., "1. First item")
                    parts = line.split('. ', 1)
                    formatted_lines.append(f"Item {parts[0].strip()} | {parts[1].strip()}")
                elif line.strip().startswith('- '):
                    # Handle bullet points
                    content = line.strip()[2:]
                    formatted_lines.append(f"Item {i+1} | {content}")
                else:
                    formatted_lines.append(f"Item {i+1} | {line.strip()}")
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
        return [{"name": item.get("name", ""), "description": item.get("description", "")} for item in data]
    
    def _convert_to_test_case_format(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert standardized data to test case format"""
        return [{"name": item.get("name", ""), "description": item.get("description", "")} for item in data]

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
    
    def _save_user_flows(self, db: Session, parsed_data: List[Dict[str, Any]], project_id: int) -> bool:
        """
        Save parsed data directly to the user_flow table.
        Project ID is the parent key for user flows.
        """
        for item in parsed_data:
            # Check if a flow with this UIID already exists
            uiid = item.get("uiid")
            existing_flow = None
            
            if uiid:
                existing_flow = db.query(UserFlow).filter(
                    UserFlow.uiid == uiid,
                    UserFlow.project_id == project_id
                ).first()
            
            if existing_flow:
                # Update existing flow
                existing_flow.name = item["name"]
                existing_flow.description = item.get("description", "")
                db.add(existing_flow)
            else:
                # Create new flow
                db_flow = UserFlow(
                    name=item["name"],
                    description=item.get("description", ""),
                    uiid=uiid or f"flow-{hash(item['name']) & 0xffffffff}",
                    project_id=project_id
                )
                db.add(db_flow)
            
        db.commit()
        return True
        
    def _save_high_level_requirements(self, db: Session, parsed_data: List[Dict[str, Any]], parent_uiid: Optional[str] = None) -> bool:
        """
        Save parsed data directly to the high_level_requirement table.
        User flow ID is the parent key for high-level requirements.
        """
        # Print debugging information
        print(f"Saving high-level requirements with parent_uiid: {parent_uiid}")
        print(f"Number of items to save: {len(parsed_data)}")
        
        # Always create new HLRs rather than updating existing ones
        # This ensures we don't overwrite existing HLRs but append new ones
        for item in parsed_data:
            # Generate a unique UIID for the new requirement
            # Don't reuse any existing UIIDs to avoid overwrites
            new_uiid = f"hlr-{hash(item['name'] + str(time.time())) & 0xffffffff}"
            
            # Create new HLR
            db_hlr = HighLevelRequirement(
                name=item["name"],
                description=item.get("description", ""),
                uiid=new_uiid,
                parent_uiid=parent_uiid
            )
            db.add(db_hlr)
            print(f"Created new HLR: {item['name']} with UIID: {new_uiid} for parent: {parent_uiid}")
            
        db.commit()
        return True
        
    def _save_low_level_requirements(self, db: Session, parsed_data: List[Dict[str, Any]], parent_uiid: Optional[str] = None) -> bool:
        """
        Save parsed data directly to the low_level_requirement table.
        High-level requirement ID is the parent key for low-level requirements.
        """
        for item in parsed_data:
            # Check if an LLR with this UIID already exists
            new_uiid = f"llr-{hash(item['name'] + str(time.time())) & 0xffffffff}"
                # Create new LLR
            db_llr = LowLevelRequirement(
                name=item["name"],
                description=item.get("description", ""),
                uiid=new_uiid,
                parent_uiid=parent_uiid
            )
            db.add(db_llr)
            
        db.commit()
        return True
        
    def _save_test_cases(self, db: Session,  parsed_data: List[Dict[str, Any]], parent_uiid: Optional[str] = None) -> bool:
        """
        Save parsed data directly to the test_case table.
        Low-level requirement ID is the parent key for test cases.
        """
        for item in parsed_data:
            # Check if a test case with this UIID already exists
            new_uiid = f"tc-{hash(item['name'] + str(time.time())) & 0xffffffff}"
            
            # Create new test case
            db_tc = TestCase(
                name=item["name"],
                description=item.get("description", ""),
                uiid=new_uiid,
                parent_uiid=parent_uiid
            )
            db.add(db_tc)
           
        db.commit()
        return True

# Instantiate the service (ensure it gets the default repo instance)
req_gen_service = RequirementGenerationService()