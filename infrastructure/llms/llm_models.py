import boto3
import os
import json
import re
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
from botocore.config import Config

# --- Project Setup & Logging Configuration ---
# Add the project root to sys.path
project_root = Path(__file__).resolve().parent.parent.parent # Adjust if needed
sys.path.append(str(project_root))

# Ensure logs directory exists
logs_dir = project_root / 'logs'
logs_dir.mkdir(parents=True, exist_ok=True)

# Configure logging for LLM interactions
log_path = logs_dir / 'llm_interactions.log'
print(f"Logging LLM interactions to: {log_path}")

llm_logger = logging.getLogger('llm_interactions')
llm_logger.setLevel(logging.INFO)

# Clear existing handlers to avoid duplicates if re-run
for handler in llm_logger.handlers[:]:
    llm_logger.removeHandler(handler)

# Add file handler
file_handler = logging.FileHandler(log_path, mode='a')
file_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
file_handler.setLevel(logging.INFO)
llm_logger.addHandler(file_handler)

# Add console handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
console_handler.setLevel(logging.INFO)
llm_logger.addHandler(console_handler)

# Force logger to not use parent handlers
llm_logger.propagate = False

llm_logger.info("--- LLM Service Script Start ---")
llm_logger.info("LLM logging initialized")

# --- Configuration Loading ---
def load_app_config():
    """Load the application configuration from global/config.json"""
    try:
        config_path = project_root / 'global' / 'config.json'
        with open(config_path, 'r') as f:
            config = json.load(f)
        llm_logger.info(f"Successfully loaded configuration from {config_path}")

        # Basic validation
        if 'llm' not in config or 'models' not in config['llm']:
            llm_logger.warning("Config structure issue: 'llm' or 'llm.models' section missing.")
            # Allow proceeding but some features might fail
            config.setdefault('llm', {}).setdefault('models', {})
        return config
    except FileNotFoundError:
        llm_logger.error(f"Configuration file not found at {config_path}")
        return {'llm': {'models': {}}} # Return empty structure
    except json.JSONDecodeError as e:
        llm_logger.error(f"Error decoding JSON from config file {config_path}: {e}")
        return {'llm': {'models': {}}} # Return empty structure
    except Exception as e:
        llm_logger.error(f"Unexpected error loading config.json: {e}")
        return {'llm': {'models': {}}} # Return empty structure

# Create an alias for load_app_config as load_config for backward compatibility
load_config = load_app_config

# Load environment variables from .env file in the project root's 'global' subdir
env_path = project_root / 'global' / '.env'
if env_path.exists():
    load_dotenv(env_path)
    llm_logger.info(f"Loaded environment variables from {env_path}")
else:
    llm_logger.warning(f"Environment file (.env) not found at {env_path}. AWS credentials must be set via other means.")

# --- Bedrock LLM Service ---

class BedrockService:
    """
    Service class for interacting with AWS Bedrock LLMs.

    Provides methods to get model responses and test AWS connectivity.
    """

    def __init__(self, config=None):
        """Initialize the BedrockLLMService."""
        self.session = None
        self.client = None
        self.config = config if config else load_app_config() # Load config if not provided
        self.current_request_id = None # Optional: For tracking specific requests in logs

        if not self._setup_client():
             llm_logger.error("Bedrock client setup failed. Service may not function correctly.")
             # You might want to raise an exception here depending on requirements
             # raise ConnectionError("Failed to set up AWS Bedrock client.")

    def _setup_client(self):
        """Set up the AWS Bedrock client using environment variables."""
        try:
            aws_access_key = os.getenv('AWS_BEDROCK_ACCESS_KEY_ID')
            aws_secret_key = os.getenv('AWS_BEDROCK_SECRET_ACCESS_KEY')
            aws_region = os.getenv('AWS_BEDROCK_REGION', 'us-east-1') # Default region

            if not aws_access_key or not aws_secret_key:
                llm_logger.error("AWS Bedrock credentials (AWS_BEDROCK_ACCESS_KEY_ID, AWS_BEDROCK_SECRET_ACCESS_KEY) not found in environment variables.")
                return False

            self.session = boto3.Session(
                aws_access_key_id=aws_access_key,
                aws_secret_access_key=aws_secret_key,
                region_name=aws_region
            )

            # Use standard AWS SDK config for timeouts/retries
            sdk_config = Config(
                region_name=aws_region,
                retries=dict(max_attempts=3),
                connect_timeout=10, # Increased timeout
                read_timeout=120    # Increased timeout for potentially long LLM responses
            )

            self.client = self.session.client('bedrock-runtime', config=sdk_config)

            # Test basic connectivity via STS
            sts = self.session.client('sts', config=sdk_config)
            sts.get_caller_identity() # Raises exception on failure
            llm_logger.info(f"AWS Bedrock client initialized successfully in region {aws_region}")
            return True

        except Exception as e:
            llm_logger.error(f"Error setting up Bedrock client: {str(e)}", exc_info=True)
            self.client = None # Ensure client is None if setup fails
            return False

    # --- Public Methods ---

    def get_model_response(self, model_key, instruction=None, user_text=None, request_id=None, test_mode=False):
        """
        Main method to get a response from a specified Bedrock model.

        Orchestrates the 4 steps: Prepare Request, Invoke Model, Get Response, Standardize Output.

        Args:
            model_key (str): The key identifying the model in the config (e.g., 'claude-sonnet').
            instruction (dict, optional): The instruction dictionary for the model. Can be None when test_mode=True.
            user_text (str, optional): The user's input text. Can be None when test_mode=True.
            request_id (str, optional): An optional ID for tracking this request in logs.
            test_mode (bool, optional): If True, uses lightweight test request for model connectivity testing.

        Returns:
            tuple: A tuple containing:
                - str: The processed and standardized response content.
                - dict: Metadata about the response (e.g., model_id used, refinement status).
                   Returns None for content and error dict if an error occurs.
        """
        self.current_request_id = request_id
        log_prefix = f"[{self.current_request_id}] " if self.current_request_id else ""

        llm_logger.info(f"{log_prefix}Received request for model_key: {model_key}{' (test mode)' if test_mode else ''}")

        if not self.client:
            llm_logger.error(f"{log_prefix}Bedrock client is not initialized. Cannot invoke model.")
            return None, {"error": "Client not initialized", "model_key": model_key}

        # Default empty values if None is provided for Test Mode
        instruction = instruction or {"System: This is a test request. Execute it in demo mode."}
        user_text = user_text or  "Hello! Please reply with a short, simple greeting like 'Hi there!'."

          
        try:
          
            # 1. Prepare Request
            model_id = self._get_model_id(model_key)  # Get model_id in both cases
            
            # Use full request for normal operation
            llm_logger.info(f"{log_prefix}Step 1: Preparing request for {model_key}")
            model_id, request_body = self._prepare_request(model_key, instruction, user_text)
                
            llm_logger.debug(f"{log_prefix}Prepared request body: {json.dumps(request_body)}")


            # 2. Invoke Model
            llm_logger.info(f"{log_prefix}Step 2: Invoking model_id: {model_id}")
            api_response = self._invoke_model(model_id, request_body)

            # 3. Get Response (Process Raw API Response)
            llm_logger.info(f"{log_prefix}Step 3: Processing response from {model_id}")
            raw_content, metadata = self._process_response(model_id, api_response, model_key)
            llm_logger.debug(f"{log_prefix}Raw extracted content length: {len(raw_content)}")

            # 4. Standardize Output
            llm_logger.info(f"{log_prefix}Step 4: Standardizing output")
            provider_name = self._get_provider_name(model_id)
            standardized_content = self._standardize_output(raw_content, provider_name)
            llm_logger.debug(f"{log_prefix}Standardized content length: {len(standardized_content)}")


            llm_logger.info(f"{log_prefix}Successfully processed request for {model_key}")
            # Add model_key to metadata if not present
            if "model_key" not in metadata:
                metadata["model_key"] = model_key

            return standardized_content, metadata

        except ValueError as ve: # Catch specific config/prep errors
             llm_logger.error(f"{log_prefix}ValueError during processing for {model_key}: {ve}", exc_info=True)
             return None, {"error": str(ve), "model_key": model_key}
        except self.client.exceptions.ValidationException as ve:
             llm_logger.error(f"{log_prefix}AWS ValidationException for {model_key}: {ve}", exc_info=True)
             return None, {"error": f"AWS Validation Error: {ve}", "model_key": model_key}
        except self.client.exceptions.AccessDeniedException as ae:
             llm_logger.error(f"{log_prefix}AWS AccessDeniedException for {model_key}: {ae}", exc_info=True)
             return None, {"error": f"AWS Access Denied: {ae}", "model_key": model_key}
        except self.client.exceptions.ModelErrorException as me:
             llm_logger.error(f"{log_prefix}AWS ModelErrorException for {model_key}: {me}", exc_info=True)
             return None, {"error": f"AWS Model Error: {me}", "model_key": model_key}
        except self.client.exceptions.ThrottlingException as te:
             llm_logger.error(f"{log_prefix}AWS ThrottlingException for {model_key}: {te}", exc_info=True)
             return None, {"error": f"AWS Throttling: {te}", "model_key": model_key}
        except Exception as e:
            llm_logger.error(f"{log_prefix}Unexpected error getting model response for {model_key}: {e}", exc_info=True)
            return None, {"error": f"Unexpected error: {e}", "model_key": model_key}
        finally:
            self.current_request_id = None # Reset request ID

    
    # --- Internal Helper Methods ---

    def _get_model_config(self, model_key):
        """Get the full configuration dictionary for a given model key."""
        try:
            return self.config['llm']['models'][model_key]
        except KeyError:
            raise ValueError(f"Model key '{model_key}' not found in configuration.")

    def _get_model_id(self, model_key):
        """Get the specific Bedrock model ID (e.g., 'anthropic.claude-v2') from the model key."""
        model_config = self._get_model_config(model_key)
        if 'modelId' not in model_config:
             raise ValueError(f"Configuration for model key '{model_key}' is missing the 'modelId' field.")
        return model_config['modelId']

    def _get_model_profile_arn(self, model_id):
        base_arn = os.getenv('AWS_BEDROCK_INFERENCE_ARN', '').strip('"\'')
        
        if not base_arn:
            llm_logger.warning("AWS_BEDROCK_INFERENCE_ARN not set in environment. Skipping model invocation tests.")
            return True # Connectivity is okay, just can't test models

        profile_arn = f"{base_arn}{model_id}"
        return profile_arn

    def _get_provider_name(self, model_id):
        """Extract the provider name (e.g., 'anthropic', 'meta') from the model ID."""
        if not isinstance(model_id, str):
            return "unknown"
        return model_id.split('.')[0].lower() if '.' in model_id else "unknown"

    def _format_instruction(self, instruction):
        """Formats the instruction dictionary into a string for the system prompt."""
        # (Keep the existing _format_instruction logic here)
        if not instruction or not isinstance(instruction, dict):
            llm_logger.warning(f"Invalid instruction format received: {type(instruction)}. Returning empty string.")
            return ""

        formatted_lines = []
        for key, value in instruction.items():
            if key in ['variables', 'example']: continue # Skip structural keys

            display_key = re.sub(r'([a-z])([A-Z])', r'\1 \2', key).replace('_', ' ').title()

            if key.lower() == "role":
                formatted_lines.insert(0, f"{value}\n")
                continue

            if isinstance(value, dict):
                formatted_lines.append(f"**{display_key}:**")
                for sub_key, sub_value in value.items():
                    sub_display_key = re.sub(r'([a-z])([A-Z])', r'\1 \2', sub_key).replace('_', ' ').title()
                    if isinstance(sub_value, dict):
                         formatted_lines.append(f"- **{sub_display_key}:**")
                         for item_key, item_value in sub_value.items():
                              item_display_key = re.sub(r'([a-z])([A-Z])', r'\1 \2', item_key).replace('_', ' ').title()
                              if isinstance(item_value, dict) and 'description' in item_value:
                                   formatted_lines.append(f"  - **'{item_key}':** {item_value['description']}")
                              else:
                                   formatted_lines.append(f"  - {item_display_key}: {item_value}")
                    else:
                        formatted_lines.append(f"- {sub_display_key}: {sub_value}")
                formatted_lines.append("")
            elif isinstance(value, list):
                formatted_lines.append(f"**{display_key}:**")
                for item in value:
                     formatted_lines.append(f"- {item}")
                formatted_lines.append("")
            else:
                formatted_lines.append(f"**{display_key}:** {value}")
                formatted_lines.append("")

        return "\n".join(formatted_lines).strip()

    def _prepare_request(self, model_key, instruction, user_text):
        """
        Prepare the provider-specific request body.

        Returns:
            tuple: (model_id, request_body_dict)
        """
        log_prefix = f"[{self.current_request_id}] " if self.current_request_id else ""
        model_config = self._get_model_config(model_key)
        model_id = model_config['modelId']
        provider_name = self._get_provider_name(model_id)

        # Get base body template from config, ensuring it's a mutable dict
        if 'body' not in model_config:
             raise ValueError(f"Configuration for model key '{model_key}' is missing the 'body' field.")
        try:
            # Deep copy to avoid modifying the original config
            base_body = json.loads(json.dumps(model_config['body']))
        except (TypeError, json.JSONDecodeError):
             # Handle if body is already a dict or invalid JSON string
             if isinstance(model_config['body'], dict):
                 base_body = json.loads(json.dumps(model_config['body'])) # Deep copy dict
             else:
                 raise ValueError(f"Invalid 'body' format in config for model key '{model_key}'. Expected dict or JSON string.")


        formatted_instruction = self._format_instruction(instruction)

        # Delegate to provider-specific handlers
        if provider_name == "anthropic":
            request_body = self._prepare_anthropic_request(base_body, formatted_instruction, user_text)
        elif provider_name == "meta":
            request_body = self._prepare_meta_request(base_body, formatted_instruction, user_text)
        # Add other providers like 'mistral', 'cohere' here
        # elif provider_name == "mistral":
        #    request_body = self._prepare_mistral_request(base_body, formatted_instruction, user_text)
        else:
            # Generic fallback (attempt using 'prompt' or 'messages')
            llm_logger.warning(f"{log_prefix}Provider '{provider_name}' for model {model_id} has no specific handler. Using generic request preparation.")
            request_body = self._prepare_generic_request(base_body, formatted_instruction, user_text)

        llm_logger.debug(f"{log_prefix}Final prepared request body for {model_key}: {request_body}")
        return model_id, request_body

    def _invoke_model(self, model_id, request_body):
        """Invoke the Bedrock model using the prepared request."""
        log_prefix = f"[{self.current_request_id}] " if self.current_request_id else ""
        if not self.client:
            raise ConnectionError("Bedrock client is not initialized.")

        # Use inference profile ARN instead of direct model ID invocation
        # AWS now requires using inference profiles for these models
        profile_arn = self._get_model_profile_arn(model_id)
        llm_logger.info(f"  Connecting model: {model_id} using Profile: {profile_arn}")
        target_model_identifier = model_id  # Fallback to model_id if no profile found

        body = json.dumps(request_body)

        # Log payload before sending
        llm_logger.info(f"{log_prefix}Invoking {target_model_identifier} with payload: {json.dumps(request_body, indent=2)}")

        try:
            response = self.client.invoke_model(
                modelId=profile_arn,  # Can be model ID or profile ARN
                body=body,
                contentType='application/json',
                accept='application/json'  # Standard accept header
            )
            llm_logger.info(f"{log_prefix}Successfully invoked model {model_id}.")
            return response  # Return the raw boto3 response object
        except Exception as e:
             llm_logger.error(f"{log_prefix}Error during model invocation for {model_id}: {e}", exc_info=True)
             raise  # Re-raise the exception to be caught by the main method


    def _process_response(self, model_id, api_response, model_key):
        """
        Process the raw API response to extract content and metadata.
        Handles potential refinement using output model configuration.

        Returns:
            tuple: (raw_content_str, metadata_dict)
        """
        log_prefix = f"[{self.current_request_id}] " if self.current_request_id else ""
        metadata = {"model_id": model_id, "model_key": model_key, "refinement_performed": False}
        raw_content = ""

        try:
            response_body_stream = api_response.get('body')
            if not response_body_stream:
                raise ValueError("API response missing 'body'.")

            response_body_raw = response_body_stream.read()
            if not response_body_raw:
                raise ValueError("API response body is empty.")

            response_body = json.loads(response_body_raw)
            # Log the *parsed* response payload
            llm_logger.info(f"{log_prefix}Received response payload from {model_id}: {json.dumps(response_body, indent=2)}")


            provider_name = self._get_provider_name(model_id)

            # Delegate content extraction to provider-specific handlers
            if provider_name == "anthropic":
                raw_content = self._process_anthropic_response_content(response_body)
            elif provider_name == "meta":
                raw_content = self._process_meta_response_content(response_body)
            else:
                llm_logger.warning(f"{log_prefix}Provider '{provider_name}' for model {model_id} has no specific response processor. Using generic extraction.")
                raw_content = self._process_generic_response_content(response_body)


            return raw_content, metadata

        except json.JSONDecodeError as e:
            llm_logger.error(f"{log_prefix}Failed to parse JSON response from {model_id}. Raw response: '{response_body_raw[:500]}...' Error: {e}", exc_info=True)
            raise ValueError(f"Invalid JSON response from {model_id}") from e
        except Exception as e:
            llm_logger.error(f"{log_prefix}Error processing response for {model_id}: {e}", exc_info=True)
            raise ValueError(f"Error processing model response: {e}") from e


    def _standardize_output(self, content, provider_name):
        """
        Standardize and clean the extracted content.
        Removes provider-specific artifacts and attempts to extract the core answer.
        """
        log_prefix = f"[{self.current_request_id}] " if self.current_request_id else ""
        if not content:
            return ""

        # Apply provider-specific cleaning first
        if provider_name == "anthropic":
            content = self._clean_anthropic_output(content)
        elif provider_name == "meta":
            content = self._clean_meta_output(content)
        # Add other providers...

        # General standardization (previously in extract_final_answer)
        final_answer_markers = [
            "The final answer is:", "The final answer is :",
            "Final answer:", "Final answer :", "Answer:",
            "```json", "```" # Common code block markers
        ]

        cleaned_content = content # Start with potentially provider-cleaned content

        for marker in final_answer_markers:
            # Case-insensitive search
            marker_lower = marker.lower()
            content_lower = cleaned_content.lower()
            start_pos = content_lower.find(marker_lower)

            if start_pos != -1:
                # Extract text *after* the marker
                answer_text = cleaned_content[start_pos + len(marker):].strip()

                # Handle potential closing markers (like ```)
                if marker == "```json":
                    end_marker_pos = answer_text.find("```")
                    if end_marker_pos != -1:
                        answer_text = answer_text[:end_marker_pos].strip()
                elif marker == "```":
                     # If we only found ```, assume it's the start, look for the end
                     end_marker_pos = answer_text.find("```")
                     if end_marker_pos != -1:
                          answer_text = answer_text[:end_marker_pos].strip()

                # Basic cleanup of common conversational fluff
                lines = answer_text.splitlines()
                final_lines = []
                for line in lines:
                    line_stripped = line.strip()
                    if not line_stripped: continue
                    if (line_stripped.lower().startswith(("here is", "here's", "sure," ,"okay," ,"ok,")) or
                        line_stripped.lower().endswith(("as requested.", "as requested:", "let me know if you need more help.")) or
                        line_stripped.lower() in ["certainly!", "absolutely!"]):
                         continue
                    final_lines.append(line_stripped)

                if final_lines:
                    cleaned_content = "\n".join(final_lines).strip()
                    llm_logger.info(f"{log_prefix}Extracted answer using marker: '{marker}'")
                    return cleaned_content # Return immediately once a marker is processed

        # If no specific marker found, return the (potentially provider-cleaned) content
        llm_logger.info(f"{log_prefix}No specific answer marker found. Returning cleaned content.")
        return cleaned_content.strip()

    # --- Provider-Specific Handlers ---

    def _prepare_anthropic_request(self, base_body, formatted_instruction, user_text):
        """Prepare request payload specifically for Anthropic (Claude) models."""
        log_prefix = f"[{self.current_request_id}] " if self.current_request_id else ""
        payload = base_body # Start with the template from config

        # Claude uses 'system' for instructions
        if formatted_instruction:
            payload['system'] = formatted_instruction
        else:
            payload.pop('system', None) # Remove if no instruction

        # Claude uses 'messages' array for user/assistant turns
        if user_text:
            # Ensure messages is a list
            if 'messages' not in payload or not isinstance(payload['messages'], list):
                 payload['messages'] = []

            # Replace or add the user message (assuming single-turn for now)
            # More complex logic needed for multi-turn conversations
            payload['messages'] = [{"role": "user", "content": user_text}]
        else:
            payload.pop('messages', None) # Remove if no user text

        # Remove Llama-specific 'prompt' if it exists in the base_body
        payload.pop('prompt', None)

        # Ensure required 'max_tokens' exists (Bedrock uses max_tokens)
        if 'max_tokens' not in payload:
            payload['max_tokens'] = 1024 # Add a default if missing
            llm_logger.warning(f"{log_prefix}Anthropic request 'max_tokens' was missing, defaulted to 1024.")
        if 'anthropic_version' not in payload:
             payload['anthropic_version'] = "bedrock-2023-05-31" # Default version if missing
             llm_logger.warning(f"{log_prefix}Anthropic request 'anthropic_version' was missing, defaulted to bedrock-2023-05-31.")


        return payload

    def _prepare_meta_request(self, base_body, formatted_instruction, user_text):
        """Prepare request payload specifically for Meta (Llama) models."""
        log_prefix = f"[{self.current_request_id}] " if self.current_request_id else ""
        payload = base_body

        # Llama uses a single 'prompt' field, often with special tokens
        # Format: <s>[INST] <<SYS>>\n{system_prompt}\n<</SYS>>\n\n{user_message} [/INST]
        # Simplified format if no system prompt: <s>[INST] {user_message} [/INST]

        prompt_parts = ["<s>[INST]"]
        if formatted_instruction:
            prompt_parts.append(f"<<SYS>>\n{formatted_instruction}\n<</SYS>>\n")

        if user_text:
             # Add newline separation if instruction also exists
             if formatted_instruction:
                  prompt_parts.append("\n")
             prompt_parts.append(user_text)
        else:
             llm_logger.warning(f"{log_prefix}Preparing Meta request with no user_text. Prompt may be incomplete.")

        prompt_parts.append(" [/INST]")
        payload['prompt'] = "".join(prompt_parts)

        # Remove Anthropic-specific fields if they exist
        payload.pop('system', None)
        payload.pop('messages', None)
        payload.pop('anthropic_version', None)

        # Ensure required Llama parameters like 'max_gen_len'
        if 'max_gen_len' not in payload:
            payload['max_gen_len'] = 512 # Default if missing
            llm_logger.warning(f"{log_prefix}Meta request 'max_gen_len' was missing, defaulted to 512.")

        return payload

    def _prepare_generic_request(self, base_body, formatted_instruction, user_text):
        """Generic request preparation for unknown model types."""
        payload = base_body
        prompt = f"{formatted_instruction}\n\nUser: {user_text}\nAssistant:"
        payload['prompt'] = prompt # Assume a 'prompt' field works
        return payload

    def _process_anthropic_response_content(self, response_body):
        """Extract content from an Anthropic response body."""
        if not isinstance(response_body, dict): return ""

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
             llm_logger.warning(f"Could not find 'content' list or 'completion' key in Anthropic response: {response_body}")
             return "" # Or maybe str(response_body) as fallback?

    def _process_meta_response_content(self, response_body):
        """Extract content from a Meta response body."""
        if not isinstance(response_body, dict): return ""

        # Llama format (e.g., Llama 2/3 via Bedrock)
        if "generation" in response_body:
            return response_body.get("generation", "").strip()
        # Some variations might use 'outputs' or 'text'
        elif "outputs" in response_body and isinstance(response_body["outputs"], list) and response_body["outputs"]:
             first_output = response_body["outputs"][0]
             if isinstance(first_output, dict) and "text" in first_output:
                  return first_output.get("text", "").strip()
        elif "text" in response_body:
             return response_body.get("text", "").strip()
        else:
             llm_logger.warning(f"Could not find 'generation', 'outputs', or 'text' key in Meta response: {response_body}")
             return ""

    def _process_generic_response_content(self, response_body):
        """Generic content extraction for unknown model types."""
        if isinstance(response_body, str): return response_body
        if not isinstance(response_body, dict): return str(response_body)

        # Try common keys
        for key in ["text", "content", "completion", "generation", "output", "answer", "response"]:
            if key in response_body:
                value = response_body[key]
                if isinstance(value, str): return value.strip()
                if isinstance(value, list) and value: # Handle lists like Claude's content
                     if isinstance(value[0], dict) and "text" in value[0]: return value[0]["text"].strip()
                     if isinstance(value[0], str): return value[0].strip()
        return str(response_body) # Fallback to string representation


    def _clean_anthropic_output(self, content):
        """Clean provider-specific artifacts from Anthropic output."""
        # Remove XML-like tags sometimes added by Claude
        content = re.sub(r'<[^>]+>', '', content)
        # Remove markdown emphasis
        content = content.replace("**", "").replace("*", "")
        return content.strip()

    def _clean_meta_output(self, content):
        """Clean provider-specific artifacts from Meta output."""
        # Remove Llama instruction tags if they bleed into the output
        content = content.replace("[INST]", "").replace("[/INST]", "").replace("<s>", "").replace("</s>", "")
        # Llama sometimes starts with " " after the [/INST] tag
        return content.strip()

    # --- Test Payload Preparation ---
    def _prepare_test_request(self, model_key):
        """Prepares a minimal, safe request payload for testing a given model."""
        model_config = self._get_model_config(model_key)
        model_id = model_config['modelId']
        provider_name = self._get_provider_name(model_id)
        base_body = json.loads(json.dumps(model_config.get('body', {})))  # Safe copy

        # Test strings for both user prompt and system instructions
        test_user_prompt = "Hello! Please reply with a short, simple greeting like 'Hi there!'."
        test_system_instructions = "System: This is a test request. Execute it in demo mode."
        max_tokens_test = 30  # Keep it very short

        # The current_request_id will contain "startup_test" during startup tests
        is_startup_test = self.current_request_id and "startup_test" in self.current_request_id
        
        # For startup tests, we now prepare a simplified payload since we won't actually invoke the model
        if is_startup_test:
            llm_logger.info(f"Preparing simplified test request for {model_key} during startup test")
            # Return a very minimal payload since it won't be used for actual invocation
            return {"test": True, "message": "Test payload for startup connectivity test"}

        # For regular tests (not during startup), continue with normal test payload
        if provider_name == "anthropic":
             # For anthropic, pass both system instructions and the user prompt.
             payload = self._prepare_anthropic_request(base_body, test_system_instructions, test_user_prompt)
             payload['max_tokens'] = max_tokens_test
             return payload
        elif provider_name == "meta":
             # For meta, pass both system instructions and the user prompt.
             payload = self._prepare_meta_request(base_body, test_system_instructions, test_user_prompt)
             payload['max_gen_len'] = max_tokens_test
             # Ensure temperature is reasonable for a simple test
             payload['temperature'] = min(payload.get('temperature', 0.5), 0.7)
             payload['top_p'] = min(payload.get('top_p', 0.9), 0.9)
             return payload
        else:
             # For generic test payloads, concatenate system instructions and user prompt.
             payload = {
                 'prompt': f"{test_system_instructions}\n{test_user_prompt}",
                 'max_tokens': max_tokens_test
             }
             # Merge common parameters from base_body if they exist
             for key in ['temperature', 'top_p', 'top_k']:
                 if key in base_body:
                     payload[key] = base_body[key]
             return payload

    

# --- Main Execution ---
if __name__ == "__main__":
    llm_logger.info("Running Bedrock LLM Service directly for connection test.")

    # Instantiate the service (loads config automatically)
    try:
        bedrock_service = BedrockService()

        # Run the connection test
        test_passed = bedrock_service.test_aws_connection()

        if test_passed:
            llm_logger.info("Main: AWS Connection Test Completed Successfully.")
        else:
            llm_logger.error("Main: AWS Connection Test Failed.")
            sys.exit(1) # Exit with error code if tests fail

    except ConnectionError as ce:
         llm_logger.critical(f"Failed to initialize BedrockLLMService due to connection error: {ce}", exc_info=True)
         sys.exit(1)
    except Exception as e:
         llm_logger.critical(f"An unexpected error occurred during service initialization or testing: {e}", exc_info=True)
         sys.exit(1)