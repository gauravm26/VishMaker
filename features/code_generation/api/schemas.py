"""
Pydantic schemas for code generation API.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Union


class CodeFile(BaseModel):
    """Schema for a generated code file."""
    filename: str
    content: str
    language: Optional[str] = "python"


class GeneratedCode(BaseModel):
    """Schema for generated code from a test case."""
    code_files: List[CodeFile]
    test_case_id: str
    project_id: int
    test_metadata: Optional[Dict[str, Any]] = None


class BuildFeatureRequest(BaseModel):
    """Request model for the build feature endpoint."""
    project_id: int
    test_case_id: str
    test_name: str
    test_description: str
    parent_uiid: Optional[str] = None
    additional_context: Optional[Dict[str, Any]] = None


class BuildFeatureResponse(BaseModel):
    """Response model for the build feature endpoint."""
    success: bool
    message: str
    code_files: Optional[List[CodeFile]] = None
    generated_uiids: Optional[List[str]] = None
    error: Optional[str] = None
    test_metadata: Optional[Dict[str, Any]] = None


class SaveCodeRequest(BaseModel):
    """Request model for saving generated code."""
    project_id: int
    test_case_id: str
    code_files: List[CodeFile]
    metadata: Optional[Dict[str, Any]] = None


class SaveCodeResponse(BaseModel):
    """Response model for the save code endpoint."""
    success: bool
    message: str
    saved_files: Optional[List[str]] = None
    error: Optional[str] = None 