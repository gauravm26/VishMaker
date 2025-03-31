import boto3
import os
import json
import re
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
from botocore.config import Config

# Add the project root to sys.path to enable imports from app-core
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# Ensure logs directory exists
logs_dir = project_root / 'logs'
if not logs_dir.exists():
    print(f"Creating logs directory: {logs_dir}")
    logs_dir.mkdir(parents=True, exist_ok=True)

# Configure logging for LLM interactions - payload and response only
log_path = logs_dir / 'llm_interactions.log'
print(f"Logging LLM interactions to: {log_path}")

llm_logger = logging.getLogger('llm_interactions')
llm_logger.setLevel(logging.INFO)

# Clear existing handlers
for handler in llm_logger.handlers[:]:
    llm_logger.removeHandler(handler)

# Add file handler with simple formatter and immediate flush
file_handler = logging.FileHandler(log_path, mode='a')
file_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
file_handler.setLevel(logging.INFO)
llm_logger.addHandler(file_handler)

# Also log to console for debugging
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
console_handler.setLevel(logging.INFO)
llm_logger.addHandler(console_handler)

# Test log entry to verify logging is working
try:
    llm_logger.info("LLM logging initialized")
    with open(log_path, "a") as f:
        f.write("Direct file write test: LLM logging initialized\n")
    print(f"Test logging to {log_path} completed")
except Exception as e:
    print(f"ERROR: Could not write to log file: {str(e)}")

# Force logger to not use parent handlers and to propagate properly
llm_logger.propagate = False

# BedrockService implementation - integrated directly
class BedrockService:
    """Service class for AWS Bedrock operations"""
    
    def __init__(self, config_path=None):
        """Initialize the BedrockService"""
        self.session = None
        self.client = None
        self.config = None
        self.current_request_id = None
        
        # Load configuration
        if config_path:
            with open(config_path, 'r') as f:
                self.config = json.load(f)
        else:
            self.config = load_config()
        
        self.setup_client()
    
    def setup_client(self):
        """Set up the AWS Bedrock client"""
        try:
            # Get credentials from environment variables
            aws_access_key = os.getenv('AWS_BEDROCK_ACCESS_KEY_ID')
            aws_secret_key = os.getenv('AWS_BEDROCK_SECRET_ACCESS_KEY')
            aws_region = os.getenv('AWS_BEDROCK_REGION', 'us-east-1')
            
            # Validate credentials
            if not aws_access_key or not aws_secret_key:
                llm_logger.warning("AWS Bedrock credentials not found in environment variables")
                llm_logger.warning("Please set AWS_BEDROCK_ACCESS_KEY_ID and AWS_BEDROCK_SECRET_ACCESS_KEY")
                return False
            
            # Create a new boto3 session
            self.session = boto3.Session(
                aws_access_key_id=aws_access_key,
                aws_secret_access_key=aws_secret_key,
                region_name=aws_region
            )
            
            # Create the bedrock-runtime client
            self.client = self.session.client('bedrock-runtime')
            
            # Test if the client is properly initialized
            try:
                # Try to list foundation models to verify access
                sts = self.session.client('sts')
                sts.get_caller_identity()
                llm_logger.info(f"AWS Bedrock client initialized successfully in region {aws_region}")
                return True
            except Exception as e:
                llm_logger.error(f"AWS access test failed: {str(e)}")
                return False
                
        except Exception as e:
            llm_logger.error(f"Error setting up Bedrock client: {str(e)}")
            return False
    
    def prepare_request_payload(self, model_key, instruction, user_text):
        """
        Prepare the request payload for the LLM based on configuration
        
        Args:
            model_key (str): The model key in the config
            instruction (dict): The instruction to use for the request
            user_text (str): The user's input text
            
        Returns:
            dict: The prepared request payload
            str: The actual model ID
        """
        try:
            # Get model configuration
            if not self.config or 'llm' not in self.config or 'models' not in self.config['llm']:
                llm_logger.error("Invalid configuration structure")
                raise ValueError("Invalid configuration structure")
                
            # Get model configuration
            if model_key not in self.config['llm']['models']:
                llm_logger.error(f"Model key '{model_key}' not found in configuration")
                raise ValueError(f"Model key '{model_key}' not found in configuration")
                
            model_config = self.config['llm']['models'][model_key]
            
            if 'modelId' not in model_config or 'body' not in model_config:
                llm_logger.error(f"Invalid model configuration for model '{model_key}'. Required fields: modelId, body")
                raise ValueError(f"Invalid model configuration for model '{model_key}'. Required fields: modelId, body")
                
            model_id = model_config['modelId']
            llm_logger.debug(f"Preparing request payload for model_key: {model_key}, model_id: {model_id}")
            
            # Get a deep copy of the template
            if isinstance(model_config['body'], str):
                config_body = json.loads(model_config['body'])
            else:
                config_body = json.loads(json.dumps(model_config['body']))
            
            # Format the instruction
            formatted_instruction = self._format_instruction(instruction)
            
            # Apply model-specific payload configuration
            # Claude models require the 'system' parameter at the top level
            if 'anthropic' in model_id.lower():
                # Claude models - add system parameter at top level
                config_body['system'] = formatted_instruction
                
                # Update messages array with user content
                if 'messages' in config_body:
                    config_body['messages'] = [
                        {"role": "user", "content": [{"type": "text", "text": user_text}]}
                    ]
            elif 'meta.llama' in model_id.lower():
                # Meta Llama models use a specific prompt format
                config_body['prompt'] = f"<s>[INST] {formatted_instruction}\n\n{user_text} [/INST]"
            elif 'messages' in config_body:
                # Other models with messages array
                # First try to update an existing system message
                system_message_index = next((i for i, msg in enumerate(config_body.get('messages', [])) 
                                          if msg.get('role') == 'system'), None)
                
                # Update or add system message with instructions
                if system_message_index is not None:
                    # Update existing system message
                    if isinstance(config_body['messages'][system_message_index].get('content'), list):
                        config_body['messages'][system_message_index]['content'] = [{"type": "text", "text": formatted_instruction}]
                    else:
                        config_body['messages'][system_message_index]['content'] = formatted_instruction
                else:
                    # Add new system message
                    config_body['messages'].insert(0, {"role": "system", "content": formatted_instruction})
                
                # Now update or add the user message
                user_message_index = next((i for i, msg in enumerate(config_body.get('messages', [])) 
                                         if msg.get('role') == 'user'), None)
                
                if user_message_index is not None:
                    # Update existing user message
                    if isinstance(config_body['messages'][user_message_index].get('content'), list):
                        config_body['messages'][user_message_index]['content'] = [{"type": "text", "text": user_text}]
                    else:
                        config_body['messages'][user_message_index]['content'] = user_text
                else:
                    # Add new user message
                    config_body['messages'].append({"role": "user", "content": user_text})
            
            elif 'prompt' in config_body:
                # For models that use a prompt field (like Llama)
                config_body['prompt'] = f"{formatted_instruction}\n\nUser request: {user_text}"
            else:
                # Generic fallback for unknown model types
                # If there's no messages or prompt field, create one
                config_body['prompt'] = f"{formatted_instruction}\n\nUser request: {user_text}"
            
            llm_logger.debug(f"Successfully prepared request payload for model: {model_id}")
            return config_body, model_id
            
        except Exception as e:
            llm_logger.error(f"Error preparing request payload: {str(e)}")
            raise ValueError(f"Error preparing request payload: {str(e)}")
    
    def _format_instruction(self, instruction):
        """Format instruction data into a readable string"""
        if not instruction:
            return ""
            
        if isinstance(instruction, dict):
            formatted = ""
            
            # Loop through all keys in instruction dictionary
            for key, value in instruction.items():
                # Skip output_format since it's added by the output model logic
                if key == 'output_format':
                    continue
                
                # Handle "Role" specially - no prefix
                if key == "Role":
                    formatted += f"{value}\n\n"
                    continue
                
                # Handle "Examples" specially - just mention they exist
                if key == "Examples" and value:
                    formatted += f"{key}: Examples are available in the configuration.\n\n"
                    continue
                
                # Handle nested dictionaries (like ConstraintsAndGuidelines)
                if isinstance(value, dict):
                    # Convert camelCase or snake_case to spaces for display
                    display_key = re.sub(r'([a-z])([A-Z])', r'\1 \2', key).replace('_', ' ')
                    formatted += f"{display_key}:\n"
                    
                    for sub_key, sub_value in value.items():
                        # Handle nested nested dictionaries
                        if isinstance(sub_value, dict):
                            formatted += f"- {sub_key}:\n"
                            for sub_sub_key, sub_sub_value in sub_value.items():
                                formatted += f"  - {sub_sub_key}: {sub_sub_value}\n"
                        else:
                            formatted += f"- {sub_key}: {sub_value}\n"
                    
                    formatted += "\n"
                else:
                    # Convert camelCase or snake_case to spaces for display
                    display_key = re.sub(r'([a-z])([A-Z])', r'\1 \2', key).replace('_', ' ')
                    formatted += f"{display_key}: {value}\n\n"
            
            # Add specific output instructions based on output_format if present
            if 'output_format' in instruction:
                if instruction['output_format'] == 'plain':
                    formatted += "Output: If the variable 'output_format' is set to 'plain', produce a clear and polished natural-language text.\n\n"
                elif instruction['output_format'] == 'columns':
                    formatted += "Output: If the variable 'output_format' is set to 'columns', produce output into two columns, with each line following the format 'Column1 text | Column2 text'.\n\n"
            
            return formatted.strip()
        else:
            # If instruction is not a dict, return as string
            return str(instruction)
    
    def process_model_response(self, model_id, response, component_config=None, response_body=None):
        """
        Process the response from the model based on model configuration
        
        Args:
            model_id (str): The model ID
            response: The response from the Bedrock API
            component_config: Optional component configuration containing outputModel details
            response_body: Optional pre-parsed response body (if already parsed)
            
        Returns:
            str: The extracted content from the response
            dict: Metadata dict including whether refinement was performed
        """
        try:
            # Initialize metadata
            metadata = {"refinement_performed": False}
            
            # If we have a pre-parsed response body, use it
            if response_body:
                # Use the pre-parsed body
                llm_logger.debug(f"Using pre-parsed response body type: {type(response_body)}")
            # Otherwise read from response
            elif response and hasattr(response, 'get') and response.get('body'):
                # Read the response body
                response_body_raw = response.get('body').read()
                
                # Check if the response body is empty
                if not response_body_raw:
                    llm_logger.debug("Response body is empty")
                    raise ValueError("Empty response body received from AWS Bedrock")
                    
                # Try to parse the response body as JSON
                try:
                    response_body = json.loads(response_body_raw)
                    llm_logger.debug(f"Parsed response body: {json.dumps(response_body)[:200]}...")
                except json.JSONDecodeError as e:
                    # Log the raw response for debugging
                    llm_logger.error(f"Failed to parse response as JSON: {str(e)}")
                    llm_logger.error(f"Raw response: {response_body_raw[:1000]}")  # Print first 1000 chars
                    raise ValueError(f"Invalid JSON response from AWS Bedrock: {str(e)}")
            else:
                llm_logger.debug("No response body available")
                if not response_body:
                    raise ValueError("Empty response received from AWS Bedrock")
            
            # Extract provider from model ID
            provider_name = model_id.split('.')[0] if '.' in model_id else ""
            llm_logger.debug(f"Processing response from provider: {provider_name}")
            
            # Extract content based on response structure
            content = ""
            
            # For Claude models - special handling
            if 'anthropic' in model_id.lower():
                # Extract content from Claude response format
                if "content" in response_body and isinstance(response_body["content"], list) and len(response_body["content"]) > 0:
                    # Claude-3 response format
                    first_content = response_body.get("content", [])[0]
                    if isinstance(first_content, dict) and "text" in first_content:
                        content = first_content.get("text", "")
                        llm_logger.debug(f"Extracted Claude-3 content, length: {len(content)}")
                elif "completion" in response_body:
                    # Claude-2 response format
                    content = response_body.get("completion", "")
                    llm_logger.debug(f"Extracted Claude-2 completion, length: {len(content)}")
            # Handle Llama models
            elif 'meta.llama' in model_id.lower():
                if "generation" in response_body:
                    content = response_body.get("generation", "")
                    llm_logger.debug(f"Extracted Llama generation, length: {len(content)}")
                elif "text" in response_body:
                    content = response_body.get("text", "")
                    llm_logger.debug(f"Extracted Llama text, length: {len(content)}")
            # Handle other models or fallbacks
            elif "text" in response_body:
                content = response_body.get("text", "")
            elif "outputs" in response_body and isinstance(response_body["outputs"], list) and len(response_body["outputs"]) > 0:
                first_output = response_body.get("outputs", [])[0]
                if isinstance(first_output, dict) and "text" in first_output:
                    content = first_output.get("text", "")
                else:
                    content = str(first_output)
            elif "completion" in response_body:
                content = response_body.get("completion", "")
            elif isinstance(response_body, str):
                content = response_body
            else:
                # If we can't find a known pattern, try to extract content using common keys
                possible_keys = ["response", "answer", "result", "output", "message"]
                for key in possible_keys:
                    if key in response_body:
                        if isinstance(response_body[key], str):
                            content = response_body[key]
                            break
                        elif isinstance(response_body[key], dict) and "text" in response_body[key]:
                            content = response_body[key]["text"]
                            break
                        elif isinstance(response_body[key], list) and len(response_body[key]) > 0:
                            if isinstance(response_body[key][0], dict) and "text" in response_body[key][0]:
                                content = response_body[key][0]["text"]
                                break
                            elif isinstance(response_body[key][0], str):
                                content = response_body[key][0]
                                break
            
            # If content is still empty, use the stringified full response as a last resort
            if not content:
                llm_logger.debug("Content extraction failed, using full response")
                content = str(response_body)

            # Standardize the output
            sanitized_content = self.standardize_output(content, provider_name)
            llm_logger.debug(f"Final sanitized content length: {len(sanitized_content)}")
            
            # If we have an output model configuration, use it to refine the output
            if component_config and 'outputModel' in component_config:
                try:
                    llm_logger.debug(f"Found outputModel configuration: {component_config['outputModel']}")
                    refined_content = self._refine_with_output_model(sanitized_content, component_config['outputModel'])
                    llm_logger.debug(f"Refined content length: {len(refined_content)}")
                    # Set refinement flag in metadata
                    metadata["refinement_performed"] = True
                    return refined_content, metadata
                except Exception as e:
                    llm_logger.error(f"Error in output model refinement: {str(e)}")
                    llm_logger.debug("Returning original content due to refinement error")
                    # Return original content if refinement fails
                    return sanitized_content, metadata
            
            return sanitized_content, metadata
        
        except Exception as e:
            import traceback
            llm_logger.error(f"Exception in process_model_response: {str(e)}")
            llm_logger.error(traceback.format_exc())
            raise ValueError(f"Error processing model response: {str(e)}")

    def _refine_with_output_model(self, content, output_model_config):
        """
        Refine the content using the specified output model
        
        Args:
            content (str): The content to refine
            output_model_config (dict): The output model configuration containing model, instruction, and outputFormat
            
        Returns:
            str: The refined content
        """
        try:
            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] Starting output model refinement with config: {json.dumps(output_model_config)}")
            else:
                llm_logger.info(f"Starting output model refinement with config: {json.dumps(output_model_config)}")
            
            # Get the model and instruction from the config
            model_key = output_model_config.get('model')
            instruction_key = output_model_config.get('instruction')
            
            if not model_key or not instruction_key:
                if self.current_request_id:
                    llm_logger.error(f"[{self.current_request_id}] Missing model_key or instruction_key in output_model_config")
                else:
                    llm_logger.error(f"Missing model_key or instruction_key in output_model_config")
                return content
            
            # Get the instruction from the config
            instruction = None
            if 'llm' in self.config and 'instructions' in self.config['llm'] and instruction_key in self.config['llm']['instructions']:
                instruction = self.config['llm']['instructions'][instruction_key]
            
            if not instruction:
                if self.current_request_id:
                    llm_logger.error(f"[{self.current_request_id}] Instruction '{instruction_key}' not found in configuration")
                else:
                    llm_logger.error(f"Instruction '{instruction_key}' not found in configuration")
                return content
            
            output_format = output_model_config.get('outputFormat', 'plain')
            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] OUTPUT MODEL: Using model={model_key}, instruction={instruction_key}, format={output_format}")
            else:
                llm_logger.info(f"OUTPUT MODEL: Using model={model_key}, instruction={instruction_key}, format={output_format}")

            # Add output format to the instruction context
            instruction_with_format = dict(instruction)  # Create a copy to avoid modifying the original
            instruction_with_format['output_format'] = output_format

            # Log the instruction with format
            instruction_str = json.dumps(instruction_with_format, indent=2)
            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] OUTPUT MODEL INSTRUCTION:\n{instruction_str}")
            else:
                llm_logger.info(f"OUTPUT MODEL INSTRUCTION:\n{instruction_str}")

            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] Calling invoke_model with model_key={model_key} for output refinement")
            else:
                llm_logger.info(f"Calling invoke_model with model_key={model_key} for output refinement")
            
            # Save current component config to prevent recursive refinement
            original_component_config = None
            for component in self.config['llm'].get('componentModelMapping', {}).values():
                if component.get('outputModel', {}).get('model') == model_key:
                    original_component_config = component
                    break
            
            # Create a temporary config without output model to avoid recursive refinement
            temp_component_config = None
            if original_component_config:
                temp_component_config = dict(original_component_config)
                if 'outputModel' in temp_component_config:
                    del temp_component_config['outputModel']
                
            # Invoke the output model with the temporary config to prevent recursive refinement
            config_body, model_id = self.prepare_request_payload(model_key, instruction_with_format, content)
            profile_arn = self.get_model_profile_arn(model_id)
            body = json.dumps(config_body)
            
            # Make direct API call rather than using invoke_model to prevent recursion
            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] Direct API call to {model_id} for output refinement (preventing recursion)")
            else:
                llm_logger.info(f"Direct API call to {model_id} for output refinement (preventing recursion)")
            
            # Log the request payload with prettier formatting
            config_str = json.dumps(config_body, indent=2)
            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] REQUEST PAYLOAD for {model_id}:\n{config_str}")
            else:
                llm_logger.info(f"REQUEST PAYLOAD for {model_id}:\n{config_str}")
            
            # Call the API directly
            response = self.client.invoke_model(
                modelId=profile_arn,
                body=body
            )
            
            # Process the response
            if response and hasattr(response, 'get') and response.get('body'):
                response_body_raw = response.get('body').read()
                if response_body_raw:
                    try:
                        response_body = json.loads(response_body_raw)
                        
                        # Log the response payload with prettier formatting
                        response_str = json.dumps(response_body, indent=2)
                        if self.current_request_id:
                            llm_logger.info(f"[{self.current_request_id}] RESPONSE PAYLOAD from {model_id}:\n{response_str}")
                        else:
                            llm_logger.info(f"RESPONSE PAYLOAD from {model_id}:\n{response_str}")
                        
                        # Extract content directly to avoid recursive process_model_response call
                        refined_content = ""
                        
                        # Extract provider from model ID
                        provider_name = model_id.split('.')[0] if '.' in model_id else ""
                        
                        # Extract content based on response structure and provider
                        if 'anthropic' in model_id.lower():
                            if "content" in response_body and isinstance(response_body["content"], list) and len(response_body["content"]) > 0:
                                # Claude-3 response format
                                first_content = response_body.get("content", [])[0]
                                if isinstance(first_content, dict) and "text" in first_content:
                                    refined_content = first_content.get("text", "")
                            elif "completion" in response_body:
                                # Claude-2 response format
                                refined_content = response_body.get("completion", "")
                        elif 'meta.llama' in model_id.lower():
                            if "generation" in response_body:
                                refined_content = response_body.get("generation", "")
                            elif "text" in response_body:
                                refined_content = response_body.get("text", "")
                        elif "text" in response_body:
                            refined_content = response_body.get("text", "")
                        elif "completion" in response_body:
                            refined_content = response_body.get("completion", "")
                        else:
                            # If we can't find a known pattern, try to extract content using common keys
                            possible_keys = ["response", "answer", "result", "output", "message", "content"]
                            for key in possible_keys:
                                if key in response_body:
                                    if isinstance(response_body[key], str):
                                        refined_content = response_body[key]
                                        break
                                    elif isinstance(response_body[key], dict) and "text" in response_body[key]:
                                        refined_content = response_body[key]["text"]
                                        break
                                    elif isinstance(response_body[key], list) and len(response_body[key]) > 0:
                                        if isinstance(response_body[key][0], dict) and "text" in response_body[key][0]:
                                            refined_content = response_body[key][0]["text"]
                                            break
                                        elif isinstance(response_body[key][0], str):
                                            refined_content = response_body[key][0]
                                            break
                        
                        # If still empty, use stringified response as last resort
                        if not refined_content:
                            refined_content = str(response_body)
                        
                        # Standardize output
                        refined_content = self.standardize_output(refined_content, provider_name)
                        
                        # Extract the final answer part from the response
                        final_answer = self.extract_final_answer(refined_content)
                        
                        if self.current_request_id:
                            llm_logger.info(f"[{self.current_request_id}] Output model refinement completed successfully. Content length: {len(final_answer)}")
                        else:
                            llm_logger.info(f"Output model refinement completed successfully. Content length: {len(final_answer)}")
                            
                        return final_answer
                    except json.JSONDecodeError as e:
                        llm_logger.error(f"Error parsing output model response: {str(e)}")
                        return content
            
            # If we couldn't process the response, return the original content
            return content

        except Exception as e:
            if self.current_request_id:
                llm_logger.error(f"[{self.current_request_id}] ERROR in _refine_with_output_model: {str(e)}")
            else:
                llm_logger.error(f"ERROR in _refine_with_output_model: {str(e)}")
                
            import traceback
            llm_logger.error(traceback.format_exc())
            # If refinement fails, return the original content
            return content

    def extract_final_answer(self, content):
        """
        Extract the final answer from a model's response, removing any chain-of-thought reasoning.
        
        Args:
            content (str): The content to extract the final answer from
            
        Returns:
            str: The extracted final answer
        """
        if not content:
            return ""
        
        # Look for the final answer marker
        final_answer_markers = [
            "The final answer is:", 
            "The final answer is :", 
            "Final answer:", 
            "Final answer :"
        ]
        
        # Try each marker
        for marker in final_answer_markers:
            if marker.lower() in content.lower():
                # Find the marker position (case insensitive)
                start_pos = content.lower().find(marker.lower())
                # Get the text after the marker
                answer_text = content[start_pos + len(marker):].strip()
                
                # Remove any trailing [/INST] tag
                if "[/INST]" in answer_text:
                    answer_text = answer_text.split("[/INST]")[0].strip()
                
                # Log the extraction
                if self.current_request_id:
                    llm_logger.info(f"[{self.current_request_id}] Extracted final answer using marker: '{marker}'")
                else:
                    llm_logger.info(f"Extracted final answer using marker: '{marker}'")
                
                return answer_text
        
        # If no marker is found, check for pipe-delimited format (common for outputModel columns)
        pipe_lines = []
        for line in content.split('\n'):
            # Keep only lines that have the pipe delimiter for column format
            if '|' in line and not line.strip().startswith('#') and not line.strip().startswith('//'):
                pipe_lines.append(line.strip())
        
        # If we found pipe-delimited lines, return just those
        if pipe_lines:
            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] Extracted pipe-delimited answer with {len(pipe_lines)} lines")
            else:
                llm_logger.info(f"Extracted pipe-delimited answer with {len(pipe_lines)} lines")
            
            return '\n'.join(pipe_lines)
        
        # If no structured format found, return the original content
        if self.current_request_id:
            llm_logger.info(f"[{self.current_request_id}] No structured format found, returning full content")
        else:
            llm_logger.info(f"No structured format found, returning full content")
        
        return content

    def standardize_output(self, content, provider_name):
        """Standardize the output from different LLM providers"""
        if not content:
            return ""
            
        # Remove provider-specific formatting
        if provider_name.lower() == "anthropic":
            # Clean up Claude-specific formatting
            # Remove XML tags, markdown code blocks, etc.
            content = re.sub(r'<[^>]+>', '', content)
        elif provider_name.lower() == "meta":
            # Clean up Llama-specific formatting
            pass  # Add specific cleanup for Llama if needed
        elif provider_name.lower() == "mistral":
            # Clean up Mistral-specific formatting
            pass  # Add specific cleanup for Mistral if needed
            
        # General cleanup for all providers
        # Trim extra whitespace
        content = content.strip()
        
        return content
        
    def get_model_profile_arn(self, model_id):
        """
        Generate the inference profile ARN for a model ID
        
        Args:
            model_id (str): The model ID
            
        Returns:
            str: The inference profile ARN
        """
        # Get the inference profile ARN from environment variable
        inference_arn = os.getenv('AWS_BEDROCK_INFERENCE_ARN', '')
        if not inference_arn:
            raise ValueError("AWS_BEDROCK_INFERENCE_ARN not configured")
            
        # Format the model ID for the ARN
        # For AWS Bedrock, model IDs in ARNs should be in the format: us.anthropic.claude-3-sonnet-20240229-v1:0
        if ':' in model_id:
            base_id, version = model_id.split(':')
            if '.' in base_id:
                provider, model_name = base_id.split('.', 1)
                if not model_id.startswith('us.'):
                    formatted_model_id = f"us.{provider}.{model_name}:{version}"
                else:
                    formatted_model_id = model_id
            else:
                # If no provider in the ID
                formatted_model_id = f"us.{model_id}"
        else:
            # If no version in the ID
            if '.' in model_id:
                provider, model_name = model_id.split('.', 1)
                if not model_id.startswith('us.'):
                    formatted_model_id = f"us.{provider}.{model_name}"
                else:
                    formatted_model_id = model_id
            else:
                formatted_model_id = f"us.{model_id}"
            
        # Return the full inference profile ARN
        return f"{inference_arn}/{formatted_model_id}"
        
    def invoke_model(self, model_key, instruction, user_text):
        """
        Invoke the model with the given instruction and user text
        
        Args:
            model_key (str): The model key in the config
            instruction (dict): The instruction to use for the request
            user_text (str): The user's input text
            
        Returns:
            str: The model's response content
            dict: Additional metadata about the request/response
        """
        try:
            # Prepare the request payload
            config_body, model_id = self.prepare_request_payload(model_key, instruction, user_text)
            
            # Get the inference profile ARN
            profile_arn = self.get_model_profile_arn(model_id)
            
            # Serialize to JSON string for the API request
            body = json.dumps(config_body)
            
            # Log the request payload with prettier formatting
            config_str = json.dumps(config_body, indent=2)
            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] REQUEST PAYLOAD for {model_id}:\n{config_str}")
            else:
                llm_logger.info(f"REQUEST PAYLOAD for {model_id}:\n{config_str}")
            
            # Call the Bedrock API
            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] Invoking AWS Bedrock model: {model_id} with profile: {profile_arn}")
            else:
                llm_logger.info(f"Invoking AWS Bedrock model: {model_id} with profile: {profile_arn}")
                
            response = self.client.invoke_model(
                modelId=profile_arn,
                body=body
            )
            
            # Get the component configuration if this is a known component
            component_config = None
            for component in self.config['llm'].get('componentModelMapping', {}).values():
                # Check both modelInstructions and outputModel for the current model_key
                is_instruction_model = any(mi.get('model') == model_key for mi in component.get('modelInstructions', []))
                is_output_model = component.get('outputModel', {}).get('model') == model_key
                
                if is_instruction_model or is_output_model:
                    component_config = component
                    break
            
            # Process the response with component configuration
            if self.current_request_id:
                llm_logger.info(f"[{self.current_request_id}] Processing response from model: {model_id}")
            else:
                llm_logger.info(f"Processing response from model: {model_id}")
                
            content, metadata = self.process_model_response(model_id, response, component_config)
            
            # Log the response payload with prettier formatting
            if hasattr(response, 'get') and response.get('body'):
                try:
                    response_body_raw = response.get('body').read()
                    if response_body_raw:
                        response_body = json.loads(response_body_raw)
                        response_str = json.dumps(response_body, indent=2)
                        if self.current_request_id:
                            llm_logger.info(f"[{self.current_request_id}] RESPONSE PAYLOAD from {model_id}:\n{response_str}")
                        else:
                            llm_logger.info(f"RESPONSE PAYLOAD from {model_id}:\n{response_str}")
                except Exception as e:
                    llm_logger.error(f"Error logging response payload: {str(e)}")
            
            # Also log refinement status if refinement was performed
            if metadata.get('refinement_performed', False):
                if self.current_request_id:
                    llm_logger.info(f"[{self.current_request_id}] OUTPUT MODEL refinement was performed for {model_id}")
                else:
                    llm_logger.info(f"OUTPUT MODEL refinement was performed for {model_id}")
            
            # Return the content and metadata
            return content, {
                "model_id": model_id,
                "model_key": model_key,
                "refinement_performed": metadata.get('refinement_performed', False)
            }
            
        except Exception as e:
            if self.current_request_id:
                llm_logger.error(f"[{self.current_request_id}] Error invoking model {model_key}: {str(e)}")
            else:
                llm_logger.error(f"Error invoking model {model_key}: {str(e)}")
            raise ValueError(f"Error invoking model: {str(e)}")

# Load environment variables from .env file in the project root
env_path = project_root / 'global' / '.env'
load_dotenv(env_path)

def load_config():
    """Load the models configuration from global/config.json"""
    try:
        config_path = project_root / 'global' / 'config.json'
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Support both old structure (modelIds) and new structure (models)
        if 'llm' in config:
            if 'models' in config['llm']:
                return config
            elif 'modelIds' in config['llm']:
                return config
            else:
                llm_logger.warning("Config loaded but 'models' or 'modelIds' not found under 'llm'")
                return {}
        else:
            llm_logger.warning("Config loaded but 'llm' section not found")
            return {}
    except Exception as e:
        llm_logger.error(f"Error loading config.json: {e}")
        return {}

def generate_inference_profiles(model_keys):
    """Generate inference profiles for each model ID using the base ARN from .env"""
    inference_profiles = {}
    
    # Get the base ARN from environment variable
    base_arn = os.getenv('AWS_BEDROCK_INFERENCE_ARN', '').strip('"\'')
    
    if not base_arn:
        return {}
    
    # For each model key, create a corresponding inference profile ARN
    for model_key in model_keys:
        # Get the actual model ID from config
        model_id = get_model_id_from_key(model_key)
        if not model_id:
            continue
            
        # Convert model ID format to match what's expected in the ARN
        # Example: "anthropic.claude-3-7-sonnet-20250219-v1:0" -> "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
        formatted_model_id = model_id.replace('.', '-', 1).replace('-', '.', 1)
        if not formatted_model_id.startswith('us.'):
            formatted_model_id = 'us.' + model_id
        
        # Create the full inference profile ARN
        inference_arn = f"{base_arn}/{formatted_model_id}"
        
        # Add to inference profiles dictionary
        inference_profiles[model_key] = inference_arn
    
    return inference_profiles

def get_model_id_from_key(config, model_key):
    """Get the model ID from a model key in the config"""
    if 'llm' in config and 'models' in config['llm'] and model_key in config['llm']['models']:
        return config['llm']['models'][model_key]['modelId']
    return None

def get_model_config(config, model_key):
    """Get the full model configuration for a model key"""
    if 'llm' in config and 'models' in config['llm'] and model_key in config['llm']['models']:
        return config['llm']['models'][model_key]
    return None

def test_model_with_inference_profile(bedrock_runtime, model_id, profile_arn, config):
    """Test a specific model using its inference profile"""
    llm_logger.info(f"Testing model: {model_id}")
    llm_logger.info(f"Using inference profile: {profile_arn}")
    bedrock_service = BedrockService()
    
    try:
        # Get model configuration from config.json if available
        model_config = get_model_config(config, model_id)
        
        # Check if we have a request body in the config
        if model_config and 'APIRequest' in model_config and 'body' in model_config['APIRequest']:
            # Get the request body from config
            config_body = model_config['APIRequest']['body']
            
            # If the body is a string (JSON string), parse it
            if isinstance(config_body, str):
                try:
                    config_body = json.loads(config_body)
                except json.JSONDecodeError:
                    llm_logger.warning(f"Could not parse body JSON from config for {model_id}")
            
            llm_logger.info(f"Using request body from config.json for {model_id}")
            
            # Modify the payload to use a simple test prompt
            if "anthropic.claude" in model_id:
                # Modify Claude payload
                if 'messages' in config_body:
                    config_body['messages'] = [
                        {"role": "user", "content": "Hello! How are you today? Please reply with a brief greeting."}
                    ]
                # Limit tokens for testing
                if 'max_tokens' in config_body:
                    config_body['max_tokens'] = min(config_body['max_tokens'], 50)
                
            elif "meta.llama" in model_id or "mistral" in model_id:
                # Modify Llama/Mistral payload
                if 'prompt' in config_body:
                    config_body['prompt'] = "Hello! How are you today? Please reply with a brief greeting."
                # Limit tokens for testing
                if 'max_gen_len' in config_body:
                    config_body['max_gen_len'] = min(config_body['max_gen_len'], 50)
                if 'max_tokens' in config_body:
                    config_body['max_tokens'] = min(config_body['max_tokens'], 50)
            
            # Serialize to JSON string for the API request
            body = json.dumps(config_body)
            
        else:
            # If no config available, use fallback defaults based on model type
            llm_logger.info(f"No config found for {model_id}, using default payload structure")
            
            if "anthropic.claude" in model_id:
                # Claude models use this format
                body = json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 50,
                    "temperature": 0.7,
                    "messages": [
                        {"role": "user", "content": "Hello! How are you today? Please reply with a brief greeting."}
                    ]
                })
            elif "meta.llama" in model_id:
                # Meta/Llama models use this format
                body = json.dumps({
                    "prompt": "Hello! How are you today? Please reply with a brief greeting.",
                    "max_gen_len": 50,
                    "temperature": 0.7,
                    "top_p": 0.9,
                })
            elif "mistral" in model_id:
                # Mistral models use this format
                body = json.dumps({
                    "prompt": "Hello! How are you today? Please reply with a brief greeting.",
                    "max_tokens": 50,
                    "temperature": 0.7,
                    "top_p": 0.9,
                })
            else:
                # Generic format for other models
                body = json.dumps({
                    "prompt": "Hello! How are you today? Please reply with a brief greeting.",
                    "max_tokens": 50,
                    "temperature": 0.7,
                })
        
        # Call the Bedrock API with the inference profile ARN
        response = bedrock_runtime.invoke_model(
            modelId=profile_arn,  # Use the profile ARN
            body=body
        )
        
        # Parse the response based on the model type
        response_body = json.loads(response.get('body').read())
        
        # Extract raw content based on model type
        if "anthropic.claude" in model_id and "claude-3" in model_id:
            content = response_body.get("content", [{"text": ""}])[0]["text"]
        elif "meta.llama" in model_id:
            content = response_body.get("generation", "")
        elif "mistral" in model_id:
            content = response_body.get("outputs", [{"text": ""}])[0].get("text", "")
        elif "completion" in response_body:
            content = response_body.get("completion", "")
        else:
            content = str(response_body)
        
        llm_logger.info("Test successful!")
        llm_logger.info(f"Raw response: {content[:100]}...")
        
        # Get provider name from model ID
        provider_name = model_id.split('.')[0] if '.' in model_id else ""
        
        # Sanitize output using the standardize_output function
        sanitized_content = bedrock_service.standardize_output(content, provider_name)
        
        llm_logger.info(f"Sanitized response: {sanitized_content[:100]}...")
        llm_logger.info(f"Sanitization {'changed the output' if content != sanitized_content else 'did not change the output'}")
        
        return True
        
    except Exception as e:
        llm_logger.error(f"Error testing model: {str(e)}")
        return False

def test_aws_connection():
    """Test AWS connection and verify models from config.json"""
    try:
        # Configure the AWS SDK
        config = Config(
            region_name=os.getenv('AWS_REGION', 'us-east-1'),
            retries=dict(max_attempts=3),
            connect_timeout=5,
            read_timeout=60
        )

        # First, test basic AWS connectivity using STS
        llm_logger.info("Testing AWS connectivity...")
        access_key = os.getenv('AWS_BEDROCK_ACCESS_KEY_ID', '')
        llm_logger.info(f"Using Access Key ID: {access_key[:5]}..." if access_key else "AWS_BEDROCK_ACCESS_KEY_ID not found")
        llm_logger.info(f"Region: {os.getenv('AWS_BEDROCK_REGION', 'Not configured')}")
        
        session = boto3.Session(
            aws_access_key_id=os.getenv('AWS_BEDROCK_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_BEDROCK_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_BEDROCK_REGION', 'us-east-1')
        )

        try:
            sts = session.client('sts', config=config)
            identity = sts.get_caller_identity()
            llm_logger.info("Successfully connected to AWS!")
            llm_logger.info(f"Account ID: {identity['Account']}")
            llm_logger.info(f"User ARN: {identity['Arn']}")
        except Exception as e:
            llm_logger.error(f"AWS connectivity test failed: {str(e)}")
            return
        
        # Test Bedrock runtime connection
        llm_logger.info("Testing Bedrock runtime connection...")
        try:
            bedrock_runtime = session.client('bedrock-runtime', config=config)
            llm_logger.info("Successfully connected to Bedrock runtime!")
        except Exception as e:
            llm_logger.error(f"Bedrock runtime connection failed: {str(e)}")
            return
        
        # Load configuration from config.json
        config_data = load_config()
        
        # Check for models in the new structure
        if 'llm' in config_data and 'models' in config_data['llm']:
            model_keys = list(config_data['llm']['models'].keys())
            model_structure = "new"
            llm_logger.info("Using new config structure with 'models'")
        # Check for models in the old structure
        elif 'llm' in config_data and 'modelIds' in config_data['llm']:
            model_keys = list(config_data['llm']['modelIds'].keys())
            model_structure = "old"
            llm_logger.info("Using old config structure with 'modelIds'")
        else:
            llm_logger.warning("No model definitions found in config.json. Exiting.")
            return
            
        if not model_keys:
            llm_logger.warning("No models found in config.json. Exiting.")
            return
            
        # Display models found
        llm_logger.info(f"Found {len(model_keys)} models in config.json:")
        for model_key in model_keys:
            model_id = get_model_id_from_key(config_data, model_key)
            llm_logger.info(f"- {model_key}: {model_id}")
            
        # Generate inference profiles for each model
        llm_logger.info("Generating inference profiles for models...")
        inference_profiles = generate_inference_profiles(model_keys)
        
        if not inference_profiles:
            llm_logger.warning("No inference profiles could be generated. Please set AWS_BEDROCK_INFERENCE_ARN in your .env file.")
            return
            
        llm_logger.info(f"Generated {len(inference_profiles)} inference profiles")
        
        # Test each model with its inference profile
        llm_logger.info(f"Testing model connectivity...")
        
        for model_key, profile_arn in inference_profiles.items():
            model_id = get_model_id_from_key(config_data, model_key)
            try:
                test_model_with_inference_profile(bedrock_runtime, model_key, profile_arn, config_data)
                llm_logger.info(f"- {model_key}: {model_id} : Connected Successfully")
            except Exception as e:
                llm_logger.error(f"- {model_key}: {model_id} : Connection Failed ({str(e)[:100]}...)")
                
    except Exception as e:
        llm_logger.error(f"Error during AWS connection test: {str(e)}")

if __name__ == "__main__":
    test_aws_connection() 