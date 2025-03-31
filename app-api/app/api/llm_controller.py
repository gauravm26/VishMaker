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

from infrastructure.llms.llm_models import BedrockService, load_config, get_model_id_from_key, llm_logger

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
        bedrock_service.current_request_id = request_id
        
        if not bedrock_service.client:
            llm_logger.error(f"[{request_id}] Failed to initialize Bedrock service - check AWS credentials")
            raise HTTPException(status_code=500, detail="Failed to initialize Bedrock service - check AWS credentials in environment variables")
        
        # Verify AWS credentials
        aws_access_key = os.getenv('AWS_BEDROCK_ACCESS_KEY_ID')
        aws_secret_key = os.getenv('AWS_BEDROCK_SECRET_ACCESS_KEY')
        aws_region = os.getenv('AWS_BEDROCK_REGION', 'us-east-1')
        
        if not aws_access_key or not aws_secret_key:
            llm_logger.error(f"[{request_id}] AWS Bedrock credentials not found in environment variables")
            raise HTTPException(status_code=500, detail="AWS Bedrock credentials not properly configured - check AWS_BEDROCK_ACCESS_KEY_ID and AWS_BEDROCK_SECRET_ACCESS_KEY")
            
        # Check for AWS Bedrock inference ARN 
        inference_arn = os.getenv('AWS_BEDROCK_INFERENCE_ARN', '')
        if not inference_arn:
            llm_logger.error(f"[{request_id}] AWS_BEDROCK_INFERENCE_ARN not configured in environment variables")
            raise HTTPException(status_code=500, detail="AWS_BEDROCK_INFERENCE_ARN not configured in environment variables")
        
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
                # Prepare the request payload
                llm_logger.info(f"[{request_id}] Step {idx+1}: Preparing request payload for model {model_key}")
                progress_updates.append(f"1. Drafting Request: Preparing payload for {model_key}")
                config_body, model_id = bedrock_service.prepare_request_payload(model_key, instruction, current_text)
                llm_logger.info(f"[{request_id}] Step {idx+1}: Model ID: {model_id}, Config Body: {config_body}")

                # Log the payload
                payload_str = json.dumps(config_body, indent=2)
                llm_logger.info(f"[{request_id}] Step {idx+1}: REQUEST PAYLOAD:\n{payload_str}")
                
                # Get the inference profile ARN
                llm_logger.info(f"[{request_id}] Step {idx+1}: Getting profile ARN for model {model_id}")
                profile_arn = bedrock_service.get_model_profile_arn(model_id)
                
                # Serialize the body
                body = json.dumps(config_body)
                
                # Call the Bedrock API
                llm_logger.info(f"[{request_id}] Step {idx+1}: Invoking AWS Bedrock model {model_id} with profile {profile_arn}")
                progress_updates.append(f"2. Request Sent: Sending to {model_id} with instruction {instruction_key}")
                
                try:
                    response = bedrock_service.client.invoke_model(
                        modelId=profile_arn,
                        body=body
                    )
                    
                    # Check if response is valid
                    if not response or not hasattr(response, 'get') or not response.get('body'):
                        llm_logger.error(f"[{request_id}] Step {idx+1}: Empty response received from AWS Bedrock")
                        raise ValueError("Empty response received from AWS Bedrock")
                        
                    # Read the response body
                    response_body_raw = response.get('body').read()
                    
                    # Check if the response body is empty
                    if not response_body_raw:
                        llm_logger.error(f"[{request_id}] Step {idx+1}: Empty response body received from AWS Bedrock")
                        raise ValueError("Empty response body received from AWS Bedrock")
                    
                    # Parse and log the response
                    response_body = None
                    try:
                        response_body = json.loads(response_body_raw)
                        response_str = json.dumps(response_body, indent=2)
                        llm_logger.info(f"[{request_id}] Step {idx+1}: RESPONSE PAYLOAD:\n{response_str}")
                        progress_updates.append(f"3. Response Received: Got response from {model_id}")
                    except json.JSONDecodeError as e:
                        llm_logger.error(f"[{request_id}] Step {idx+1}: Failed to parse response as JSON: {str(e)}")
                        llm_logger.error(f"[{request_id}] Step {idx+1}: Raw response: {response_body_raw[:1000]}")
                        raise ValueError(f"Invalid JSON response from AWS Bedrock: {str(e)}")
                    
                    # Process the response content
                    content, metadata = bedrock_service.process_model_response(model_id, None, component_mapping, response_body)
                    progress_updates.append(f"Processing response content from {model_id}")
                    
                    # Check if refinement has already been performed by process_model_response
                    refinement_already_performed = metadata and isinstance(metadata, dict) and metadata.get('refinement_performed', False)
                    if refinement_already_performed:
                        llm_logger.info(f"[{request_id}] Refinement already performed in process_model_response, skipping controller refinement")
                    
                    # Verify that we extracted content successfully
                    if not content or not content.strip():
                        llm_logger.error(f"[{request_id}] Step {idx+1}: Failed to extract content from response")
                        llm_logger.info(f"[{request_id}] Step {idx+1}: Using raw response as fallback")
                        
                        # Use the raw response as a fallback
                        if isinstance(response_body, dict):
                            # Try common content fields
                            for field in ["text", "content", "generation", "completion", "answer", "response"]:
                                if field in response_body:
                                    if isinstance(response_body[field], str):
                                        content = response_body[field]
                                        break
                                    elif isinstance(response_body[field], list) and len(response_body[field]) > 0:
                                        content = str(response_body[field][0])
                                        break
                            
                            # If we still don't have content, use the entire response
                            if not content or not content.strip():
                                content = str(response_body)
                        else:
                            content = str(response_body)
                    
                    llm_logger.info(f"[{request_id}] Step {idx+1}: Successfully processed response. Content length: {len(content)}")
                    
                    # Update text for next model in chain or final result
                    current_text = content
                    final_model_id = model_id
                    final_instruction_id = instruction_key
                    
                except Exception as aws_e:
                    llm_logger.error(f"[{request_id}] Step {idx+1}: AWS API error: {str(aws_e)}")
                    raise ValueError(f"AWS Bedrock API error: {str(aws_e)}")
                    
            except ValueError as ve:
                llm_logger.error(f"[{request_id}] Step {idx+1}: Error invoking model: {str(ve)}")
                raise HTTPException(status_code=500, detail=f"Error invoking model: {str(ve)}")
        
        # Check if we have an output model
        if component_mapping and 'outputModel' in component_mapping and not refinement_already_performed:
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
                        # Prepare output model request
                        llm_logger.info(f"[{request_id}] Output refinement: Preparing request for model {output_model_key}")
                        progress_updates.append(f"4. Refining Output: Preparing request for {output_model_key}")
                        
                        # Get the model ID
                        output_model_id = None
                        if output_model_key in config['llm'].get('models', {}):
                            output_model_id = config['llm']['models'][output_model_key].get('modelId')
                        
                        if not output_model_id:
                            llm_logger.error(f"[{request_id}] Output model ID not found for {output_model_key}")
                        else:
                            # Add output format to instruction
                            output_instruction_with_format = {
                                **output_instruction,
                                'output_format': output_model.get('outputFormat', 'plain')
                            }
                            
                            # Process with output model
                            config_body, _ = bedrock_service.prepare_request_payload(output_model_key, output_instruction_with_format, current_text)
                            
                            # Log the request payload
                            config_str = json.dumps(config_body, indent=2)
                            llm_logger.info(f"[{request_id}] Output refinement: REQUEST PAYLOAD:\n{config_str}")
                            
                            # Serialize and call Bedrock API
                            profile_arn = bedrock_service.get_model_profile_arn(output_model_id)
                            body = json.dumps(config_body)
                            
                            # Tell the BedrockService about the request_id for proper logging
                            bedrock_service.current_request_id = request_id
                            
                            response = bedrock_service.client.invoke_model(
                                modelId=profile_arn,
                                body=body
                            )
                            
                            if response and hasattr(response, 'get') and response.get('body'):
                                response_body_raw = response.get('body').read()
                                if response_body_raw:
                                    output_response_body = json.loads(response_body_raw)
                                    
                                    # Log the response payload
                                    response_str = json.dumps(output_response_body, indent=2)
                                    llm_logger.info(f"[{request_id}] Output refinement: RESPONSE PAYLOAD:\n{response_str}")
                                    
                                    # Process the output model response
                                    refined_content, _ = bedrock_service.process_model_response(output_model_id, None, None, output_response_body)
                                    
                                    # Update the final result
                                    current_text = refined_content
                                    final_model_id = output_model_id
                                    final_instruction_id = output_instruction_key
                                    
                                    progress_updates.append(f"5. Refinement Complete: Received refined output from {output_model_id}")
                                    llm_logger.info(f"[{request_id}] Output refinement: Successfully processed")
                    except Exception as e:
                        llm_logger.error(f"[{request_id}] Output refinement error: {str(e)}")
                        # Continue with original result if refinement fails
        else:
            if refinement_already_performed:
                llm_logger.info(f"[{request_id}] Skipping controller output model refinement since it was already performed")
        
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