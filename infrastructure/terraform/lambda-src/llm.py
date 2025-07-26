import json
import os
import sys
import time
import hashlib
import logging
import boto3
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

def get_secret(secret_arn):
    """Get secret from AWS Secrets Manager"""
    client = boto3.client('secretsmanager')
    try:
        response = client.get_secret_value(SecretId=secret_arn)
        if 'SecretString' in response:
            return json.loads(response['SecretString'])
        return None
    except Exception as e:
        print(f"Error getting secret: {e}")
        return None

def get_llm_api_keys():
    """Get LLM API keys from Secrets Manager"""
    secret_arn = os.environ.get('LLM_SECRET_ARN')
    if not secret_arn:
        print("Warning: LLM_SECRET_ARN environment variable not set")
        return {}
    
    return get_secret(secret_arn) or {}

def handler(event, context):
    print("LLM Lambda invoked!")
    print(f"Event: {json.dumps(event)}")
    
    try:
        # Parse the API Gateway event
        http_method = event.get('httpMethod', 'POST')
        path = event.get('path', '/')
        
        # Route the request based on the path and method
        if http_method == 'POST' and '/process' in path:
            return handle_process_llm(event)
        elif http_method == 'GET' and '/health' in path:
            return handle_health_check()
        else:
            return {
                "statusCode": 404,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Endpoint not found"})
            }
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Internal server error: {str(e)}"})
        }

def handle_health_check():
    """Handle GET /llm/health - Health check for LLM service"""
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"status": "healthy", "service": "llm"})
    }

def handle_process_llm(event):
    """Handle POST /llm/process - Process text using LLM"""
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Validate required fields
        component_id = body.get('componentId')
        text = body.get('text')
        
        if not component_id or not text:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "componentId and text are required"})
            }
        
        # Extract optional fields
        project_id = body.get('project_id')
        parent_uiid = body.get('parent_uiid')
        save_to_db = body.get('save_to_db', True)
        
        # Process with LLM
        request_id = datetime.now().strftime("%Y%m%d%H%M%S")
        
        # Initialize progress updates and generated UIIDs
        progress_updates = []
        generated_uiids = []
        
        progress_updates.append("Starting LLM processing...")
        
        # Load configuration
        config = load_config()
        if not config or 'llm' not in config:
            raise ValueError("LLM configuration not found")
        
        # Find component mapping
        component_mapping = None
        for component_key, component_data in config['llm'].get('componentModelMapping', {}).items():
            if component_data.get('componentId') == component_id:
                component_mapping = component_data
                break
        
        if not component_mapping:
            raise ValueError(f"Component '{component_id}' not found in configuration")
        
        # Get target table
        target_table = component_mapping.get('targetTable')
        
        # Process with LLM using BedrockService
        result, model_id, instruction_id = process_with_bedrock(
            component_mapping, text, config, request_id, progress_updates
        )
        
        # Generate UIIDs if target table exists
        if target_table and result:
            generated_uiids = generate_uiids_for_content(result, target_table)
        
        progress_updates.append("LLM processing completed successfully")
        
        response_data = {
            "result": result,
            "modelId": model_id,
            "instructionId": instruction_id,
            "progressUpdates": progress_updates,
            "generated_uiids": generated_uiids
        }
        
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(response_data)
        }
        
    except Exception as e:
        print(f"Error processing LLM request: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Failed to process LLM request: {str(e)}"})
        }

def load_config_from_s3(bucket, key):
    """Load configuration from S3"""
    try:
        s3 = boto3.client('s3')
        response = s3.get_object(Bucket=bucket, Key=key)
        config_str = response['Body'].read().decode('utf-8')
        return json.loads(config_str)
    except Exception as e:
        print(f"Error loading config from S3: {str(e)}")
        return {}


def load_config():
    """Load configuration from S3 or default config"""
    try:
        # Load from S3
        bucket = os.environ.get('CONFIG_BUCKET')
        key = os.environ.get('CONFIG_KEY')
        if bucket and key:
            return load_config_from_s3(bucket, key)

        # Fallback to environment variable if needed (for local testing)
        config_str = os.environ.get('LLM_CONFIG')
        if config_str:
            return json.loads(config_str)
        
        # Default configuration structure (based on your config.json)
        return {
            "llm": {
                "models": {
                    "model1": {
                        "modelId": "anthropic.claude-sonnet-4-20250514-v1:0",
                        "contentType": "application/json",
                        "accept": "application/json",
                        "body": {
                            "anthropic_version": "bedrock-2023-05-31",
                            "max_tokens": 2048,
                            "top_k": 250,
                            "stop_sequences": [],
                            "temperature": 0.8,
                            "top_p": 0.999,
                            "system": "You are a helpful assistant that can answer questions and help with tasks.",
                            "messages": [
                                {
                                    "role": "user",
                                    "content": [{"type": "text", "text": "hello world"}]
                                }
                            ]
                        }
                    },
                    "model2": {
                        "modelId": "anthropic.claude-3-7-sonnet-20250219-v1:0",
                        "contentType": "application/json",
                        "accept": "application/json",
                        "body": {
                            "anthropic_version": "bedrock-2023-05-31",
                            "max_tokens": 200,
                            "top_k": 250,
                            "stop_sequences": [],
                            "temperature": 1,
                            "top_p": 0.999,
                            "messages": [
                                {
                                    "role": "user",
                                    "content": [{"type": "text", "text": "hello world"}]
                                }
                            ]
                        }
                    }
                },
                "instructions": {
                    "instruction1": {
                        "Role": "You are a product specification expert...",
                        "Objective": "Convert the user's input into a professional product specification...",
                        "Output Word Limit": 100
                    }
                },
                "componentModelMapping": {
                    "component1": {
                        "componentId": "gen_initialPrompt",
                        "modelInstructions": [{"model": "model2", "instruction": "instruction1"}],
                        "outputModel": {"model": "model1", "instruction": "instruction4"},
                        "outputFormat": "plain"
                    }
                }
            }
        }
    except Exception as e:
        print(f"Error loading config: {str(e)}")
        return {}

def process_with_bedrock(component_mapping, user_text, config, request_id, progress_updates):
    """Process text using AWS Bedrock"""
    try:
        # Import BedrockService
        bedrock_service = BedrockService(config)
        
        # Get model instructions
        model_instructions = component_mapping.get('modelInstructions', [])
        output_model = component_mapping.get('outputModel', {})
        
        current_text = user_text
        final_model_id = None
        final_instruction_id = None
        
        # Process through each model instruction
        for step_index, step in enumerate(model_instructions):
            model_key = step.get('model')
            instruction_key = step.get('instruction')
            
            progress_updates.append(f"Processing step {step_index + 1} with {model_key}")
            
            # Get instruction from config
            instruction = config['llm']['instructions'].get(instruction_key, {})
            
            # Process with Bedrock
            response_content, metadata = bedrock_service.get_model_response(
                model_key=model_key,
                instruction=instruction,
                user_text=current_text,
                request_id=request_id
            )
            
            if response_content is None:
                raise ValueError(f"Failed to get response from model {model_key}")
            
            current_text = response_content
            final_model_id = metadata.get('model_id', model_key)
            final_instruction_id = instruction_key
        
        # Process output model if specified
        if output_model and output_model.get('model') and output_model.get('instruction'):
            model_key = output_model.get('model')
            instruction_key = output_model.get('instruction')
            
            progress_updates.append(f"Final processing with output model {model_key}")
            
            instruction = config['llm']['instructions'].get(instruction_key, {})
            
            response_content, metadata = bedrock_service.get_model_response(
                model_key=model_key,
                instruction=instruction,
                user_text=current_text,
                request_id=request_id
            )
            
            if response_content is not None:
                current_text = response_content
                final_model_id = metadata.get('model_id', model_key)
                final_instruction_id = instruction_key
        
        return current_text, final_model_id, final_instruction_id
        
    except Exception as e:
        print(f"Error in Bedrock processing: {str(e)}")
        raise

def generate_uiids_for_content(content, target_table):
    """Generate UIIDs for content items"""
    try:
        items = extract_items_from_content(content)
        uiids = []
        
        for index, item in enumerate(items):
            uiid = generate_uiid(target_table, index, item.get('name', ''))
            uiids.append(uiid)
        
        return uiids
    except Exception as e:
        print(f"Error generating UIIDs: {str(e)}")
        return []

def generate_uiid(table_type, index, text):
    """Generate a unique identifier for an item"""
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

def extract_items_from_content(content):
    """Extract items from content based on pipe-delimited format"""
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

class BedrockService:
    """Simplified BedrockService for Lambda environment"""
    
    def __init__(self, config=None):
        self.config = config or {}
        self.client = None
        self.api_keys = get_llm_api_keys()
        self._setup_client()
    
    def _setup_client(self):
        """Set up AWS Bedrock client"""
        try:
            import boto3
            from botocore.config import Config
            
            # Get AWS credentials from environment
            aws_region = os.environ.get('AWS_REGION', 'us-east-1')
            
            # Lambda execution role should provide credentials automatically
            config = Config(
                region_name=aws_region,
                retries=dict(max_attempts=3),
                connect_timeout=10,
                read_timeout=120
            )
            
            self.client = boto3.client('bedrock-runtime', config=config)
            print(f"AWS Bedrock client initialized successfully in region {aws_region}")
            return True
            
        except Exception as e:
            print(f"Error setting up Bedrock client: {str(e)}")
            return False
    
    def get_model_response(self, model_key, instruction=None, user_text=None, request_id=None):
        """Get response from Bedrock model"""
        try:
            if not self.client:
                raise ValueError("Bedrock client not initialized")
            
            # Get model configuration
            models = self.config.get('llm', {}).get('models', {})
            model_config = models.get(model_key)
            
            if not model_config:
                raise ValueError(f"Model {model_key} not found in configuration")
            
            model_id = model_config.get('modelId')
            if not model_id:
                raise ValueError(f"Model ID not found for {model_key}")
            
            # Prepare request body
            request_body = model_config.get('body', {}).copy()
            
            # Update the user message with actual text
            if 'messages' in request_body and request_body['messages']:
                request_body['messages'][0]['content'][0]['text'] = user_text
            
            # Add system message if instruction provided
            if instruction and 'system' in request_body:
                system_text = instruction.get('Role', '') + ' ' + instruction.get('Objective', '')
                request_body['system'] = system_text.strip()
            
            # Invoke model
            print(f"Invoking model {model_id} with request: {json.dumps(request_body)}")
            
            response = self.client.invoke_model(
                modelId=model_id,
                body=json.dumps(request_body),
                contentType='application/json',
                accept='application/json'
            )
            
            # Parse response
            response_body = json.loads(response['body'].read())
            
            # Extract content based on model type
            if 'content' in response_body:
                # Claude format
                content = response_body['content'][0]['text']
            elif 'generation' in response_body:
                # Other format
                content = response_body['generation']
            else:
                # Fallback
                content = str(response_body)
            
            metadata = {
                'model_id': model_id,
                'model_key': model_key
            }
            
            print(f"Successfully got response from {model_id}")
            return content, metadata
            
        except Exception as e:
            print(f"Error getting model response: {str(e)}")
            return None, {"error": str(e)} 