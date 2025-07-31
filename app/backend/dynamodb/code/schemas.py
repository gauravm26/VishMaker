from pydantic import BaseModel
from typing import Optional, List, ForwardRef

class ProjectCreate(BaseModel):
    name: str
    initial_prompt: Optional[str] = None
    user_id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    initial_prompt: Optional[str] = None

class Project(BaseModel):
    id: str
    name: str
    initial_prompt: Optional[str] = None
    user_id: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

class UserFlowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: str

class HighLevelRequirementCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_uiid: str

class LowLevelRequirementCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_uiid: str

class TestCaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_uiid: str

class TestCase(BaseModel):
    uiid: str
    name: str
    description: Optional[str] = None
    parent_uiid: str
    created_at: str
    updated_at: Optional[str] = None

class LowLevelRequirement(BaseModel):
    uiid: str
    name: str
    description: Optional[str] = None
    parent_uiid: str
    created_at: str
    updated_at: Optional[str] = None
    test_case_list: List[TestCase] = []

class HighLevelRequirement(BaseModel):
    uiid: str
    name: str
    description: Optional[str] = None
    parent_uiid: str
    created_at: str
    updated_at: Optional[str] = None
    low_level_requirement_list: List[LowLevelRequirement] = []

class UserFlow(BaseModel):
    uiid: str
    name: str
    description: Optional[str] = None
    project_id: str
    created_at: str
    updated_at: Optional[str] = None
    high_level_requirement_list: List[HighLevelRequirement] = []

class ProjectRequirementsResponse(BaseModel):
    project_id: str
    flows: List[UserFlow]