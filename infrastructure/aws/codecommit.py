"""
AWS CodeCommit repository operations.
This module provides functions to interact with AWS CodeCommit repositories.
"""

import os
import logging
import json
import boto3
import subprocess
import re
from typing import Dict, Any, Optional
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from infrastructure.db.requirement import ProjectEntity as Project
from sqlalchemy.orm import Session
from infrastructure.db.db_core import engine

# Load environment variables from .env file
load_dotenv(dotenv_path="global/.env")

# Setup logging
logger = logging.getLogger(__name__)

def load_config(config_path: str = "global/config.json") -> Dict[str, Any]:
    """Load configuration from JSON file."""
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config
    except Exception as e:
        logger.error(f"Error loading config: {str(e)}")
        raise

def get_aws_region() -> str:
    """Get AWS region from environment variables or config."""
    # First try from .env file
    region = os.environ.get("AWS_REGION")
    if region:
        return region
    
    # Then try from environment variables
    region = os.environ.get("AWS_DEFAULT_REGION")
    if region:
        return region
    
    # Finally, try from config.json
    try:
        config = load_config()
        region = config.get("aws", {}).get("region")
        if region:
            return region
    except Exception as e:
        logger.error(f"Error getting AWS region from config: {str(e)}")
    
    # Default to us-east-1 if nothing found
    return "us-east-1"

def get_clone_folder_pattern() -> str:
    """Get clone folder pattern from environment variables."""
    return os.environ.get("CLONE_FOLDER", "tmp/{project_id}/clone")

def get_work_folder_pattern() -> str:
    """Get work folder pattern from environment variables."""
    return os.environ.get("WORK_FOLDER", "tmp/{project_id}/clone")

def get_repo_name(project_id: int) -> str:
    """
    Generate repository name from project ID and name.
    First tries to get project name from database, falls back to ID-based name if not found.
    
    Args:
        project_id: The project ID
    
    Returns:
        Repository name
    """
    try:
        # Get project name using the Project model
        with Session(engine) as session:
            project = session.query(Project).filter(Project.id == project_id).first()
            
            if project and project.name:
                # Sanitize project name for use as repository name
                project_name = project.name
                # Replace spaces and special characters with dashes
                sanitized = re.sub(r'[^a-zA-Z0-9_.-]', '-', project_name)
                # Remove consecutive dashes
                sanitized = re.sub(r'-+', '-', sanitized)
                # Convert to lowercase
                sanitized = sanitized.lower()
                # Trim dashes from start and end
                sanitized = sanitized.strip('-')
                
                # If empty after sanitization, use a default name
                if not sanitized:
                    return f"project-{project_id}"
                    
                return f"{sanitized}-{project_id}"
            else:
                logger.warning(f"No project found with ID {project_id}")
                return f"project-{project_id}"
    except Exception as e:
        logger.error(f"Error getting project name from database: {str(e)}")
        return f"project-{project_id}"

def check_repository_exists(project_id: int) -> Dict[str, Any]:
    """
    Check if repository exists in AWS CodeCommit.
    
    Args:
        project_id: The project ID
        
    Returns:
        Dictionary indicating whether repository exists
    """
    try:
        logger.info(f"Checking if repository for project {project_id} exists in AWS CodeCommit")
        repo_name = get_repo_name(project_id)
        region = get_aws_region()
        
        # Get AWS credentials from environment variables
        access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        
        # Create CodeCommit client with explicit credentials if available
        if access_key and secret_key:
            codecommit = boto3.client(
                'codecommit',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region
            )
        else:
            codecommit = boto3.client('codecommit', region_name=region)
        
        try:
            # Try to get repository details
            response = codecommit.get_repository(repositoryName=repo_name)
            return {
                "exists": True,
                "project_id": project_id,
                "repository_details": {
                    "name": repo_name,
                    "arn": response.get('repositoryMetadata', {}).get('Arn'),
                    "clone_url_http": response.get('repositoryMetadata', {}).get('cloneUrlHttp'),
                    "clone_url_ssh": response.get('repositoryMetadata', {}).get('cloneUrlSsh')
                }
            }
        except ClientError as e:
            # Check if the error is because the repository doesn't exist
            if e.response.get('Error', {}).get('Code') == 'RepositoryDoesNotExistException':
                logger.info(f"Repository {repo_name} does not exist in AWS CodeCommit")
                return {
                    "exists": False,
                    "project_id": project_id
                }
            # Other AWS error
            raise
        
    except Exception as e:
        logger.error(f"Error checking repository existence: {str(e)}")
        return {
            "exists": False,
            "project_id": project_id,
            "error": str(e)
        }

def clone_repository(project_id: int, clone_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Clone repository from AWS CodeCommit to local folder.
    
    Args:
        project_id: The project ID
        clone_path: Path where to clone the repository (optional)
        
    Returns:
        Dictionary with clone operation result
    """
    try:
        # If clone_path is not provided, use the pattern from .env
        if not clone_path:
            clone_folder_pattern = get_clone_folder_pattern()
            clone_path = clone_folder_pattern.format(project_id=project_id)
        
        logger.info(f"Cloning repository for project {project_id} to {clone_path}")
        
        # Get AWS credentials from environment variables
        access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        region = get_aws_region()
        
        # Create CodeCommit client with explicit credentials if available
        if access_key and secret_key:
            codecommit = boto3.client(
                'codecommit',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region
            )
        else:
            codecommit = boto3.client('codecommit', region_name=region)
        
        # First check if repository exists
        repo_check = check_repository_exists(project_id)
        
        if not repo_check.get("exists", False):
            return {
                "success": False,
                "project_id": project_id,
                "error": "Repository does not exist in AWS CodeCommit"
            }
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(clone_path), exist_ok=True)
        
        # Remove directory if it exists (to ensure clean clone)
        if os.path.exists(clone_path):
            import shutil
            shutil.rmtree(clone_path)
        
        # Get clone URL (prefer HTTPS over SSH for compatibility)
        clone_url = repo_check.get("repository_details", {}).get("clone_url_http")
        
        if not clone_url:
            return {
                "success": False,
                "project_id": project_id,
                "error": "Failed to get repository clone URL"
            }
        
        # For HTTPS clone URLs, we need to set up Git credentials
        if access_key and secret_key and "https://" in clone_url:
            # Create a Git credential helper script
            helper_script_path = os.path.expanduser("~/.git-credential-helper.sh")
            with open(helper_script_path, 'w') as f:
                f.write(f"""#!/bin/bash
echo "username={access_key}"
echo "password={secret_key}"
""")
            os.chmod(helper_script_path, 0o700)  # Make executable
            
            # Set Git configuration for AWS CodeCommit
            os.environ["GIT_CONFIG_COUNT"] = "1"
            os.environ["GIT_CONFIG_KEY_0"] = "credential.helper"
            os.environ["GIT_CONFIG_VALUE_0"] = helper_script_path
        
        # Clone repository
        result = subprocess.run(
            ["git", "clone", clone_url, clone_path],
            capture_output=True, 
            text=True
        )
        
        # Clean up the credential helper
        if os.path.exists(helper_script_path):
            os.remove(helper_script_path)
        
        if result.returncode != 0:
            logger.error(f"Git clone error: {result.stderr}")
            return {
                "success": False,
                "project_id": project_id,
                "error": f"Git clone failed: {result.stderr}"
            }
        
        return {
            "success": True,
            "project_id": project_id,
            "clone_path": clone_path,
            "message": f"Repository cloned successfully to {clone_path}",
            "work_path": get_work_folder_pattern().format(project_id=project_id)
        }
        
    except Exception as e:
        logger.error(f"Error cloning repository: {str(e)}")
        return {
            "success": False,
            "project_id": project_id,
            "error": str(e)
        }

def create_repository(project_id: int, description: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new repository in AWS CodeCommit.
    
    Args:
        project_id: The project ID
        description: Repository description
        
    Returns:
        Dictionary with repository creation result
    """
    try:
        repo_name = get_repo_name(project_id)
        if not description:
            description = f"Repository for project {project_id}"
        
        logger.info(f"Creating new repository {repo_name} in AWS CodeCommit")
        region = get_aws_region()
        
        # Get AWS credentials from environment variables
        access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        
        # Create CodeCommit client with explicit credentials if available
        if access_key and secret_key:
            codecommit = boto3.client(
                'codecommit',
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region
            )
        else:
            codecommit = boto3.client('codecommit', region_name=region)
        
        # Check if repository already exists
        repo_check = check_repository_exists(project_id)
        if repo_check.get("exists", False):
            return {
                "success": True,
                "project_id": project_id,
                "repository_name": repo_name,
                "message": f"Repository {repo_name} already exists",
                "repository_details": repo_check.get("repository_details", {}),
                "work_path": get_work_folder_pattern().format(project_id=project_id)
            }
        
        # Create repository
        response = codecommit.create_repository(
            repositoryName=repo_name,
            repositoryDescription=description
        )
        
        repository_metadata = response.get('repositoryMetadata', {})
        
        return {
            "success": True,
            "project_id": project_id,
            "repository_name": repo_name,
            "message": f"Repository {repo_name} created successfully",
            "repository_details": {
                "name": repo_name,
                "arn": repository_metadata.get('Arn'),
                "clone_url_http": repository_metadata.get('cloneUrlHttp'),
                "clone_url_ssh": repository_metadata.get('cloneUrlSsh')
            },
            "work_path": get_work_folder_pattern().format(project_id=project_id)
        }
        
    except Exception as e:
        logger.error(f"Error creating repository: {str(e)}")
        return {
            "success": False,
            "project_id": project_id,
            "error": str(e)
        } 