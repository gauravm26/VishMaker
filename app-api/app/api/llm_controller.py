import json
import os
import sys
import logging
import time
import hashlib
import re
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Body, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from infrastructure.db.db_core import get_db # DB session dependency

# Add infrastructure to path for BedrockService import
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(project_root))

from infrastructure.llms.llm_models import BedrockService, load_config, llm_logger
# Import the requirement generation service directly
from features.requirement_generation.core.services import req_gen_service as req_gen_service_instance
from infrastructure.db.db_core import get_db

router = APIRouter()

class LlmProcessRequest(BaseModel):
    componentId: str
    text: str
    project_id: Optional[int] = None
    parent_uiid: Optional[str] = None  # UIID of parent entity
    save_to_db: bool = True

class LlmProcessResponse(BaseModel):
    result: str
    modelId: str
    instructionId: str
    progressUpdates: list[str] = []
    generated_uiids: List[str] = []  # List of UIIDs generated for the items

def generate_uiid(table_type: str, index: int, text: str) -> str:
    """
    Generate a unique identifier for an item.
    
    Args:
        table_type: Type of table ("user_flow", "high_level_requirement", etc.)
        index: The item's index/position
        text: Text to use for additional uniqueness
        
    Returns:
        A unique ID string
    """
    # Normalize table_type to ensure consistency
    normalized_table_type = table_type
    if table_type == "high_level_requirements":
        normalized_table_type = "high_level_requirement"
    elif table_type == "low_level_requirements":
        normalized_table_type = "low_level_requirement"
    elif table_type == "test_cases":
        normalized_table_type = "test_case"
    
    # Create a short prefix based on table type
    prefix = normalized_table_type.split('_')[0][:3]  # First 3 chars of first word
    
    # Get current timestamp as base36 string (compact representation)
    timestamp = time.time()
    timestamp_str = format(int(timestamp * 1000), 'x')[-6:]  # Last 6 hex chars
    
    # Format: prefix-index-timestamp
    return f"{prefix}_{index+1}_{timestamp_str}"

def extract_items_from_content(content: str) -> List[Dict[str, Any]]:
    """
    Extract items from content based on pipe-delimited format.
    Args:
        content: Raw content text
    Returns:
        List of dictionaries with name and description fields
    """
    items = []
    lines = content.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Check if it's a pipe-delimited line
        if '|' in line:
            parts = line.split('|')
            name = parts[0].strip()
            description = parts[1].strip() if len(parts) > 1 else ""
            
            items.append({
                "name": name,
                "description": description
            })
        # If not pipe-delimited, try to extract structured data
        elif ':' in line and not line.lower().startswith(('id:', 'item name:', 'description:')):
            parts = line.split(':', 1)
            items.append({
                "name": parts[0].strip(),
                "description": parts[1].strip()
            })
    
    return items

@router.post("/process", response_model=LlmProcessResponse)
async def process_with_llm(request: LlmProcessRequest = Body(...), background_tasks: BackgroundTasks = None):
    """Process text using an LLM based on the component configuration"""
    request_id = datetime.now().strftime("%Y%m%d%H%M%S")
    
    # Keep track of progress updates
    progress_updates = []
    # Initialize generated_uiids list to prevent undefined variable errors
    generated_uiids = []
    
    try:
        # Log request information
        llm_logger.info(f"[{request_id}] REQUEST RECEIVED for component: {request.componentId}")
        llm_logger.info(f"[{request_id}] USER TEXT: {request.text[:100]}...")
        
        # Add initial progress update
        progress_updates.append("Starting LLM processing...")
        
        # Load config
        config = load_config()
        
        if not config or 'llm' not in config:
            llm_logger.error(f"[{request_id}] LLM configuration not found")
            raise HTTPException(status_code=500, detail="LLM configuration not found")
        
        # Find component mapping
        component_mapping = None
        for component_key, component_data in config['llm'].get('componentModelMapping', {}).items():
            if component_data.get('componentId') == request.componentId:
                component_mapping = component_data
                break
        
        if not component_mapping:
            llm_logger.error(f"[{request_id}] Component '{request.componentId}' not found in configuration")
            raise HTTPException(status_code=404, detail=f"Component '{request.componentId}' not found in configuration")
        
        # Get the target table from component config instead of request
        target_table = component_mapping.get('targetTable')
        llm_logger.info(f"[{request_id}] Found target table in config: {target_table}")
        
        # Normalize target_table to ensure consistency
        if target_table == "high_level_requirements":
            target_table = "high_level_requirement"
        elif target_table == "low_level_requirements":
            target_table = "low_level_requirement"
        elif target_table == "test_cases":
            target_table = "test_case"
        
        # Get the model instructions
        model_instructions = component_mapping.get('modelInstructions', [])
        if not model_instructions or len(model_instructions) == 0:
            llm_logger.error(f"[{request_id}] No model instructions found for component '{request.componentId}'")
            raise HTTPException(status_code=500, detail=f"No model instructions found for component '{request.componentId}'")

        # Get the output format
        output_format = component_mapping.get('outputFormat', 'plain')
        output_type = output_format.split('_')[0]
        if output_type == 'columns':
            noColumns = int(output_format.split('_')[1])
            outputFormatValue = f"Format the refined text into exactly {noColumns} columns. Each row should be formatted into columns delimited by the pipe character |."
        else:
            outputFormatValue = "Output the refined text as a single, continuous block of natural language."

        # Initialize Bedrock service
        llm_logger.info(f"[{request_id}] Initializing Bedrock service")
        bedrock_service = BedrockService()
        
        # Verify AWS credentials are set up properly
        if not bedrock_service.client:
            llm_logger.error(f"[{request_id}] Failed to initialize Bedrock service - check AWS credentials")
            raise HTTPException(status_code=500, detail="Failed to initialize Bedrock service - check AWS credentials in environment variables")
        
        # Process through all models in sequence
        current_text = request.text
        final_model_id = ""
        final_instruction_id = ""
        
        for idx, model_instruction in enumerate(model_instructions):
            model_key = model_instruction.get('model')
            instruction_key = model_instruction.get('instruction')
            
            llm_logger.info(f"[{request_id}] Model chain step {idx+1}: Using model: {model_key} with instruction: {instruction_key}")
            
            # Get instruction
            instruction = None
            for instr_key, instr_data in config['llm'].get('instructions', {}).items():
                if instr_key == instruction_key:
                    instruction = instr_data
                    instruction['output_format'] = outputFormatValue
                    break
            llm_logger.info(f"[{request_id}] Instruction: {instruction}")

            if not instruction:
                llm_logger.error(f"[{request_id}] Instruction '{instruction_key}' not found in configuration")
                raise HTTPException(status_code=500, detail=f"Instruction '{instruction_key}' not found in configuration")
            
            try:
                # Use the simplified get_model_response method
                progress_updates.append(f"Processing with model {model_key} using instruction {instruction_key}")
                
                # Call get_model_response with current text
                content, metadata = bedrock_service.get_model_response(
                    model_key=model_key,
                    instruction=instruction,
                    user_text=current_text,
                    request_id=f"{request_id}_step{idx+1}"
                )
                
                if content is None:
                    error_msg = metadata.get('error', 'Unknown error')
                    llm_logger.error(f"[{request_id}] Step {idx+1}: Error getting response: {error_msg}")
                    raise ValueError(f"Error getting model response: {error_msg}")
                
                llm_logger.info(f"[{request_id}] Step {idx+1}: Successfully processed response. Content length: {len(content)}")
                progress_updates.append(f"Received response from {model_key}")
                
                # Update text for next model in chain or final result
                current_text = content
                final_model_id = metadata.get('model_id', '')
                final_instruction_id = instruction_key
                
            except ValueError as ve:
                llm_logger.error(f"[{request_id}] Step {idx+1}: Error invoking model: {str(ve)}")
                raise HTTPException(status_code=500, detail=f"Error invoking model: {str(ve)}")
        
        # Check if we have an output model and if refinement wasn't already handled
        if component_mapping and 'outputModel' in component_mapping:
            output_model = component_mapping['outputModel']
            output_model_key = output_model.get('model')
            output_instruction_key = output_model.get('instruction')
            
            if output_model_key and output_instruction_key:
                # Get the instruction
                output_instruction = None
                for instr_key, instr_data in config['llm'].get('instructions', {}).items():
                    if instr_key == output_instruction_key:
                        output_instruction = instr_data
                        output_instruction['output_format'] = outputFormatValue
                        break
                llm_logger.info(f"[{request_id}] Output instruction: {output_instruction}")
                
                if output_instruction:
                    try:
                        progress_updates.append(f"Refining output with model {output_model_key}")
                        
                        # Call get_model_response for output refinement
                        refined_content, refinement_metadata = bedrock_service.get_model_response(
                            model_key=output_model_key,
                            instruction=output_instruction,
                            user_text=current_text,
                            request_id=f"{request_id}_refinement"
                        )
                        
                        if refined_content is not None:
                            # Update the final result
                            current_text = refined_content
                            final_model_id = refinement_metadata.get('model_id', final_model_id)
                            final_instruction_id = output_instruction_key
                            
                            progress_updates.append(f"Refinement completed with model {output_model_key}")
                            llm_logger.info(f"[{request_id}] Output refinement: Successfully processed")
                        else:
                            llm_logger.error(f"[{request_id}] Output refinement failed: {refinement_metadata.get('error', 'Unknown error')}")
                    except Exception as e:
                        llm_logger.error(f"[{request_id}] Output refinement error: {str(e)}")
                        # Continue with original result if refinement fails
        
        # Extract items from the content to generate UIIDs
        if output_type == 'columns':
            items = extract_items_from_content(current_text)
            
            # Generate UIIDs for each item
            generated_uiids = []
            for i, item in enumerate(items):
                uiid = generate_uiid(target_table, i, item["name"] + item["description"])
                generated_uiids.append(uiid)
            
            # Prepare processed content with UIIDs
            processed_lines = []
            
            if items:
                # Re-format the content with UIIDs
                for i, (item, uiid) in enumerate(zip(items, generated_uiids)):
                    processed_lines.append(f"{item['name']} | {item['description']} | {uiid}")
                
                # Replace the content with the processed content including UIIDs
                current_text = "\n".join(processed_lines)
        # If not columns format, make sure we still have empty generated_uiids list
        else:
            generated_uiids = []
        
        # Create the response object first
        response = LlmProcessResponse(
            result=current_text,
            modelId=final_model_id,
            instructionId=final_instruction_id,
            progressUpdates=progress_updates,
            generated_uiids=generated_uiids
        )
        
        # Add saving to database as a background task if requested
        if request.save_to_db and (request.project_id is not None or request.parent_uiid is not None):
            progress_updates.append(f"Scheduling database save for {target_table} data...")
            background_tasks.add_task(
                save_to_database,
                content=current_text,
                project_id=request.project_id,  # Use 0 if project_id is None
                target_table=target_table,
                request_id=request_id,
                progress_updates=progress_updates,
                parent_uiid=request.parent_uiid  # Pass the parent UIID
            )
        
        # Return the final response immediately
        return response
        
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log the exception
        llm_logger.error(f"[{request_id}] Unhandled exception: {str(e)}", exc_info=True)
        # Return a generic error message
        raise HTTPException(status_code=500, detail=f"Error processing LLM request: {str(e)}")

async def save_to_database(
    content: str,
    project_id: int,
    target_table: str,
    request_id: str,
    progress_updates: List[str],
    parent_uiid: Optional[str] = None,
):
    """Save the generated content to the database."""
    try:
        # Get database session using the generator approach
        db = next(get_db())
        
        # Log parameters
        llm_logger.info(f"[{request_id}] Saving to database: table={target_table}, project_id={project_id}, parent_uiid={parent_uiid}")
        
        # Directly call service method to save data
        req_gen_service_instance.save_llm_generated_data(
            db=db,
            project_id=project_id,
            table_type=target_table,
            raw_content=content,
            parent_uiid=parent_uiid
        )
        
        progress_updates.append(f"Successfully saved content to database ({target_table}).")
        llm_logger.info(f"[{request_id}] Successfully saved content to database ({target_table}).")
        
    except Exception as e:
        error_msg = f"Error saving to database: {str(e)}"
        progress_updates.append(error_msg)
        llm_logger.error(f"[{request_id}] {error_msg}")
        llm_logger.exception(e)