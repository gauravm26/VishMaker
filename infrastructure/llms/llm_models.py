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
        self.setup_client()
    
    def setup_client(self):
        """Set up the AWS Bedrock client"""
        try:
            # Create a new boto3 session
            self.session = boto3.Session(
                aws_access_key_id=os.getenv('AWS_BEDROCK_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_BEDROCK_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_BEDROCK_REGION', 'us-east-1')
            )
            
            # Create the bedrock-runtime client
            self.client = self.session.client('bedrock-runtime')
            return True
        except Exception as e:
            print(f"Error setting up Bedrock client: {str(e)}")
            return False
    
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

# Load environment variables from .env file in the project root
env_path = project_root / 'global' / '.env'
load_dotenv(env_path)

def load_config():
    """Load the models configuration from global/config.json"""
    try:
        config_path = project_root / 'global' / 'config.json'
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Extract model IDs from config - without verbose output
        if 'llm' in config and 'modelIds' in config['llm']:
            return config
        else:
            return {}
    except Exception as e:
        print(f"Error loading config.json: {e}")
        return {}

def generate_inference_profiles(model_ids):
    """Generate inference profiles for each model ID using the base ARN from .env"""
    inference_profiles = {}
    
    # Get the base ARN from environment variable
    base_arn = os.getenv('AWS_BEDROCK_INFERENCE_ARN', '').strip('"\'')
    
    if not base_arn:
        return {}
    
    # For each model ID, create a corresponding inference profile ARN
    for model_id in model_ids:
        # Convert model ID format to match what's expected in the ARN
        # Example: "anthropic.claude-3-7-sonnet-20250219-v1:0" -> "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
        formatted_model_id = model_id.replace('.', '-', 1).replace('-', '.', 1)
        if not formatted_model_id.startswith('us.'):
            formatted_model_id = 'us.' + model_id
        
        # Create the full inference profile ARN
        inference_arn = f"{base_arn}/{formatted_model_id}"
        
        # Add to inference profiles dictionary
        inference_profiles[model_id] = inference_arn
    
    return inference_profiles

def get_model_config(config, model_id):
    """Get the model configuration from the config object"""
    if 'llm' in config and 'modelIds' in config['llm'] and model_id in config['llm']['modelIds']:
        return config['llm']['modelIds'][model_id]
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
        access_key = os.getenv('AWS_ACCESS_KEY_ID', '')
        print(f"Using Access Key ID: {access_key[:5]}..." if access_key else "AWS_ACCESS_KEY_ID not found")
        print(f"Region: {os.getenv('AWS_REGION', 'Not configured')}")
        
        session = boto3.Session(
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION')
        )

        sts = session.client('sts', config=config)
        identity = sts.get_caller_identity()
        print("Successfully connected to AWS!")
        print(f"Account ID: {identity['Account']}")
        print(f"User ARN: {identity['Arn']}")
        
        # Test Bedrock runtime connection
        print("\nTesting Bedrock runtime connection...")
        bedrock_runtime = session.client('bedrock-runtime', config=config)
        print("Successfully connected to Bedrock runtime!")
        
        # Load configuration from config.json
        config_data = load_config()
        
        if not config_data or 'llm' not in config_data or 'modelIds' not in config_data['llm']:
            print("No model IDs found in config.json. Exiting.")
            return
            
        model_ids = list(config_data['llm']['modelIds'].keys())
        
        if not model_ids:
            print("No model IDs found in config.json. Exiting.")
            return
            
        # Generate inference profiles for each model
        print("\nGenerating inference profiles for models...")
        inference_profiles = generate_inference_profiles(model_ids)
        
        if not inference_profiles:
            print("No inference profiles could be generated. Please set AWS_BEDROCK_INFERENCE_ARN in your .env file.")
            return
            
        print(f"Generated {len(inference_profiles)} inference profiles")
        
        # Filter inference profiles to only include models from config.json
        config_profiles = {model_id: profile_arn for model_id, profile_arn in inference_profiles.items() if model_id in model_ids}
        
        if not config_profiles:
            print("None of the models in config.json have corresponding inference profiles.")
            print("Models in config.json:", model_ids)
            return
        
        print(f"\nTesting {len(config_profiles)} models from config.json...")
        
        # Group models by provider for testing
        claude_models = [model_id for model_id in config_profiles.keys() if "anthropic.claude" in model_id]
        meta_models = [model_id for model_id in config_profiles.keys() if "meta.llama" in model_id]
        mistral_models = [model_id for model_id in config_profiles.keys() if "mistral" in model_id]
        other_models = [model_id for model_id in config_profiles.keys() 
                       if "anthropic.claude" not in model_id 
                       and "meta.llama" not in model_id 
                       and "mistral" not in model_id]
        
        # Test models by provider group
        if claude_models:
            print("\n===== TESTING CLAUDE MODELS =====")
            for model_id in claude_models:
                test_model_with_inference_profile(bedrock_runtime, model_id, config_profiles[model_id], config_data)
            
        if meta_models:
            print("\n===== TESTING META MODELS =====")
            for model_id in meta_models:
                test_model_with_inference_profile(bedrock_runtime, model_id, config_profiles[model_id], config_data)
            
        if mistral_models:
            print("\n===== TESTING MISTRAL MODELS =====")
            for model_id in mistral_models:
                test_model_with_inference_profile(bedrock_runtime, model_id, config_profiles[model_id], config_data)
                
        if other_models:
            print("\n===== TESTING OTHER MODELS =====")
            for model_id in other_models:
                test_model_with_inference_profile(bedrock_runtime, model_id, config_profiles[model_id], config_data)
                
    except Exception as e:
        print(f"Error during AWS connection test: {str(e)}")

if __name__ == "__main__":
    test_aws_connection() 