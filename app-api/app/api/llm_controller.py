import json
import os
import sys
import logging
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

# Add infrastructure to path for BedrockService import
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(project_root))

from infrastructure.llms.llm_models import BedrockService, load_config, llm_logger

router = APIRouter()

class LlmProcessRequest(BaseModel):
    componentId: str
    text: str

class LlmProcessResponse(BaseModel):
    result: str
    modelId: str
    instructionId: str
    progressUpdates: list[str] = []

@router.post("/process", response_model=LlmProcessResponse)
async def process_with_llm(request: LlmProcessRequest = Body(...)):
    """Process text using an LLM based on the component configuration"""
    request_id = datetime.now().strftime("%Y%m%d%H%M%S")
    
    # Keep track of progress updates
    progress_updates = []
    
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
        
        # Get the model instructions
        model_instructions = component_mapping.get('modelInstructions', [])
        if not model_instructions or len(model_instructions) == 0:
            llm_logger.error(f"[{request_id}] No model instructions found for component '{request.componentId}'")
            raise HTTPException(status_code=500, detail=f"No model instructions found for component '{request.componentId}'")

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
                    break
            
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
                        break
                
                if output_instruction:
                    try:
                        # Add output format to instruction
                        output_instruction_with_format = {
                            **output_instruction,
                            'output_format': output_model.get('outputFormat', 'plain')
                        }
                        
                        progress_updates.append(f"Refining output with model {output_model_key}")
                        
                        # Call get_model_response for output refinement
                        refined_content, refinement_metadata = bedrock_service.get_model_response(
                            model_key=output_model_key,
                            instruction=output_instruction_with_format,
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
        
        # Return the final response
        return LlmProcessResponse(
            result=current_text,
            modelId=final_model_id,
            instructionId=final_instruction_id,
            progressUpdates=progress_updates
        )
        
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log the exception
        llm_logger.error(f"[{request_id}] Unhandled exception: {str(e)}", exc_info=True)
        # Return a generic error message
        raise HTTPException(status_code=500, detail=f"Error processing LLM request: {str(e)}") 