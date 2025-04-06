# features/requirement_generation/api/schemas.py
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, ForwardRef
from datetime import datetime

# Forward references to fix circular dependencies
TestCase = ForwardRef("TestCase")
LowLevelRequirement = ForwardRef("LowLevelRequirement")
HighLevelRequirement = ForwardRef("HighLevelRequirement")
UserFlow = ForwardRef("UserFlow")

# --- Trigger Response (already defined) ---
class GenerationTriggerResponse(BaseModel):
    message: str
    project_id: int
    # task_id: Optional[str] = None

# --- Requirement Schemas for API Response ---
# These mirror the SQLAlchemy models but are used for API output validation
# Use ConfigDict(from_attributes=True) to allow creation from ORM objects

class TestCase(BaseModel):
    id: int
    name: str  # Changed from description to match DB schema
    description: Optional[str] = None  # Changed from expected_result to match DB schema
    created_at: datetime
    uiid: Optional[str] = None
    parent_uiid: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
    
class LowLevelRequirement(BaseModel):
    id: int
    name: str  # Changed from requirement_text to match DB schema
    description: Optional[str] = None  # Changed from tech_stack_details to match DB schema
    created_at: datetime
    test_case_list: List[TestCase] = []  # Match ORM field name
    uiid: Optional[str] = None
    parent_uiid: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class HighLevelRequirement(BaseModel):
    id: int
    name: str  # Changed from requirement_text to match DB schema
    description: Optional[str] = None  # Added to match DB schema
    created_at: datetime
    low_level_requirement_list: List[LowLevelRequirement] = [] # Match ORM field name
    uiid: Optional[str] = None
    parent_uiid: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class UserFlow(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    project_id: int
    created_at: datetime
    high_level_requirement_list: List[HighLevelRequirement] = [] # Match ORM field name
    uiid: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# Schema for the overall response when getting requirements for a project
class ProjectRequirementsResponse(BaseModel):
    project_id: int
    flows: List[UserFlow] = []

# Resolve forward references
TestCase.update_forward_refs()
LowLevelRequirement.update_forward_refs()
HighLevelRequirement.update_forward_refs()
UserFlow.update_forward_refs()