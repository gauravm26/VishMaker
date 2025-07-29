"""
DynamoDB requirement models for users lambda
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from ...dynamodb.code.dynamodb_core import (
    create_item, get_item, update_item, delete_item, 
    query_items, scan_items, generate_uuid, format_timestamp,
    TABLE_NAMES
)

#--------------------------------
# Pydantic Models (for API validation)
#--------------------------------

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    initial_prompt: Optional[str] = None
    user_id: str = Field(..., min_length=1, max_length=255)

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    initial_prompt: Optional[str] = None

class Project(ProjectBase):
    id: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

class UserFlowBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    project_id: str = Field(..., min_length=1, max_length=255)

class UserFlowCreate(UserFlowBase):
    pass

class UserFlowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

class UserFlow(UserFlowBase):
    uiid: str
    created_at: str

    class Config:
        from_attributes = True

class HighLevelRequirementBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    parent_uiid: str = Field(..., min_length=1, max_length=255)

class HighLevelRequirementCreate(HighLevelRequirementBase):
    pass

class HighLevelRequirementUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

class HighLevelRequirement(HighLevelRequirementBase):
    uiid: str
    created_at: str

    class Config:
        from_attributes = True

class LowLevelRequirementBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    parent_uiid: str = Field(..., min_length=1, max_length=255)

class LowLevelRequirementCreate(LowLevelRequirementBase):
    pass

class LowLevelRequirementUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

class LowLevelRequirement(LowLevelRequirementBase):
    uiid: str
    created_at: str

    class Config:
        from_attributes = True

class TestCaseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    parent_uiid: str = Field(..., min_length=1, max_length=255)

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

class TestCase(TestCaseBase):
    uiid: str
    created_at: str

    class Config:
        from_attributes = True

#--------------------------------
# DynamoDB Models (for database operations)
#--------------------------------

class ProjectEntity:
    """DynamoDB Project entity operations"""
    
    @staticmethod
    def create(project_data: ProjectCreate) -> Dict[str, Any]:
        """Create a new project"""
        project_id = generate_uuid()
        item = {
            "id": project_id,
            "user_id": project_data.user_id,
            "name": project_data.name,
            "initial_prompt": project_data.initial_prompt,
            "created_at": format_timestamp(),
            "updated_at": format_timestamp()
        }
        
        return create_item(TABLE_NAMES['projects'], item)
    
    @staticmethod
    def get_by_id(project_id: str, user_id: str) -> Dict[str, Any]:
        """Get project by ID and user_id"""
        key = {
            "id": project_id,
            "user_id": user_id
        }
        return get_item(TABLE_NAMES['projects'], key)
    
    @staticmethod
    def get_by_user_id(user_id: str) -> Dict[str, Any]:
        """Get all projects for a user"""
        return query_items(
            TABLE_NAMES['projects'],
            "user_id = :user_id",
            {":user_id": user_id},
            "user_id-index"
        )
    
    @staticmethod
    def update(project_id: str, user_id: str, update_data: ProjectUpdate) -> Dict[str, Any]:
        """Update a project"""
        key = {
            "id": project_id,
            "user_id": user_id
        }
        
        update_expression = "SET updated_at = :updated_at"
        expression_values = {":updated_at": format_timestamp()}
        
        if update_data.name is not None:
            update_expression += ", #name = :name"
            expression_values[":name"] = update_data.name
            expression_values["#name"] = "name"  # Reserved word handling
        
        if update_data.initial_prompt is not None:
            update_expression += ", initial_prompt = :initial_prompt"
            expression_values[":initial_prompt"] = update_data.initial_prompt
        
        return update_item(TABLE_NAMES['projects'], key, update_expression, expression_values)
    
    @staticmethod
    def delete(project_id: str, user_id: str) -> Dict[str, Any]:
        """Delete a project"""
        key = {
            "id": project_id,
            "user_id": user_id
        }
        return delete_item(TABLE_NAMES['projects'], key)

class UserFlowEntity:
    """DynamoDB User Flow entity operations"""
    
    @staticmethod
    def create(flow_data: UserFlowCreate) -> Dict[str, Any]:
        """Create a new user flow"""
        uiid = generate_uuid()
        item = {
            "uiid": uiid,
            "project_id": flow_data.project_id,
            "name": flow_data.name,
            "description": flow_data.description,
            "created_at": format_timestamp()
        }
        
        return create_item(TABLE_NAMES['user_flows'], item)
    
    @staticmethod
    def get_by_uiid(uiid: str) -> Dict[str, Any]:
        """Get user flow by UIID"""
        key = {
            "uiid": uiid,
            "project_id": ""  # Placeholder, will be replaced by actual project_id
        }
        # For this query, we need to use scan with filter since we don't have the project_id
        return scan_items(
            TABLE_NAMES['user_flows'],
            "uiid = :uiid",
            {":uiid": uiid}
        )
    
    @staticmethod
    def get_by_project_id(project_id: str) -> Dict[str, Any]:
        """Get all user flows for a project"""
        return query_items(
            TABLE_NAMES['user_flows'],
            "project_id = :project_id",
            {":project_id": project_id},
            "project_id-index"
        )
    
    @staticmethod
    def update(uiid: str, update_data: UserFlowUpdate) -> Dict[str, Any]:
        """Update a user flow"""
        # First get the item to get the project_id
        get_result = UserFlowEntity.get_by_uiid(uiid)
        if get_result['status'] != 'success' or not get_result['data']:
            return {"status": "error", "message": "User flow not found"}
        
        item = get_result['data'][0]  # Get first item from scan result
        key = {
            "uiid": uiid,
            "project_id": item['project_id']
        }
        
        update_expression = "SET updated_at = :updated_at"
        expression_values = {":updated_at": format_timestamp()}
        
        if update_data.name is not None:
            update_expression += ", #name = :name"
            expression_values[":name"] = update_data.name
            expression_values["#name"] = "name"
        
        if update_data.description is not None:
            update_expression += ", description = :description"
            expression_values[":description"] = update_data.description
        
        return update_item(TABLE_NAMES['user_flows'], key, update_expression, expression_values)
    
    @staticmethod
    def delete(uiid: str) -> Dict[str, Any]:
        """Delete a user flow"""
        # First get the item to get the project_id
        get_result = UserFlowEntity.get_by_uiid(uiid)
        if get_result['status'] != 'success' or not get_result['data']:
            return {"status": "error", "message": "User flow not found"}
        
        item = get_result['data'][0]
        key = {
            "uiid": uiid,
            "project_id": item['project_id']
        }
        return delete_item(TABLE_NAMES['user_flows'], key)

class HighLevelRequirementEntity:
    """DynamoDB High Level Requirement entity operations"""
    
    @staticmethod
    def create(requirement_data: HighLevelRequirementCreate) -> Dict[str, Any]:
        """Create a new high level requirement"""
        uiid = generate_uuid()
        item = {
            "uiid": uiid,
            "parent_uiid": requirement_data.parent_uiid,
            "name": requirement_data.name,
            "description": requirement_data.description,
            "created_at": format_timestamp()
        }
        
        return create_item(TABLE_NAMES['high_level_requirements'], item)
    
    @staticmethod
    def get_by_uiid(uiid: str) -> Dict[str, Any]:
        """Get high level requirement by UIID"""
        key = {
            "uiid": uiid,
            "parent_uiid": ""  # Placeholder
        }
        return scan_items(
            TABLE_NAMES['high_level_requirements'],
            "uiid = :uiid",
            {":uiid": uiid}
        )
    
    @staticmethod
    def get_by_parent_uiid(parent_uiid: str) -> Dict[str, Any]:
        """Get all high level requirements for a parent user flow"""
        return query_items(
            TABLE_NAMES['high_level_requirements'],
            "parent_uiid = :parent_uiid",
            {":parent_uiid": parent_uiid},
            "parent_uiid-index"
        )
    
    @staticmethod
    def update(uiid: str, update_data: HighLevelRequirementUpdate) -> Dict[str, Any]:
        """Update a high level requirement"""
        get_result = HighLevelRequirementEntity.get_by_uiid(uiid)
        if get_result['status'] != 'success' or not get_result['data']:
            return {"status": "error", "message": "High level requirement not found"}
        
        item = get_result['data'][0]
        key = {
            "uiid": uiid,
            "parent_uiid": item['parent_uiid']
        }
        
        update_expression = "SET updated_at = :updated_at"
        expression_values = {":updated_at": format_timestamp()}
        
        if update_data.name is not None:
            update_expression += ", #name = :name"
            expression_values[":name"] = update_data.name
            expression_values["#name"] = "name"
        
        if update_data.description is not None:
            update_expression += ", description = :description"
            expression_values[":description"] = update_data.description
        
        return update_item(TABLE_NAMES['high_level_requirements'], key, update_expression, expression_values)
    
    @staticmethod
    def delete(uiid: str) -> Dict[str, Any]:
        """Delete a high level requirement"""
        get_result = HighLevelRequirementEntity.get_by_uiid(uiid)
        if get_result['status'] != 'success' or not get_result['data']:
            return {"status": "error", "message": "High level requirement not found"}
        
        item = get_result['data'][0]
        key = {
            "uiid": uiid,
            "parent_uiid": item['parent_uiid']
        }
        return delete_item(TABLE_NAMES['high_level_requirements'], key)

class LowLevelRequirementEntity:
    """DynamoDB Low Level Requirement entity operations"""
    
    @staticmethod
    def create(requirement_data: LowLevelRequirementCreate) -> Dict[str, Any]:
        """Create a new low level requirement"""
        uiid = generate_uuid()
        item = {
            "uiid": uiid,
            "parent_uiid": requirement_data.parent_uiid,
            "name": requirement_data.name,
            "description": requirement_data.description,
            "created_at": format_timestamp()
        }
        
        return create_item(TABLE_NAMES['low_level_requirements'], item)
    
    @staticmethod
    def get_by_uiid(uiid: str) -> Dict[str, Any]:
        """Get low level requirement by UIID"""
        key = {
            "uiid": uiid,
            "parent_uiid": ""  # Placeholder
        }
        return scan_items(
            TABLE_NAMES['low_level_requirements'],
            "uiid = :uiid",
            {":uiid": uiid}
        )
    
    @staticmethod
    def get_by_parent_uiid(parent_uiid: str) -> Dict[str, Any]:
        """Get all low level requirements for a parent high level requirement"""
        return query_items(
            TABLE_NAMES['low_level_requirements'],
            "parent_uiid = :parent_uiid",
            {":parent_uiid": parent_uiid},
            "parent_uiid-index"
        )
    
    @staticmethod
    def update(uiid: str, update_data: LowLevelRequirementUpdate) -> Dict[str, Any]:
        """Update a low level requirement"""
        get_result = LowLevelRequirementEntity.get_by_uiid(uiid)
        if get_result['status'] != 'success' or not get_result['data']:
            return {"status": "error", "message": "Low level requirement not found"}
        
        item = get_result['data'][0]
        key = {
            "uiid": uiid,
            "parent_uiid": item['parent_uiid']
        }
        
        update_expression = "SET updated_at = :updated_at"
        expression_values = {":updated_at": format_timestamp()}
        
        if update_data.name is not None:
            update_expression += ", #name = :name"
            expression_values[":name"] = update_data.name
            expression_values["#name"] = "name"
        
        if update_data.description is not None:
            update_expression += ", description = :description"
            expression_values[":description"] = update_data.description
        
        return update_item(TABLE_NAMES['low_level_requirements'], key, update_expression, expression_values)
    
    @staticmethod
    def delete(uiid: str) -> Dict[str, Any]:
        """Delete a low level requirement"""
        get_result = LowLevelRequirementEntity.get_by_uiid(uiid)
        if get_result['status'] != 'success' or not get_result['data']:
            return {"status": "error", "message": "Low level requirement not found"}
        
        item = get_result['data'][0]
        key = {
            "uiid": uiid,
            "parent_uiid": item['parent_uiid']
        }
        return delete_item(TABLE_NAMES['low_level_requirements'], key)

class TestCaseEntity:
    """DynamoDB Test Case entity operations"""
    
    @staticmethod
    def create(test_case_data: TestCaseCreate) -> Dict[str, Any]:
        """Create a new test case"""
        uiid = generate_uuid()
        item = {
            "uiid": uiid,
            "parent_uiid": test_case_data.parent_uiid,
            "name": test_case_data.name,
            "description": test_case_data.description,
            "created_at": format_timestamp()
        }
        
        return create_item(TABLE_NAMES['test_cases'], item)
    
    @staticmethod
    def get_by_uiid(uiid: str) -> Dict[str, Any]:
        """Get test case by UIID"""
        key = {
            "uiid": uiid,
            "parent_uiid": ""  # Placeholder
        }
        return scan_items(
            TABLE_NAMES['test_cases'],
            "uiid = :uiid",
            {":uiid": uiid}
        )
    
    @staticmethod
    def get_by_parent_uiid(parent_uiid: str) -> Dict[str, Any]:
        """Get all test cases for a parent low level requirement"""
        return query_items(
            TABLE_NAMES['test_cases'],
            "parent_uiid = :parent_uiid",
            {":parent_uiid": parent_uiid},
            "parent_uiid-index"
        )
    
    @staticmethod
    def update(uiid: str, update_data: TestCaseUpdate) -> Dict[str, Any]:
        """Update a test case"""
        get_result = TestCaseEntity.get_by_uiid(uiid)
        if get_result['status'] != 'success' or not get_result['data']:
            return {"status": "error", "message": "Test case not found"}
        
        item = get_result['data'][0]
        key = {
            "uiid": uiid,
            "parent_uiid": item['parent_uiid']
        }
        
        update_expression = "SET updated_at = :updated_at"
        expression_values = {":updated_at": format_timestamp()}
        
        if update_data.name is not None:
            update_expression += ", #name = :name"
            expression_values[":name"] = update_data.name
            expression_values["#name"] = "name"
        
        if update_data.description is not None:
            update_expression += ", description = :description"
            expression_values[":description"] = update_data.description
        
        return update_item(TABLE_NAMES['test_cases'], key, update_expression, expression_values)
    
    @staticmethod
    def delete(uiid: str) -> Dict[str, Any]:
        """Delete a test case"""
        get_result = TestCaseEntity.get_by_uiid(uiid)
        if get_result['status'] != 'success' or not get_result['data']:
            return {"status": "error", "message": "Test case not found"}
        
        item = get_result['data'][0]
        key = {
            "uiid": uiid,
            "parent_uiid": item['parent_uiid']
        }
        return delete_item(TABLE_NAMES['test_cases'], key) 