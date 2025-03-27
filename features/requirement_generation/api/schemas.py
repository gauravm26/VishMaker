# features/requirement_generation/api/schemas.py
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

# --- Trigger Response (already defined) ---
class GenerationTriggerResponse(BaseModel):
    message: str
    project_id: int
    # task_id: Optional[str] = None

# --- Requirement Schemas for API Response ---
# These mirror the SQLAlchemy models but are used for API output validation
# Use ConfigDict(from_attributes=True) to allow creation from ORM objects

class LowLevelRequirement(BaseModel):
    id: int
    requirement_text: str
    tech_stack_details: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class HighLevelRequirement(BaseModel):
    id: int
    requirement_text: str
    created_at: datetime
    low_level_requirements: List[LowLevelRequirement] = [] # Include nested LLRs
    model_config = ConfigDict(from_attributes=True)

class FlowStep(BaseModel):
    id: int
    name: str
    order: int
    created_at: datetime
    high_level_requirements: List[HighLevelRequirement] = [] # Include nested HLRs
    model_config = ConfigDict(from_attributes=True)

class UserFlow(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    project_id: int
    created_at: datetime
    steps: List[FlowStep] = [] # Include nested steps
    model_config = ConfigDict(from_attributes=True)

# Schema for the overall response when getting requirements for a project
class ProjectRequirementsResponse(BaseModel):
    project_id: int
    flows: List[UserFlow] = []