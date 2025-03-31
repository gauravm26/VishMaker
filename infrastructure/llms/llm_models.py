import boto3
import os
import json
import re
import sys
from pathlib import Path
from dotenv import load_dotenv
from botocore.config import Config

# Add the project root to sys.path to enable imports from app-core
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# BedrockService implementation - integrated directly
class BedrockService:
    """Service class for AWS Bedrock operations"""
    
    def __init__(self):
        """Initialize the BedrockService"""
        self.session = None
        self.client = None
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
                print("WARNING: AWS Bedrock credentials not found in environment variables")
                print("Please set AWS_BEDROCK_ACCESS_KEY_ID and AWS_BEDROCK_SECRET_ACCESS_KEY")
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
                print(f"AWS Bedrock client initialized successfully in region {aws_region}")
                return True
            except Exception as e:
                print(f"AWS access test failed: {str(e)}")
                return False
                
        except Exception as e:
            print(f"Error setting up Bedrock client: {str(e)}")
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
                raise ValueError("Invalid configuration structure")
                
            # Get model configuration
            if model_key not in self.config['llm']['models']:
                raise ValueError(f"Model key '{model_key}' not found in configuration")
                
            model_config = self.config['llm']['models'][model_key]
            
            if 'modelId' not in model_config or 'body' not in model_config:
                raise ValueError(f"Invalid model configuration for model '{model_key}'. Required fields: modelId, body")
                
            model_id = model_config['modelId']
            
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
            
            return config_body, model_id
            
        except Exception as e:
            raise ValueError(f"Error preparing request payload: {str(e)}")
    
    def _format_instruction(self, instruction):
        """Format instruction data into a readable string"""
        if not instruction:
            return ""
            
        if isinstance(instruction, dict):
            formatted = ""
            # Format instruction fields
            if "Role" in instruction:
                formatted += f"{instruction['Role']}\n\n"
            if "Objective" in instruction:
                formatted += f"Objective: {instruction['Objective']}\n\n"
            
            # Handle different naming conventions for constraints
            constraints_key = next((k for k in ["Constraints & Guidelines", "ConstraintsAndGuidelines"] 
                                   if k in instruction), None)
            
            if constraints_key and isinstance(instruction[constraints_key], dict):
                formatted += "Constraints & Guidelines:\n"
                for key, value in instruction[constraints_key].items():
                    # Handle nested dictionaries
                    if isinstance(value, dict):
                        formatted += f"- {key}:\n"
                        for subkey, subvalue in value.items():
                            formatted += f"  - {subkey}: {subvalue}\n"
                    else:
                        formatted += f"- {key}: {value}\n"
            
            # Include examples if present but don't overwhelm with details
            if "Examples" in instruction and instruction["Examples"]:
                formatted += f"\nExamples are available in the configuration."
                
            return formatted
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
            dict: The full response body
        """
        try:
            # If we have a pre-parsed response body, use it
            if response_body:
                # Use the pre-parsed body
                pass
            # Otherwise read from response
            elif response and hasattr(response, 'get') and response.get('body'):
                # Read the response body
                response_body_raw = response.get('body').read()
                
                # Check if the response body is empty
                if not response_body_raw:
                    print("DEBUG: Response body is empty")
                    raise ValueError("Empty response body received from AWS Bedrock")
                    
                # Try to parse the response body as JSON
                try:
                    response_body = json.loads(response_body_raw)
                    # Log the response type and keys for debugging
                    print(f"DEBUG: Response body type: {type(response_body)}, keys: {response_body.keys() if isinstance(response_body, dict) else 'Not a dict'}")
                except json.JSONDecodeError as e:
                    # Log the raw response for debugging
                    print(f"Failed to parse response as JSON: {str(e)}")
                    print(f"Raw response: {response_body_raw[:1000]}")  # Print first 1000 chars
                    raise ValueError(f"Invalid JSON response from AWS Bedrock: {str(e)}")
            else:
                print("DEBUG: Response is None or does not have 'body' attribute")
                raise ValueError("Empty response received from AWS Bedrock")
            
            # Extract provider from model ID
            provider_name = model_id.split('.')[0] if '.' in model_id else ""
            print(f"DEBUG: Processing response from provider: {provider_name}")
            
            # Extract content based on response structure
            content = ""
            
            # Log response structure for debugging
            print(f"DEBUG: Response structure: {json.dumps(response_body)[:500]} ...")
            
            # Try common response formats based on observed structure
            if "content" in response_body and isinstance(response_body["content"], list) and len(response_body["content"]) > 0:
                # Anthropic Claude-3 format
                print("DEBUG: Using Claude-3 format extraction")
                first_content = response_body.get("content", [])[0]
                if isinstance(first_content, dict) and "text" in first_content:
                    content = first_content.get("text", "")
                    print(f"DEBUG: Extracted content length: {len(content)}")
                else:
                    print(f"DEBUG: First content item structure: {type(first_content)}")
            elif "generation" in response_body:
                # Meta Llama format
                content = response_body.get("generation", "")
            elif "text" in response_body:
                # Some Llama models might return this format
                content = response_body.get("text", "")
            elif "outputs" in response_body and isinstance(response_body["outputs"], list):
                # Mistral format
                content = response_body.get("outputs", [{"text": ""}])[0].get("text", "")
            elif "completion" in response_body:
                # OpenAI/older Claude format
                content = response_body.get("completion", "")
            elif isinstance(response_body, str):
                # Sometimes the response is directly a string
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
                
                # If we still don't have content, fallback to string representation
                if not content:
                    content = str(response_body)
            
            # Standardize the output
            sanitized_content = self.standardize_output(content, provider_name)
            print(f"DEBUG: Sanitized content length: {len(sanitized_content)}")

            # If content is empty, try the raw response body as a last resort
            if not sanitized_content.strip():
                print("DEBUG: Content is empty after extraction and sanitization, using raw response")
                sanitized_content = str(response_body)

            # If we have an output model configuration, use it to refine the output
            if component_config and 'outputModel' in component_config:
                refined_content = self._refine_with_output_model(sanitized_content, component_config['outputModel'])
                return refined_content, response_body
            
            return sanitized_content, response_body
        
        except Exception as e:
            print(f"DEBUG: Error in process_model_response: {str(e)}")
            import traceback
            traceback.print_exc()
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
            # Get the model and instruction from the config
            model_key = output_model_config['model']
            instruction = self.config['llm']['instructions'][output_model_config['instruction']]
            output_format = output_model_config.get('outputFormat', 'plain')

            # Add output format to the instruction context
            instruction_with_format = {
                **instruction,
                'output_format': output_format  # This will be used by instruction4 to format the output
            }

            # Invoke the output model
            refined_content, _ = self.invoke_model(
                model_key,
                instruction_with_format,
                content  # Pass the original content as user text
            )

            return refined_content

        except Exception as e:
            print(f"Warning: Output refinement failed: {str(e)}")
            # If refinement fails, return the original content
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
            
            # Call the Bedrock API
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
            content, response_body = self.process_model_response(model_id, response, component_config)
            
            # Return the content and metadata
            return content, {
                "model_id": model_id,
                "model_key": model_key,
                "response": response_body
            }
            
        except Exception as e:
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
                return {}
        else:
            return {}
    except Exception as e:
        print(f"Error loading config.json: {e}")
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
    print(f"\n----- Testing model: {model_id} -----")
    print(f"Using inference profile: {profile_arn}")
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
                    print(f"Warning: Could not parse body JSON from config for {model_id}")
            
            print(f"Using request body from config.json for {model_id}")
            
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
            print(f"No config found for {model_id}, using default payload structure")
            
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
        
        print("\n✅ Test successful!")
        print(f"Raw response: {content[:100]}...")
        
        # Get provider name from model ID
        provider_name = model_id.split('.')[0] if '.' in model_id else ""
        
        # Sanitize output using the standardize_output function
        sanitized_content = bedrock_service.standardize_output(content, provider_name)
        
        print(f"\nSanitized response: {sanitized_content[:100]}...")
        print(f"Sanitization {'changed the output' if content != sanitized_content else 'did not change the output'}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error testing model: {str(e)}")
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
        print("\nTesting AWS connectivity...")
        access_key = os.getenv('AWS_BEDROCK_ACCESS_KEY_ID', '')
        print(f"Using Access Key ID: {access_key[:5]}..." if access_key else "AWS_BEDROCK_ACCESS_KEY_ID not found")
        print(f"Region: {os.getenv('AWS_BEDROCK_REGION', 'Not configured')}")
        
        session = boto3.Session(
            aws_access_key_id=os.getenv('AWS_BEDROCK_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_BEDROCK_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_BEDROCK_REGION', 'us-east-1')
        )

        try:
            sts = session.client('sts', config=config)
            identity = sts.get_caller_identity()
            print("Successfully connected to AWS!")
            print(f"Account ID: {identity['Account']}")
            print(f"User ARN: {identity['Arn']}")
        except Exception as e:
            print(f"AWS connectivity test failed: {str(e)}")
            return
        
        # Test Bedrock runtime connection
        print("\nTesting Bedrock runtime connection...")
        try:
            bedrock_runtime = session.client('bedrock-runtime', config=config)
            print("Successfully connected to Bedrock runtime!")
        except Exception as e:
            print(f"Bedrock runtime connection failed: {str(e)}")
            return
        
        # Load configuration from config.json
        config_data = load_config()
        
        # Check for models in the new structure
        if 'llm' in config_data and 'models' in config_data['llm']:
            model_keys = list(config_data['llm']['models'].keys())
            model_structure = "new"
            print("\nUsing new config structure with 'models'")
        # Check for models in the old structure
        elif 'llm' in config_data and 'modelIds' in config_data['llm']:
            model_keys = list(config_data['llm']['modelIds'].keys())
            model_structure = "old"
            print("\nUsing old config structure with 'modelIds'")
        else:
            print("No model definitions found in config.json. Exiting.")
            return
            
        if not model_keys:
            print("No models found in config.json. Exiting.")
            return
            
        # Display models found
        print(f"\nFound {len(model_keys)} models in config.json:")
        for model_key in model_keys:
            model_id = get_model_id_from_key(config_data, model_key)
            print(f"- {model_key}: {model_id}")
            
        # Generate inference profiles for each model
        print("\nGenerating inference profiles for models...")
        inference_profiles = generate_inference_profiles(model_keys)
        
        if not inference_profiles:
            print("No inference profiles could be generated. Please set AWS_BEDROCK_INFERENCE_ARN in your .env file.")
            return
            
        print(f"Generated {len(inference_profiles)} inference profiles")
        
        # Test each model with its inference profile
        print(f"\nTesting model connectivity...")
        
        for model_key, profile_arn in inference_profiles.items():
            model_id = get_model_id_from_key(config_data, model_key)
            try:
                test_model_with_inference_profile(bedrock_runtime, model_key, profile_arn, config_data)
                print(f"- {model_key}: {model_id} : Connected Successfully")
            except Exception as e:
                print(f"- {model_key}: {model_id} : Connection Failed ({str(e)[:100]}...)")
                
    except Exception as e:
        print(f"Error during AWS connection test: {str(e)}")

if __name__ == "__main__":
    test_aws_connection() 