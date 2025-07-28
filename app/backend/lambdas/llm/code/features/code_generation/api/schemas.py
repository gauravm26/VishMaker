"""
Pydantic schemas for code generation API.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Union


class CodeFile(BaseModel):
    """Model representing a generated code file."""
    filename: str
    content: str
    language: Optional[str] = None
    description: Optional[str] = None


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

