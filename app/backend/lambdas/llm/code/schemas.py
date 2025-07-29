"""
Centralized Pydantic schemas for the LLM lambda.
This file contains all the data models for API requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union

# ===============================
# LLM PROCESSING SCHEMAS
# ===============================

class LLMProcessRequest(BaseModel):
    """Request schema for the /llm/process endpoint."""
    componentId: str = Field(..., description="The component ID for LLM processing (e.g., 'gen_initialPrompt')")
    text: str = Field(..., description="The input text to process with the LLM")
    project_id: Optional[int] = Field(None, description="Optional project ID to associate with the processing")
    parent_uiid: Optional[str] = Field(None, description="Optional parent UIID for hierarchical context")
    save_to_db: bool = Field(False, description="Whether to save the result to the database")

class LLMProcessResponse(BaseModel):
    """Response schema for the /llm/process endpoint."""
    success: bool
    result: str
    modelId: str
    instructionId: str
    progressUpdates: List[str] = []
    generated_uiids: List[str] = []
    metadata: Dict[str, Any] = {}


