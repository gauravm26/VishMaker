"""
Centralized services for the LLM lambda.

This file contains all business logic, including:
- The BedrockService for interacting with AWS Bedrock.
- The LLMProcessingService for handling specific component logic.
"""

import json
import logging
import boto3
from typing import Dict, Any, Optional, List
from botocore.exceptions import ClientError
from pathlib import Path
import sys
import os
from datetime import datetime

print("🔍 DEBUG: Starting to import modules in services.py")

# Add shared utilities to path
current_dir = Path(__file__).parent
lambdas_dir = current_dir.parent.parent
shared_dir = lambdas_dir / "shared" / "code"
sys.path.append(str(shared_dir))

print(f"🔍 DEBUG: Current directory: {current_dir}")
print(f"🔍 DEBUG: Lambdas directory: {lambdas_dir}")
print(f"🔍 DEBUG: Shared directory: {shared_dir}")
print(f"🔍 DEBUG: Python path: {sys.path}")

try:
    logger = logging.getLogger(__name__)
    print("✅ DEBUG: Successfully created logger")
except Exception as e:
    print(f"❌ DEBUG: Failed to create logger: {e}")
    raise

class BedrockService:
    """Service for interacting with AWS Bedrock models."""
    
    def __init__(self, region_name: str = "us-east-1"):
        """Initialize Bedrock client."""
        print(f"🔍 DEBUG: Initializing BedrockService with region: {region_name}")
        try:
            print(f"🔍 DEBUG: Creating boto3 client for bedrock-runtime in region {region_name}")
            self.bedrock = boto3.client(
                service_name='bedrock-runtime',
                region_name=region_name
            )
            self.region_name = region_name
            print("✅ DEBUG: BedrockService initialized successfully")
            logger.info(f"BedrockService initialized with region: {region_name}")
        except Exception as e:
            print(f"❌ DEBUG: Failed to initialize BedrockService: {e}")
            logger.error(f"Failed to initialize BedrockService: {e}")
            raise
    
    def invoke_model(self, model_id: str, prompt: str, max_tokens: int = 2048, temperature: float = 0.8, inference_arn: str = None) -> str:
        """
        Invoke a Bedrock model with the given prompt.
        
        Args:
            model_id: The Bedrock model ID (e.g., 'anthropic.claude-3-sonnet-20240229-v1:0')
            prompt: The input prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            inference_arn: Optional inference profile ARN
            
        Returns:
            The model's response text
        """
        print(f"🔍 DEBUG: Invoking Bedrock model: {model_id}")
        print(f"🔍 DEBUG: Prompt length: {len(prompt)}")
        print(f"🔍 DEBUG: Max tokens: {max_tokens}, Temperature: {temperature}")
        if inference_arn:
            print(f"🔍 DEBUG: Using inference profile: {inference_arn}")
        logger.info(f"Invoking Bedrock model {model_id} with {len(prompt)} chars, max_tokens={max_tokens}, temp={temperature}")
        
        try:
            # Get provider name for request preparation
            provider_name = self._get_provider_name(model_id)
            print(f"🔍 DEBUG: Provider: {provider_name}")
            
            # Prepare the request body based on the provider
            print(f"🔍 DEBUG: Preparing request body for model: {model_id}")
            request_body = self._prepare_request_body(provider_name, prompt, max_tokens, temperature)
            
            print(f"🔍 DEBUG: Request body prepared: {json.dumps(request_body)[:200]}...")
            logger.info(f"Request body prepared for model {model_id}")
            
            # Use inference profile if provided, otherwise use model_id directly
            target_model_id = inference_arn if inference_arn else model_id
            
            print(f"🔍 DEBUG: About to call bedrock.invoke_model")
            print(f"🔍 DEBUG: Target model ID: {target_model_id}")
            print(f"🔍 DEBUG: Request body size: {len(json.dumps(request_body))} bytes")
            print(f"🔍 DEBUG: Content type: application/json")
            print(f"🔍 DEBUG: Accept type: application/json")
            
            print("🚀 DEBUG: ===== BEDROCK INVOKE START =====")
            print(f"🚀 DEBUG: Calling bedrock.invoke_model with:")
            print(f"🚀 DEBUG:   - modelId: {target_model_id}")
            print(f"🚀 DEBUG:   - request body: {request_body}")
            print(f"🚀 DEBUG:   - body length: {len(json.dumps(request_body))}")
            print(f"🚀 DEBUG:   - contentType: application/json")
            print(f"🚀 DEBUG:   - accept: application/json")
            
            response = self.bedrock.invoke_model(
                modelId=target_model_id,
                body=json.dumps(request_body),
                contentType='application/json',
                accept='application/json'
            )
            
            print("✅ DEBUG: ===== BEDROCK INVOKE SUCCESS =====")
            print(f"✅ DEBUG: Response received from Bedrock")
            print(f"✅ DEBUG: Response: {response}")
            print(f"✅ DEBUG: Response type: {type(response)}")
            print(f"✅ DEBUG: Response keys: {list(response.keys()) if hasattr(response, 'keys') else 'No keys'}")
            
            print("✅ DEBUG: Bedrock model invoked successfully")
            logger.info(f"Bedrock model {model_id} invoked successfully")
            
            print(f"🔍 DEBUG: Reading response body")
            response_body = json.loads(response.get('body').read())
            print(f"🔍 DEBUG: Response body received: {json.dumps(response_body)[:200]}...")
            logger.info(f"Response body received from {model_id}")
            
            # Process response based on provider
            print(f"🔍 DEBUG: Processing response content for provider: {provider_name}")
            result = self._process_response_content(provider_name, response_body)
            
            print(f"🔍 DEBUG: Extracted response text length: {len(result)}")
            logger.info(f"Extracted {len(result)} chars from {model_id} response")
            return result
                
        except ClientError as e:
            error_msg = f"Error invoking Bedrock model {model_id}: {str(e)}"
            print(f"❌ DEBUG: {error_msg}")
            logger.error(error_msg)
            raise Exception(f"Failed to invoke LLM model: {str(e)}")
        except Exception as e:
            error_msg = f"Unexpected error invoking Bedrock model: {str(e)}"
            print(f"❌ DEBUG: {error_msg}")
            logger.error(error_msg)
            raise Exception(f"Unexpected error: {str(e)}")

    def _get_provider_name(self, model_id: str) -> str:
        """Extract the provider name from the model ID."""
        if not isinstance(model_id, str):
            return "unknown"
        return model_id.split('.')[0].lower() if '.' in model_id else "unknown"

    def _prepare_request_body(self, provider_name: str, prompt: str, max_tokens: int, temperature: float) -> dict:
        """Prepare provider-specific request body."""
        if provider_name == "anthropic":
            return {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }
        elif provider_name == "meta":
            # Meta/Llama format
            return {
                "prompt": f"<s>[INST] {prompt} [/INST]",
                "max_gen_len": max_tokens,
                "temperature": temperature,
                "top_p": 0.9
            }
        else:
            # Generic fallback
            return {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": temperature
            }

    def _process_response_content(self, provider_name: str, response_body: dict) -> str:
        """Process provider-specific response content."""
        if not isinstance(response_body, dict):
            return str(response_body)
        
        if provider_name == "anthropic":
            # Claude v3+ format
            if "content" in response_body and isinstance(response_body["content"], list):
                text_parts = [
                    item.get("text", "")
                    for item in response_body["content"]
                    if isinstance(item, dict) and item.get("type") == "text"
                ]
                return "\n".join(text_parts).strip()
            # Claude v2 format
            elif "completion" in response_body:
                return response_body.get("completion", "").strip()
            else:
                return str(response_body)
        elif provider_name == "meta":
            # Llama format
            if "generation" in response_body:
                return response_body.get("generation", "").strip()
            elif "outputs" in response_body and isinstance(response_body["outputs"], list) and response_body["outputs"]:
                first_output = response_body["outputs"][0]
                if isinstance(first_output, dict) and "text" in first_output:
                    return first_output.get("text", "").strip()
            else:
                return str(response_body)
        else:
            # Generic fallback
            for key in ["text", "content", "completion", "generation", "output", "answer", "response"]:
                if key in response_body:
                    value = response_body[key]
                    if isinstance(value, str):
                        return value.strip()
            return str(response_body)

class LLMProcessingService:
    """Service for processing LLM requests with component-specific logic."""
    
    def __init__(self, config_path: str = "config.json"):
        """Initialize the LLM processing service."""
        print("🔍 DEBUG: Initializing LLMProcessingService")
        logger.info("Initializing LLMProcessingService")
        
        try:
            print("🔍 DEBUG: Loading configuration")
            self.config = self._load_config()
            print(f"🔍 DEBUG: Config loaded with keys: {list(self.config.keys())}")
            logger.info(f"Configuration loaded with keys: {list(self.config.keys())}")
            
            print("🔍 DEBUG: Creating BedrockService instance")
            self.bedrock_service = BedrockService()
            print("✅ DEBUG: BedrockService created successfully")
            logger.info("BedrockService created successfully")
            
            print("✅ DEBUG: LLM Processing Service initialized successfully")
            logger.info("LLM Processing Service initialized successfully")
        except Exception as e:
            print(f"❌ DEBUG: Failed to initialize LLMProcessingService: {e}")
            logger.error(f"Failed to initialize LLMProcessingService: {e}")
            raise
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from local LLM config file."""
        try:
            # Load the LLM-specific config from local file
            config_path = Path(__file__).parent / "config.json"
            print(f"🔍 DEBUG: Loading LLM config from: {config_path}")
            logger.info(f"Loading LLM config from: {config_path}")
            
            if config_path.exists():
                print(f"✅ DEBUG: Config file exists at: {config_path}")
                with open(config_path, 'r') as f:
                    config = json.load(f)
                print(f"✅ DEBUG: Successfully loaded LLM config with keys: {list(config.keys())}")
                logger.info(f"Successfully loaded LLM config with keys: {list(config.keys())}")
                return config
            else:
                error_msg = f"LLM config file not found at: {config_path}"
                print(f"❌ DEBUG: {error_msg}")
                logger.error(error_msg)
                return {}
                
        except Exception as e:
            error_msg = f"Error loading LLM config: {str(e)}"
            print(f"❌ DEBUG: {error_msg}")
            logger.error(error_msg)
            logger.error(f"Full error details: {repr(e)}")
            # Return empty config on failure
            return {}
    
    def process_component(self, component_id: str, text: str, project_id: Optional[int] = None, parent_uiid: Optional[str] = None, save_to_db: bool = False, target_table: Optional[str] = None) -> Dict[str, Any]:
        """
        Process text with the specified component using LLM.
        
        Args:
            component_id: The component ID (e.g., 'gen_initialPrompt')
            text: The input text to process
            project_id: Optional project ID for context
            parent_uiid: Optional parent UIID for hierarchical relationships
            save_to_db: Whether to save the result to DynamoDB
            target_table: The DynamoDB table to save to (optional, will be determined from config if not provided)
            
        Returns:
            Dictionary containing the processed result and metadata
        """
        print(f"🔍 DEBUG: Processing component {component_id} with text length: {len(text)}")
        logger.info(f"Processing component {component_id} with text length: {len(text)}")
        
        try:
            # Get component configuration
            print(f"🔍 DEBUG: Looking up component config for: {component_id}")
            component_mappings = self.config.get("llm", {}).get("componentModelMapping", {})
            
            # Find component by componentId field
            component_config = None
            for key, config in component_mappings.items():
                if config.get("componentId") == component_id:
                    component_config = config
                    break
            
            if not component_config:
                error_msg = f"Component {component_id} not found in configuration"
                print(f"❌ DEBUG: {error_msg}")
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            print(f"✅ DEBUG: Found component config: {component_config}")
            logger.info(f"Found component config for {component_id}")
            
            # Get target table from config if not provided
            if not target_table:
                target_table = component_config.get("targetTable")
                print(f"🔍 DEBUG: Got target table from config: {target_table}")
                logger.info(f"Got target table from config: {target_table}")
            
            # Get model instructions
            print(f"🔍 DEBUG: Getting model instructions from component config")
            model_instructions = component_config.get("modelInstructions", [])
            if not model_instructions:
                error_msg = f"No model instructions found for component {component_id}"
                print(f"❌ DEBUG: {error_msg}")
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            print(f"✅ DEBUG: Found {len(model_instructions)} model instructions")
            logger.info(f"Found {len(model_instructions)} model instructions for {component_id}")
            
            # Get the output format
            output_format = component_config.get('outputFormat', 'plain')
            output_type = output_format.split('_')[0]
            if output_type == 'columns':
                noColumns = int(output_format.split('_')[1])
                outputFormatValue = f"Format the refined text into exactly {noColumns} columns. Each row should be formatted into columns delimited by the pipe character |."
            else:
                outputFormatValue = "Output the refined text as a single, continuous block of natural language."
            
            print(f"🔍 DEBUG: Output format: {output_format}, Output type: {output_type}, Format value: {outputFormatValue}")
            logger.info(f"Output format: {output_format}, Output type: {output_type}")
            
            # Process with each model instruction
            results = []
            progress_updates = []
            
            for i, instruction_config in enumerate(model_instructions):
                print(f"🔍 DEBUG: Processing instruction {i+1}/{len(model_instructions)}")
                logger.info(f"Processing instruction {i+1}/{len(model_instructions)} for {component_id}")
                
                model_key = instruction_config.get("model")
                instruction_key = instruction_config.get("instruction")
                
                if not model_key or not instruction_key:
                    print(f"⚠️ DEBUG: Skipping instruction {i+1} - missing model or instruction key")
                    logger.warning(f"Skipping instruction {i+1} - missing model or instruction key")
                    continue
                
                print(f"🔍 DEBUG: Using model: {model_key}, instruction: {instruction_key}")
                logger.info(f"Using model: {model_key}, instruction: {instruction_key}")
                
                # Get model and instruction configurations
                print(f"🔍 DEBUG: Looking up model and instruction configs")
                model_config = self.config.get("llm", {}).get("models", {}).get(model_key)
                instruction_config = self.config.get("llm", {}).get("instructions", {}).get(instruction_key)
                
                if not model_config or not instruction_config:
                    print(f"⚠️ DEBUG: Model {model_key} or instruction {instruction_key} not found in config")
                    logger.warning(f"Model {model_key} or instruction {instruction_key} not found in config")
                    continue
                
                # Add output format to instruction config
                instruction_config['output_format'] = outputFormatValue
                
                print(f"✅ DEBUG: Found model and instruction configs")
                logger.info(f"Found model and instruction configs for {model_key}/{instruction_key}")
                
                # Build the prompt
                print(f"🔍 DEBUG: Building prompt for instruction {instruction_key}")
                prompt = self._build_prompt(instruction_config, text, project_id, parent_uiid)
                print(f"🔍 DEBUG: Built prompt with length: {len(prompt)}")
                logger.info(f"Built prompt with length: {len(prompt)} for {instruction_key}")
                
                # Update progress
                progress_update = f"Processing with {model_key} using {instruction_key}..."
                progress_updates.append(progress_update)
                print(f"🔍 DEBUG: {progress_update}")
                logger.info(progress_update)
                
                # Get model ID first
                model_id = model_config.get("modelId")
                
                # Get inference ARN from config
                inference_arn = self.config.get("cloud", {}).get("aws", {}).get("bedrock_inference_arn")
                if inference_arn:
                    print(f"🔍 DEBUG: Using inference profile ARN: {inference_arn}")
                else:
                    print(f"🔍 DEBUG: No inference profile ARN configured, using model ID directly")
                
                # Get model parameters
                max_tokens = model_config.get("max_tokens", 2048)
                temperature = model_config.get("temperature", 0.8)
                
                print(f"🔍 DEBUG: Invoking model {model_id} with max_tokens={max_tokens}, temperature={temperature}")
                if inference_arn:
                    print(f"🔍 DEBUG: Using inference profile: {inference_arn}")
                logger.info(f"Invoking model {model_id} with max_tokens={max_tokens}, temperature={temperature}")
                
                print("🚀 DEBUG: ===== LLM INVOKE START =====")
                print(f"🚀 DEBUG: About to call bedrock_service.invoke_model")
                print(f"🚀 DEBUG:   - model_id: {model_id}")
                print(f"🚀 DEBUG:   - prompt length: {len(prompt)}")
                print(f"🚀 DEBUG:   - max_tokens: {max_tokens}")
                print(f"🚀 DEBUG:   - temperature: {temperature}")
                print(f"🚀 DEBUG:   - inference_arn: {inference_arn}")
                print(f"🚀 DEBUG:   - component_id: {component_id}")
                print(f"🚀 DEBUG:   - output_format: {output_format}")
                
                result = self.bedrock_service.invoke_model(
                    model_id=model_id,
                    prompt=prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    inference_arn=inference_arn
                )
                
                print("✅ DEBUG: ===== LLM INVOKE SUCCESS =====")
                print(f"✅ DEBUG: Model invocation completed successfully")
                print(f"✅ DEBUG: Result type: {type(result)}")
                print(f"✅ DEBUG: Result length: {len(result)}")
                print(f"✅ DEBUG: Result preview: {result[:200]}...")
                
                print(f"✅ DEBUG: Model invocation completed, result length: {len(result)}")
                logger.info(f"Model invocation completed, result length: {len(result)}")
                
                results.append({
                    "model": model_key,
                    "instruction": instruction_key,
                    "result": result
                })
                
                logger.info(f"Completed processing with {model_key}")
            
            # Get the final result (use the last result or combine them)
            final_result = results[-1]["result"] if results else ""
            print(f"🔍 DEBUG: Final result length: {len(final_result)}")
            logger.info(f"Final result length: {len(final_result)}")
            
            # Check if we have an output model and if refinement wasn't already handled
            if component_config and 'outputModel' in component_config:
                output_model = component_config['outputModel']
                output_model_key = output_model.get('model')
                output_instruction_key = output_model.get('instruction')
                
                if output_model_key and output_instruction_key:
                    print(f"🔍 DEBUG: Processing output model: {output_model_key} with instruction: {output_instruction_key}")
                    logger.info(f"Processing output model: {output_model_key} with instruction: {output_instruction_key}")
                    
                    # Get the instruction
                    output_instruction = None
                    for instr_key, instr_data in self.config.get("llm", {}).get("instructions", {}).items():
                        if instr_key == output_instruction_key:
                            output_instruction = instr_data
                            output_instruction['output_format'] = outputFormatValue
                            break
                    
                    if output_instruction:
                        try:
                            print(f"🔍 DEBUG: Output instruction keys: {list(output_instruction.keys())}")
                            print(f"🔍 DEBUG: Output instruction constraints: {output_instruction.get('Constraints & Guidelines', 'NOT FOUND')}")
                            print(f"🔍 DEBUG: Output instruction examples: {output_instruction.get('Example', 'NOT FOUND')}")
                            
                            # Build prompt for output refinement
                            refinement_prompt = self._build_prompt(output_instruction, final_result, project_id, parent_uiid)
                            print(f"🔍 DEBUG: Refinement prompt length: {len(refinement_prompt)}")
                            print(f"🔍 DEBUG: Refinement prompt preview: {refinement_prompt[:500]}...")
                            # Get output model configuration
                            output_model_config = self.config.get("llm", {}).get("models", {}).get(output_model_key)
                            if output_model_config:
                                output_model_id = output_model_config.get("modelId")
                                print(f"🔍 DEBUG: Invoking output model: {output_model_id}")
                                logger.info(f"Invoking output model: {output_model_id}")
                                
                                # Get inference ARN for output model if configured
                                output_inference_arn = self.config.get("cloud", {}).get("aws", {}).get("bedrock_inference_arn")
                                if output_inference_arn:
                                    print(f"🔍 DEBUG: Using inference profile ARN for output model: {output_inference_arn}")
                                else:
                                    print(f"🔍 DEBUG: No inference profile ARN configured for output model, using model ID directly")
                                
                                refined_result = self.bedrock_service.invoke_model(
                                    model_id=output_model_id,
                                    prompt=refinement_prompt,
                                    max_tokens=output_model_config.get("body", {}).get("max_tokens", 2048),
                                    temperature=output_model_config.get("body", {}).get("temperature", 0.8),
                                    inference_arn=output_inference_arn
                                )
                                
                                if refined_result:
                                    final_result = refined_result
                                    print(f"✅ DEBUG: Successfully processed output refinement")
                                    logger.info(f"Successfully processed output refinement")
                                else:
                                    print(f"⚠️ DEBUG: Output refinement failed, using original result")
                                    logger.warning(f"Output refinement failed, using original result")
                            else:
                                print(f"⚠️ DEBUG: Output model config not found, using original result")
                                logger.warning(f"Output model config not found, using original result")
                        except Exception as e:
                            print(f"⚠️ DEBUG: Output refinement error: {str(e)}, using original result")
                            logger.warning(f"Output refinement error: {str(e)}, using original result")
            
            # Generate UIIDs if needed
            generated_uiids = []
            if project_id and parent_uiid:
                generated_uiids.append(f"{component_id}_{project_id}_{parent_uiid}")
            
            response = {
                "success": True,
                "result": final_result,
                "modelId": results[-1]["model"] if results else "",
                "modelName": results[-1]["model"] if results else "",  # This will be the friendly name like "model1"
                "instructionId": results[-1]["instruction"] if results else "",
                "progressUpdates": progress_updates,
                "generated_uiids": generated_uiids,
                "metadata": {
                    "component_id": component_id,
                    "project_id": project_id,
                    "parent_uiid": parent_uiid,
                    "models_used": [r["model"] for r in results]
                }
            }
            
            print(f"✅ DEBUG: Processing completed successfully")
            logger.info(f"Processing completed successfully for {component_id}")
            
            # Generate UIIDs and process content if we have a target table
            generated_uiids = []
            if target_table and final_result:
                # Extract items from content and generate UIIDs
                print(f"🔍 DEBUG: Extracting items from content: {final_result[:200]}...")
                items = self._extract_items_from_content(final_result)
                print(f"🔍 DEBUG: Extracted {len(items)} items: {items}")
                generated_uiids = []
                
                for i, item in enumerate(items):
                    uiid = self._generate_uiid(target_table, i, item.get("name", "") + item.get("description", ""))
                    generated_uiids.append(uiid)
                
                # Update response with generated UIIDs
                response["generated_uiids"] = generated_uiids
                print(f"🔍 DEBUG: Generated {len(generated_uiids)} UIIDs: {generated_uiids}")
                logger.info(f"Generated {len(generated_uiids)} UIIDs for {target_table}")
            
            # Save to DynamoDB if requested
            if save_to_db and project_id and final_result and target_table:
                try:
                    print(f"🔍 DEBUG: Saving result to DynamoDB for project {project_id} (type: {type(project_id)}) in table {target_table}")
                    logger.info(f"Saving result to DynamoDB for project {project_id} (type: {type(project_id)}) in table {target_table}")
                    
                    # Save to DynamoDB with generic method
                    self._save_to_database(project_id, component_id, final_result, target_table, parent_uiid)
                    
                    print(f"✅ DEBUG: Successfully saved to DynamoDB")
                    logger.info(f"Successfully saved to DynamoDB for project {project_id}")
                    
                except Exception as e:
                    error_msg = f"Failed to save to DynamoDB: {str(e)}"
                    print(f"❌ DEBUG: {error_msg}")
                    logger.error(error_msg)
                    # Don't fail the entire request if saving fails
                    response["save_error"] = error_msg
            
            return response
            
        except Exception as e:
            error_msg = f"Error processing component {component_id}: {str(e)}"
            print(f"❌ DEBUG: {error_msg}")
            logger.error(error_msg)
            return {
                "success": False,
                "error": str(e),
                "result": "",
                "modelId": "",
                "instructionId": "",
                "progressUpdates": [],
                "generated_uiids": []
            }
    
    def _build_prompt(self, instruction_config: Dict[str, Any], text: str, project_id: Optional[int] = None, parent_uiid: Optional[str] = None) -> str:
        """
        Build a prompt based on instruction configuration and input text.
        
        Args:
            instruction_config: The instruction configuration
            text: The input text
            project_id: Optional project ID
            parent_uiid: Optional parent UIID
            
        Returns:
            The formatted prompt
        """
        print(f"🔍 DEBUG: Building prompt with instruction config keys: {list(instruction_config.keys())}")
        logger.info(f"Building prompt with instruction config keys: {list(instruction_config.keys())}")
        
        role = instruction_config.get("Role", "You are a helpful assistant.")
        objective = instruction_config.get("Objective", "Process the given input.")
        constraints = instruction_config.get("Constraints & Guidelines", {})
        output_limit = instruction_config.get("Output Word Limit", 500)
        
        print(f"🔍 DEBUG: Role: {role}")
        print(f"🔍 DEBUG: Objective: {objective}")
        print(f"🔍 DEBUG: Output limit: {output_limit}")
        logger.info(f"Building prompt with role: {role[:50]}..., objective: {objective[:50]}..., output_limit: {output_limit}")
        
        # Build the prompt
        prompt = f"{role}\n\n{objective}\n\n"
        
        # Add constraints and guidelines
        if constraints:
            prompt += "Constraints & Guidelines:\n"
            for key, value in constraints.items():
                if isinstance(value, dict):
                    prompt += f"- {key}:\n"
                    for subkey, subvalue in value.items():
                        if isinstance(subvalue, dict):
                            prompt += f"  - {subkey}:\n"
                            for subsubkey, subsubvalue in subvalue.items():
                                prompt += f"    - {subsubkey}: {subsubvalue}\n"
                        else:
                            prompt += f"  - {subkey}: {subvalue}\n"
                else:
                    prompt += f"- {key}: {value}\n"
        
        # Add examples if available
        examples = instruction_config.get("Example", [])
        print(f"🔍 DEBUG: Examples found: {examples}")
        if examples:
            prompt += "\nExamples:\n"
            for example in examples:
                prompt += f"- {example}\n"
            print(f"🔍 DEBUG: Added {len(examples)} examples to prompt")
        else:
            print(f"🔍 DEBUG: No examples found in instruction config")
            print(f"🔍 DEBUG: Available keys in instruction_config: {list(instruction_config.keys())}")
        
        # Add context information
        context_info = []
        if project_id:
            context_info.append(f"Project ID: {project_id}")
        if parent_uiid:
            context_info.append(f"Parent UIID: {parent_uiid}")
        
        if context_info:
            prompt += f"\nContext: {' | '.join(context_info)}\n"
        
        # Add output limit
        prompt += f"\nOutput Word Limit: {output_limit} words\n\n"
        
        # Add output format if specified
        output_format = instruction_config.get("output_format")
        print(f"🔍 DEBUG: Output format found: {output_format}")
        if output_format:
            prompt += f"\nOutput Format: {output_format}\n\n"
            print(f"🔍 DEBUG: Added output format to prompt: {output_format}")
        else:
            print(f"🔍 DEBUG: No output format found in instruction config")
        
        # Add the input text
        prompt += f"Input: {text}\n\nResponse:"
        
        print(f"🔍 DEBUG: Built prompt with total length: {len(prompt)}")
        logger.info(f"Built prompt with total length: {len(prompt)}")
        return prompt
    
    def _save_to_database(self, project_id: str, component_id: str, result: str, target_table: str, parent_uiid: Optional[str] = None):
        """
        Save LLM-generated data to DynamoDB table using generic logic.
        
        Args:
            project_id: The project ID
            component_id: The component ID
            result: The generated result (pipe-delimited content)
            target_table: The target DynamoDB table name
            parent_uiid: Optional parent UIID for hierarchical relationships
        """
        try:
            print(f"🔍 DEBUG: Saving to DynamoDB table: {target_table}")
            print(f"🔍 DEBUG: Project ID: {project_id}")
            print(f"🔍 DEBUG: Component ID: {component_id}")
            print(f"🔍 DEBUG: Parent UIID: {parent_uiid}")
            print(f"🔍 DEBUG: Raw result content (first 500 chars): {result[:500]}...")
            logger.info(f"Saving to DynamoDB table {target_table} for project {project_id}")
            
            # Parse the pipe-delimited content
            print(f"🔍 DEBUG: About to call _parse_pipe_delimited_content")
            parsed_data = self._parse_pipe_delimited_content(result)
            print(f"🔍 DEBUG: Parsed data: {parsed_data}")
            
            # Initialize DynamoDB client
            dynamodb = boto3.resource('dynamodb')
            
            # Map table names to environment variables
            table_env_mapping = {
                'user_flows': 'USER_FLOWS_TABLE_NAME',
                'high_level_requirements': 'HIGH_LEVEL_REQUIREMENTS_TABLE_NAME',
                'low_level_requirements': 'LOW_LEVEL_REQUIREMENTS_TABLE_NAME',
                'test_cases': 'TEST_CASES_TABLE_NAME'
            }
            
            # Get table name from environment variable or use default
            env_var = table_env_mapping.get(target_table, f'{target_table.upper()}_TABLE_NAME')
            table_name = os.environ.get(env_var, f'prod-vishmaker-{target_table.replace("_", "-")}')
            table = dynamodb.Table(table_name)
            
            print(f"🔍 DEBUG: Using table: {table_name}")
            logger.info(f"Using table: {table_name}")
            
            # Save each parsed item to DynamoDB
            for item in parsed_data:
                # Generate UIID if not present
                uiid = item.get("uiid") or f"{component_id}_{project_id}_{int(datetime.now().timestamp())}"
                
                # Create base item
                db_item = {
                    'uiid': uiid,
                    'name': item.get("name", f"Generated {component_id}"),
                    'description': item.get("description", ""),
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                
                # Add table-specific fields
                if target_table == 'user_flows':
                    db_item['project_id'] = project_id
                    print(f"🔍 DEBUG: Setting project_id for user_flows: {project_id} (type: {type(project_id)})")
                elif target_table in ['high_level_requirement', 'high_level_requirements', 'low_level_requirement', 'low_level_requirements', 'test_cases']:
                    if parent_uiid:
                        db_item['parent_uiid'] = parent_uiid
                        print(f"🔍 DEBUG: Setting parent_uiid: {parent_uiid} (type: {type(parent_uiid)})")
                    else:
                        # For top-level requirements, use project_id as parent
                        db_item['parent_uiid'] = project_id
                        print(f"🔍 DEBUG: Using project_id as parent_uiid: {project_id} (type: {type(project_id)})")
                
                print(f"🔍 DEBUG: Saving item: {db_item}")
                logger.info(f"Saving item with UIID: {uiid}")
                
                # Save to DynamoDB
                table.put_item(Item=db_item)
                
                print(f"✅ DEBUG: Successfully saved item to DynamoDB table {target_table}")
                logger.info(f"Successfully saved item to DynamoDB table {target_table} with UIID: {uiid}")
            
        except Exception as e:
            error_msg = f"Error saving to DynamoDB table {target_table}: {str(e)}"
            print(f"❌ DEBUG: {error_msg}")
            logger.error(error_msg)
            raise
    
    def _parse_pipe_delimited_content(self, content: str) -> List[Dict[str, Any]]:
        """
        Parse pipe-delimited LLM output into a standardized format.
        
        Expected format:
        Name/Title | Description/Details | UIID (optional)
        
        Returns:
        List of dictionaries with name, description, uiid, and order
        """
        if not content or not content.strip():
            raise ValueError("Content is empty")
        
        # Check if content is in pipe-delimited format and fix if needed
        if not self._validate_pipe_delimited_format(content):
            content = self._fix_output_format(content)
        
        # Parse each line
        lines = content.strip().split('\n')
        items = []
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            if '|' not in line:
                # Try to fix lines without pipe delimiter
                if ':' in line:
                    parts = line.split(':', 1)
                    line = f"{parts[0].strip()} | {parts[1].strip()}"
                elif '.' in line:
                    parts = line.split('.', 1)
                    line = f"{parts[0].strip()} | {parts[1].strip()}"
                else:
                    line = f"Item {i+1} | {line}"
                
            parts = line.split('|')
            name = parts[0].strip()
            description = parts[1].strip() if len(parts) > 1 else ""
            
            # Extract UIID if present, or generate a unique one
            uiid = parts[2].strip() if len(parts) > 2 and parts[2].strip() else f"auto-{i}-{hash(name + description) & 0xffffffff}"
            
            items.append({
                "name": name,
                "description": description,
                "uiid": uiid,
                "order": i
            })
        
        return items
    
    
    def _validate_pipe_delimited_format(self, text: str) -> bool:
        """
        Validate that the text is in pipe-delimited format.
        Checks that most lines contain at least one pipe character.
        """
        lines = text.strip().split('\n')
        valid_lines = [line for line in lines if line.strip()]
        if not valid_lines:
            return False
            
        # Check if at least 70% of lines have a pipe character
        lines_with_pipe = sum(1 for line in valid_lines if '|' in line)
        return lines_with_pipe / len(valid_lines) >= 0.7
    
    def _fix_output_format(self, text: str) -> str:
        """
        Attempt to fix the output format if it's not pipe-delimited.
        Looks for patterns in the text that might indicate name/description pairs.
        """
        lines = text.strip().split('\n')
        formatted_lines = []
        
        for i, line in enumerate(lines):
            if not line.strip():
                continue
                
            if '|' not in line:
                # Try different splitting strategies
                if ':' in line:
                    # Split by colon (common in key-value pairs)
                    parts = line.split(':', 1)
                    formatted_lines.append(f"{parts[0].strip()} | {parts[1].strip()}")
                elif '. ' in line and line[0].isdigit():
                    # Split numbered items (e.g., "1. First item")
                    parts = line.split('. ', 1)
                    formatted_lines.append(f"Item {parts[0].strip()} | {parts[1].strip()}")
                elif line.strip().startswith('- '):
                    # Handle bullet points
                    content = line.strip()[2:]
                    formatted_lines.append(f"Item {i+1} | {content}")
                else:
                    formatted_lines.append(f"Item {i+1} | {line.strip()}")
            else:
                formatted_lines.append(line)
        
        return '\n'.join(formatted_lines)
    
    
    def _generate_uiid(self, table_type: str, index: int, text: str) -> str:
        """
        Generate a unique identifier for an item.
        
        Args:
            table_type: Type of table ("user_flow", "high_level_requirement", etc.)
            index: The item's index/position
            text: Text to use for additional uniqueness
            
        Returns:
            A unique ID string
        """
        import time
        
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
    
    def _extract_items_from_content(self, content: str) -> List[Dict[str, Any]]:
        """
        Extract items from content based on pipe-delimited format.
        Args:
            content: Raw content text
        Returns:
            List of dictionaries with name and description fields
        """
        items = []
        lines = content.strip().split('\n')
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            # Check if it's a pipe-delimited line
            if '|' in line:
                parts = line.split('|')
                name = parts[0].strip() if parts[0] else f"Item {i+1}"
                description = parts[1].strip() if len(parts) > 1 and parts[1] else ""
                
                items.append({
                    "name": name,
                    "description": description
                })
            # If not pipe-delimited, try to extract structured data
            elif ':' in line and not line.lower().startswith(('id:', 'item name:', 'description:')):
                parts = line.split(':', 1)
                items.append({
                    "name": parts[0].strip() if parts[0] else f"Item {i+1}",
                    "description": parts[1].strip() if parts[1] else ""
                })
        
        return items
    
    # Create a singleton instance
print("🔍 DEBUG: Creating LLMProcessingService singleton instance")
logger.info("Creating LLMProcessingService singleton instance")
try:
    llm_processing_service = LLMProcessingService()
    print("✅ DEBUG: LLMProcessingService singleton created successfully")
    logger.info("LLMProcessingService singleton created successfully")
except Exception as e:
    print(f"❌ DEBUG: Failed to create LLMProcessingService singleton: {e}")
    logger.error(f"Failed to create LLMProcessingService singleton: {e}")
    raise 