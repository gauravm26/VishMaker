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
            
            print(f"🔍 DEBUG: About to call bedrock.invoke_model")
            
            # Use inference profile if provided, otherwise use model_id directly
            target_model_id = inference_arn if inference_arn else model_id
            
            response = self.bedrock.invoke_model(
                modelId=target_model_id,
                body=json.dumps(request_body),
                contentType='application/json',
                accept='application/json'
            )
            
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
    
    def process_component(self, component_id: str, text: str, project_id: Optional[int] = None, parent_uiid: Optional[str] = None) -> Dict[str, Any]:
        """
        Process text with the specified component using LLM.
        
        Args:
            component_id: The component ID (e.g., 'gen_initialPrompt')
            text: The input text to process
            project_id: Optional project ID for context
            parent_uiid: Optional parent UIID for hierarchical relationships
            
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
                
                result = self.bedrock_service.invoke_model(
                    model_id=model_id,
                    prompt=prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    inference_arn=inference_arn
                )
                
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
            
            # Generate UIIDs if needed
            generated_uiids = []
            if project_id and parent_uiid:
                generated_uiids.append(f"{component_id}_{project_id}_{parent_uiid}")
            
            response = {
                "success": True,
                "result": final_result,
                "modelId": results[-1]["model"] if results else "",
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
        
        # Add constraints
        if constraints:
            prompt += "Constraints & Guidelines:\n"
            for key, value in constraints.items():
                if isinstance(value, dict):
                    prompt += f"- {key}:\n"
                    for subkey, subvalue in value.items():
                        prompt += f"  - {subkey}: {subvalue}\n"
                else:
                    prompt += f"- {key}: {value}\n"
        
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
        
        # Add the input text
        prompt += f"Input: {text}\n\nResponse:"
        
        print(f"🔍 DEBUG: Built prompt with total length: {len(prompt)}")
        logger.info(f"Built prompt with total length: {len(prompt)}")
        return prompt

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