"""
Git repository operations.
This module provides functions to manage Git repositories.
"""

import os
import logging
import subprocess
import shutil
import re
import tempfile
from typing import Dict, Any, Optional, List, Tuple
from dotenv import load_dotenv
from infrastructure.db.requirement import ProjectEntity as Project
from sqlalchemy.orm import Session
from infrastructure.db.db_core import engine
from github import Github, GithubException

# Load environment variables from .env file
load_dotenv(dotenv_path="global/.env")

# Setup logging
logger = logging.getLogger(__name__)

def get_clone_folder_pattern() -> str:
    """Get clone folder pattern from environment variables."""
    return os.environ.get("CLONE_FOLDER", "tmp/{project_id}/clone")

def get_work_folder_pattern() -> str:
    """Get work folder pattern from environment variables."""
    return os.environ.get("WORK_FOLDER", "tmp/{project_id}/clone")

def get_repo_url_pattern() -> str:
    """Get repository URL pattern from environment variables."""
    return os.environ.get("GIT_REPO_URL_PATTERN", "https://github.com/username/project-{project_id}.git")

def get_project_name_from_db(project_id: int) -> Optional[str]:
    """
    Get project name from database.
    
    Args:
        project_id: The project ID
    
    Returns:
        Project name if found, None otherwise
    """
    try:
        # Get database connection details from environment variables
        db_url = os.environ.get("DATABASE_URL")
        
        if not db_url:
            logger.warning("DATABASE_URL not set in environment variables")
            return None
        
        # Connect to database
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Query for project name
        query = sql.SQL("SELECT name FROM projects WHERE id = %s")
        cursor.execute(query, (project_id,))
        
        result = cursor.fetchone()
        
        # Close database connection
        cursor.close()
        conn.close()
        
        if result:
            return result[0]
        else:
            logger.warning(f"No project found with ID {project_id}")
            return None
            
    except Exception as e:
        logger.error(f"Error getting project name from database: {str(e)}")
        return None

def sanitize_repo_name(name: str) -> str:
    """
    Sanitize repository name to be valid for Git.
    
    Args:
        name: The raw project name
    
    Returns:
        Sanitized repository name
    """
    # Replace spaces and special characters with dashes
    sanitized = re.sub(r'[^a-zA-Z0-9_.-]', '-', name)
    # Remove consecutive dashes
    sanitized = re.sub(r'-+', '-', sanitized)
    # Convert to lowercase
    sanitized = sanitized.lower()
    # Trim dashes from start and end
    sanitized = sanitized.strip('-')
    
    # If empty after sanitization, use a default name
    if not sanitized:
        return "project-repository"
    
    return sanitized

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
                    
                return sanitized  # Return just the sanitized name without appending project_id
            else:
                logger.warning(f"No project found with ID {project_id}")
                return f"project-{project_id}"
    except Exception as e:
        logger.error(f"Error getting project name from database: {str(e)}")
        return f"project-{project_id}"

def run_git_command(cmd: List[str], cwd: Optional[str] = None) -> Tuple[bool, str, str]:
    """
    Run a Git command and return the result.
    
    Args:
        cmd: The command to run as a list of strings (e.g., ["git", "init"])
        cwd: The working directory to run the command in
    
    Returns:
        Tuple of (success, stdout, stderr)
    """
    try:
        logger.debug(f"Running Git command: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            cwd=cwd,
            check=False,
            capture_output=True,
            text=True
        )
        success = result.returncode == 0
        if not success:
            logger.error(f"Git command failed: {result.stderr}")
        return success, result.stdout, result.stderr
    except Exception as e:
        logger.error(f"Error running Git command: {str(e)}")
        return False, "", str(e)

def create_github_repository(name: str, description: Optional[str] = None, private: bool = False) -> Dict[str, Any]:
    """
    Create a new repository on GitHub.
    
    Args:
        name: Repository name
        description: Repository description
        private: Whether repository should be private
        
    Returns:
        Dictionary with repository creation result
    """
    try:
        # Get GitHub token from environment
        github_token = os.environ.get("GITHUB_TOKEN")
        github_username = os.environ.get("GIT_USER_NAME")
        
        if not github_token:
            logger.error("GITHUB_TOKEN not set in environment variables")
            return {
                "success": False,
                "error": "GitHub token not configured. Set GITHUB_TOKEN in .env file."
            }
            
        if not github_username:
            logger.error("GIT_USER_NAME not set in environment variables")
            return {
                "success": False,
                "error": "GitHub username not configured. Set GIT_USER_NAME in .env file."
            }
        
        # Create GitHub instance
        g = Github(github_token)
        user = g.get_user()
        
        # Check if repository already exists
        try:
            repo = user.get_repo(name)
            # If we get here, repo exists
            logger.info(f"Repository {name} already exists on GitHub")
            return {
                "success": True,
                "message": f"Repository {name} already exists on GitHub",
                "repo_url": repo.clone_url,
                "existing": True
            }
        except GithubException as e:
            if e.status != 404:  # Not a "not found" error
                logger.error(f"Error checking if repository exists: {str(e)}")
                return {
                    "success": False,
                    "error": f"GitHub API error: {str(e)}"
                }
        
        # Create repository
        repo = user.create_repo(
            name=name,
            description=description or f"Repository for {name}",
            private=private
        )
        
        logger.info(f"Repository {name} created on GitHub at {repo.clone_url}")
        return {
            "success": True,
            "message": f"Repository {name} created on GitHub",
            "repo_url": repo.clone_url,
            "html_url": repo.html_url
        }
        
    except GithubException as e:
        logger.error(f"GitHub API error: {str(e)}")
        return {
            "success": False,
            "error": f"GitHub API error: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Error creating GitHub repository: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def create_repository(project_id: int, path: Optional[str] = None, remote_url: Optional[str] = None, repo_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new Git repository locally and on GitHub.
    
    Args:
        project_id: The project ID
        path: Path where to create the repository (optional)
        remote_url: URL of the remote repository to add (optional)
        repo_name: Custom repository name (optional, overrides database name)
        
    Returns:
        Dictionary with repository creation result
    """
    try:
        # If path is not provided, use the pattern from .env
        if not path:
            work_folder_pattern = get_work_folder_pattern()
            path = work_folder_pattern.format(project_id=project_id)
        
        # Use provided repo_name or get from database
        if not repo_name:
            repo_name = get_repo_name(project_id)
        
        logger.info(f"Creating Git repository {repo_name} for project {project_id} at {path}")
        
        # Create repository on GitHub first
        # Only if GITHUB_TOKEN is set
        if os.environ.get("GITHUB_TOKEN"):
            github_result = create_github_repository(repo_name)
            if github_result.get("success"):
                # Use the GitHub URL
                remote_url = github_result.get("repo_url")
                logger.info(f"GitHub repository created: {remote_url}")
            else:
                logger.warning(f"Failed to create GitHub repository: {github_result.get('error')}")
                # Continue with local creation, will set remote_url later if provided
        else:
            logger.warning("GITHUB_TOKEN not set, skipping GitHub repository creation")
        
        # Create directory if it doesn't exist
        os.makedirs(path, exist_ok=True)
        
        # Initialize Git repository
        success, stdout, stderr = run_git_command(["git", "init"], cwd=path)
        if not success:
            return {
                "success": False,
                "project_id": project_id,
                "error": f"Failed to initialize Git repository: {stderr}"
            }
        
        # Create initial README file
        readme_path = os.path.join(path, "README.md")
        with open(readme_path, "w") as f:
            f.write(f"# {repo_name}\n\nRepository for project {project_id}\n")
        
        # Add README to repository
        success, _, stderr = run_git_command(["git", "add", "README.md"], cwd=path)
        if not success:
            return {
                "success": False,
                "project_id": project_id,
                "error": f"Failed to add README to repository: {stderr}"
            }
        
        # Commit README
        success, _, stderr = run_git_command(
            ["git", "commit", "-m", "Initial commit with README"], 
            cwd=path
        )
        if not success:
            return {
                "success": False,
                "project_id": project_id,
                "error": f"Failed to commit README: {stderr}"
            }
        
        # Add remote if provided or if GitHub repository was created
        if remote_url:
            success, _, stderr = run_git_command(
                ["git", "remote", "add", "origin", remote_url],
                cwd=path
            )
            if not success:
                return {
                    "success": False,
                    "project_id": project_id,
                    "error": f"Failed to add remote: {stderr}"
                }
                
            # Push to remote if we have a remote URL and GitHub token
            if os.environ.get("GITHUB_TOKEN"):
                # Set Git user name and email if available
                git_user = os.environ.get("GIT_USER_NAME")
                git_email = os.environ.get("GIT_USER_EMAIL")
                
                if git_user:
                    run_git_command(["git", "config", "user.name", git_user], cwd=path)
                if git_email:
                    run_git_command(["git", "config", "user.email", git_email], cwd=path)
                
                # Get current branch name
                success, branch_name, _ = run_git_command(
                    ["git", "branch", "--show-current"], 
                    cwd=path
                )
                
                if success and branch_name.strip():
                    current_branch = branch_name.strip()
                else:
                    # Try to get the branch with rev-parse
                    success, branch_ref, _ = run_git_command(
                        ["git", "rev-parse", "--abbrev-ref", "HEAD"], 
                        cwd=path
                    )
                    current_branch = branch_ref.strip() if success and branch_ref.strip() else "master"
                
                # Push to remote using the current branch
                logger.info(f"Pushing initial commit to {remote_url} on branch {current_branch}")
                success, _, stderr = run_git_command(
                    ["git", "push", "-u", "origin", current_branch], 
                    cwd=path
                )
                
                if not success:
                    logger.warning(f"Failed to push to remote: {stderr}")
                    # Continue anyway, the repository is created
        
        return {
            "success": True,
            "project_id": project_id,
            "repository_path": path,
            "message": f"Git repository created successfully at {path}",
            "work_path": path,
            "remote_url": remote_url,
            "github_url": remote_url
        }
        
    except Exception as e:
        logger.error(f"Error creating Git repository: {str(e)}")
        return {
            "success": False,
            "project_id": project_id,
            "error": str(e)
        }

def clone_repository(project_id: int, remote_url: Optional[str] = None, clone_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Clone a Git repository.
    
    Args:
        project_id: The project ID
        remote_url: URL of the repository to clone (optional, will use pattern if not provided)
        clone_path: Path where to clone the repository (optional)
        
    Returns:
        Dictionary with clone operation result
    """
    try:
        # If clone_path is not provided, use the pattern from .env
        if not clone_path:
            clone_folder_pattern = get_clone_folder_pattern()
            clone_path = clone_folder_pattern.format(project_id=project_id)
        
        # If remote_url is not provided, use the pattern from .env
        if not remote_url:
            url_pattern = get_repo_url_pattern()
            # Get the project name to use in the URL
            project_name = get_repo_name(project_id)
            # Format URL with project_name instead of project_id
            remote_url = url_pattern.format(project_name=project_name)
        
        logger.info(f"Cloning Git repository for project {project_id} from {remote_url} to {clone_path}")
        
        # Create parent directory if it doesn't exist
        os.makedirs(os.path.dirname(clone_path), exist_ok=True)
        
        # Remove directory if it exists (to ensure clean clone)
        if os.path.exists(clone_path):
            shutil.rmtree(clone_path)
        
        # Clone repository
        success, _, stderr = run_git_command(["git", "clone", remote_url, clone_path])
        
        if not success:
            return {
                "success": False,
                "project_id": project_id,
                "error": f"Git clone failed: {stderr}"
            }
        
        return {
            "success": True,
            "project_id": project_id,
            "clone_path": clone_path,
            "remote_url": remote_url,
            "message": f"Repository cloned successfully to {clone_path}",
            "work_path": clone_path
        }
        
    except Exception as e:
        logger.error(f"Error cloning repository: {str(e)}")
        return {
            "success": False,
            "project_id": project_id,
            "error": str(e)
        }

def check_repository_exists(project_id: int, repo_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Check if a Git repository exists and is valid.
    
    Args:
        project_id: The project ID
        repo_path: Path to the repository (optional)
        
    Returns:
        Dictionary indicating whether the repository exists
    """
    try:
        # If repo_path is not provided, use the pattern from .env
        if not repo_path:
            work_folder_pattern = get_work_folder_pattern()
            repo_path = work_folder_pattern.format(project_id=project_id)
        
        logger.info(f"Checking if Git repository exists at {repo_path}")
        
        # Check if path exists
        if not os.path.exists(repo_path):
            logger.info(f"Repository path {repo_path} does not exist")
            return {
                "exists": False,
                "project_id": project_id,
                "message": f"Repository path {repo_path} does not exist"
            }
        
        # Check if it's a Git repository
        git_dir = os.path.join(repo_path, ".git")
        if not os.path.exists(git_dir) or not os.path.isdir(git_dir):
            logger.info(f"Path {repo_path} is not a Git repository")
            return {
                "exists": False,
                "project_id": project_id,
                "message": f"Path {repo_path} is not a Git repository"
            }
        
        # Get repository details
        success, remote_output, _ = run_git_command(["git", "remote", "-v"], cwd=repo_path)
        remotes = {}
        if success and remote_output:
            for line in remote_output.splitlines():
                if line:
                    parts = line.split()
                    if len(parts) >= 2:
                        name, url = parts[0], parts[1]
                        remotes[name] = url
        
        # Get current branch
        success, branch_output, _ = run_git_command(["git", "branch", "--show-current"], cwd=repo_path)
        current_branch = branch_output.strip() if success and branch_output else "unknown"
        
        return {
            "exists": True,
            "project_id": project_id,
            "repository_path": repo_path,
            "current_branch": current_branch,
            "remotes": remotes
        }
        
    except Exception as e:
        logger.error(f"Error checking repository existence: {str(e)}")
        return {
            "exists": False,
            "project_id": project_id,
            "error": str(e)
        }

def commit_changes(
    project_id: int, 
    repo_path: Optional[str] = None, 
    message: str = "Updated files", 
    files: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Commit changes to a Git repository.
    
    Args:
        project_id: The project ID
        repo_path: Path to the repository (optional)
        message: Commit message
        files: List of files to commit (if None, commits all changes)
        
    Returns:
        Dictionary with commit operation result
    """
    try:
        # If repo_path is not provided, use the pattern from .env
        if not repo_path:
            work_folder_pattern = get_work_folder_pattern()
            repo_path = work_folder_pattern.format(project_id=project_id)
        
        logger.info(f"Committing changes to repository at {repo_path}")
        
        # Check if it's a Git repository
        repo_check = check_repository_exists(project_id, repo_path)
        if not repo_check.get("exists", False):
            return {
                "success": False,
                "project_id": project_id,
                "error": f"No valid Git repository found at {repo_path}"
            }
        
        # Add files to staging area
        if files:
            # Add specific files
            for file in files:
                success, _, stderr = run_git_command(["git", "add", file], cwd=repo_path)
                if not success:
                    return {
                        "success": False,
                        "project_id": project_id,
                        "error": f"Failed to add file {file}: {stderr}"
                    }
        else:
            # Add all changes
            success, _, stderr = run_git_command(["git", "add", "."], cwd=repo_path)
            if not success:
                return {
                    "success": False,
                    "project_id": project_id,
                    "error": f"Failed to add changes: {stderr}"
                }
        
        # Commit changes
        success, commit_output, stderr = run_git_command(
            ["git", "commit", "-m", message], 
            cwd=repo_path
        )
        
        if not success:
            # Check if it's a "nothing to commit" situation
            if "nothing to commit" in stderr:
                return {
                    "success": True,
                    "project_id": project_id,
                    "message": "No changes to commit",
                    "commit_hash": None
                }
            return {
                "success": False,
                "project_id": project_id,
                "error": f"Failed to commit changes: {stderr}"
            }
        
        # Get commit hash
        success, commit_hash, _ = run_git_command(
            ["git", "rev-parse", "HEAD"], 
            cwd=repo_path
        )
        
        return {
            "success": True,
            "project_id": project_id,
            "message": f"Changes committed successfully: {commit_output}",
            "commit_hash": commit_hash.strip() if success else None
        }
        
    except Exception as e:
        logger.error(f"Error committing changes: {str(e)}")
        return {
            "success": False,
            "project_id": project_id,
            "error": str(e)
        }

def push_changes(
    project_id: int, 
    repo_path: Optional[str] = None, 
    remote: str = "origin", 
    branch: Optional[str] = None
) -> Dict[str, Any]:
    """
    Push changes to a remote Git repository.
    
    Args:
        project_id: The project ID
        repo_path: Path to the repository (optional)
        remote: Name of the remote (default: origin)
        branch: Branch to push (if None, pushes current branch)
        
    Returns:
        Dictionary with push operation result
    """
    try:
        # If repo_path is not provided, use the pattern from .env
        if not repo_path:
            work_folder_pattern = get_work_folder_pattern()
            repo_path = work_folder_pattern.format(project_id=project_id)
        
        logger.info(f"Pushing changes from repository at {repo_path} to {remote}")
        
        # Check if it's a Git repository
        repo_check = check_repository_exists(project_id, repo_path)
        if not repo_check.get("exists", False):
            return {
                "success": False,
                "project_id": project_id,
                "error": f"No valid Git repository found at {repo_path}"
            }
        
        # If branch is not provided, use current branch
        if not branch:
            branch = repo_check.get("current_branch", "main")
        
        # Push changes
        success, push_output, stderr = run_git_command(
            ["git", "push", remote, branch], 
            cwd=repo_path
        )
        
        if not success:
            return {
                "success": False,
                "project_id": project_id,
                "error": f"Failed to push changes: {stderr}"
            }
        
        return {
            "success": True,
            "project_id": project_id,
            "message": f"Changes pushed successfully to {remote}/{branch}",
            "output": push_output
        }
        
    except Exception as e:
        logger.error(f"Error pushing changes: {str(e)}")
        return {
            "success": False,
            "project_id": project_id,
            "error": str(e)
        }

def pull_changes(
    project_id: int, 
    repo_path: Optional[str] = None, 
    remote: str = "origin", 
    branch: Optional[str] = None
) -> Dict[str, Any]:
    """
    Pull changes from a remote Git repository.
    
    Args:
        project_id: The project ID
        repo_path: Path to the repository (optional)
        remote: Name of the remote (default: origin)
        branch: Branch to pull (if None, pulls current branch)
        
    Returns:
        Dictionary with pull operation result
    """
    try:
        # If repo_path is not provided, use the pattern from .env
        if not repo_path:
            work_folder_pattern = get_work_folder_pattern()
            repo_path = work_folder_pattern.format(project_id=project_id)
        
        logger.info(f"Pulling changes to repository at {repo_path} from {remote}")
        
        # Check if it's a Git repository
        repo_check = check_repository_exists(project_id, repo_path)
        if not repo_check.get("exists", False):
            return {
                "success": False,
                "project_id": project_id,
                "error": f"No valid Git repository found at {repo_path}"
            }
        
        # If branch is not provided, use current branch
        if not branch:
            branch = repo_check.get("current_branch", "main")
        
        # Pull changes
        success, pull_output, stderr = run_git_command(
            ["git", "pull", remote, branch], 
            cwd=repo_path
        )
        
        if not success:
            return {
                "success": False,
                "project_id": project_id,
                "error": f"Failed to pull changes: {stderr}"
            }
        
        return {
            "success": True,
            "project_id": project_id,
            "message": f"Changes pulled successfully from {remote}/{branch}",
            "output": pull_output
        }
        
    except Exception as e:
        logger.error(f"Error pulling changes: {str(e)}")
        return {
            "success": False,
            "project_id": project_id,
            "error": str(e)
        }

def merge_branch(
    project_id: int, 
    source_branch: str, 
    target_branch: Optional[str] = None, 
    repo_path: Optional[str] = None,
    message: Optional[str] = None
) -> Dict[str, Any]:
    """
    Merge a branch into another branch.
    
    Args:
        project_id: The project ID
        source_branch: Branch to merge from
        target_branch: Branch to merge into (if None, merges into current branch)
        repo_path: Path to the repository (optional)
        message: Custom merge commit message (optional)
        
    Returns:
        Dictionary with merge operation result
    """
    try:
        # If repo_path is not provided, use the pattern from .env
        if not repo_path:
            work_folder_pattern = get_work_folder_pattern()
            repo_path = work_folder_pattern.format(project_id=project_id)
        
        logger.info(f"Merging branch {source_branch} into {target_branch or 'current branch'} in repository at {repo_path}")
        
        # Check if it's a Git repository
        repo_check = check_repository_exists(project_id, repo_path)
        if not repo_check.get("exists", False):
            return {
                "success": False,
                "project_id": project_id,
                "error": f"No valid Git repository found at {repo_path}"
            }
        
        # If target_branch is provided, check it out first
        if target_branch:
            success, _, stderr = run_git_command(
                ["git", "checkout", target_branch], 
                cwd=repo_path
            )
            
            if not success:
                return {
                    "success": False,
                    "project_id": project_id,
                    "error": f"Failed to checkout branch {target_branch}: {stderr}"
                }
        
        # Prepare merge command
        merge_cmd = ["git", "merge", source_branch]
        if message:
            merge_cmd.extend(["-m", message])
        
        # Merge branch
        success, merge_output, stderr = run_git_command(merge_cmd, cwd=repo_path)
        
        if not success:
            return {
                "success": False,
                "project_id": project_id,
                "error": f"Failed to merge branch {source_branch}: {stderr}",
                "needs_resolution": "CONFLICT" in stderr
            }
        
        return {
            "success": True,
            "project_id": project_id,
            "message": f"Branch {source_branch} merged successfully",
            "output": merge_output
        }
        
    except Exception as e:
        logger.error(f"Error merging branch: {str(e)}")
        return {
            "success": False,
            "project_id": project_id,
            "error": str(e)
        }

def delete_github_repository(repo_name: str) -> Dict[str, Any]:
    """
    Delete a repository from GitHub.
    
    Args:
        repo_name: Repository name to delete
        
    Returns:
        Dictionary with deletion result
    """
    try:
        # Get GitHub token from environment
        github_token = os.environ.get("GITHUB_TOKEN")
        github_username = os.environ.get("GIT_USER_NAME")
        
        if not github_token:
            logger.error("GITHUB_TOKEN not set in environment variables")
            return {
                "success": False,
                "error": "GitHub token not configured. Set GITHUB_TOKEN in .env file."
            }
            
        if not github_username:
            logger.error("GIT_USER_NAME not set in environment variables")
            return {
                "success": False,
                "error": "GitHub username not configured. Set GIT_USER_NAME in .env file."
            }
        
        # Create GitHub instance
        g = Github(github_token)
        user = g.get_user()
        
        # Check if repository exists
        try:
            repo = user.get_repo(repo_name)
            # If we get here, repo exists and we can delete it
            logger.info(f"Deleting GitHub repository: {repo_name}")
            repo.delete()
            return {
                "success": True,
                "message": f"Repository {repo_name} deleted from GitHub"
            }
        except GithubException as e:
            if e.status == 404:  # Not found
                logger.warning(f"Repository {repo_name} not found on GitHub")
                return {
                    "success": False,
                    "error": f"Repository {repo_name} not found on GitHub"
                }
            else:
                logger.error(f"Error deleting repository: {str(e)}")
                return {
                    "success": False,
                    "error": f"GitHub API error: {str(e)}"
                }
        
    except GithubException as e:
        logger.error(f"GitHub API error: {str(e)}")
        return {
            "success": False,
            "error": f"GitHub API error: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Error deleting GitHub repository: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def remove_local_repository(project_id: int, path: Optional[str] = None) -> Dict[str, Any]:
    """
    Remove a local Git repository.
    
    Args:
        project_id: The project ID
        path: Path to the repository (optional)
        
    Returns:
        Dictionary with removal result
    """
    try:
        # If path is not provided, use the pattern from .env
        if not path:
            work_folder_pattern = get_work_folder_pattern()
            path = work_folder_pattern.format(project_id=project_id)
        
        logger.info(f"Removing local Git repository at {path}")
        
        # Check if path exists
        if not os.path.exists(path):
            logger.warning(f"Repository path {path} does not exist")
            return {
                "success": True,
                "message": f"Repository path {path} already does not exist"
            }
        
        # Remove the directory
        shutil.rmtree(path)
        
        return {
            "success": True,
            "message": f"Local repository at {path} removed successfully"
        }
        
    except Exception as e:
        logger.error(f"Error removing local repository: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def remove_repository(project_id: int, repo_name: Optional[str] = None, local_only: bool = False) -> Dict[str, Any]:
    """
    Remove a repository both locally and from GitHub.
    
    Args:
        project_id: The project ID
        repo_name: Repository name on GitHub (optional)
        local_only: If True, only remove local repository (default: False)
        
    Returns:
        Dictionary with removal results
    """
    results = {
        "local_removed": False,
        "github_removed": False,
        "success": False
    }
    
    # Remove local repository
    local_result = remove_local_repository(project_id)
    results["local_result"] = local_result
    results["local_removed"] = local_result.get("success", False)
    
    # Also remove from GitHub if requested
    if not local_only and repo_name:
        github_result = delete_github_repository(repo_name)
        results["github_result"] = github_result
        results["github_removed"] = github_result.get("success", False)
    elif not local_only:
        # Try to determine repo name if not provided
        if not repo_name:
            repo_name = get_repo_name(project_id)
        github_result = delete_github_repository(repo_name)
        results["github_result"] = github_result
        results["github_removed"] = github_result.get("success", False)
    else:
        results["github_removed"] = None
        results["github_result"] = {"message": "GitHub removal not requested"}
    
    # Overall success if local removal succeeded
    results["success"] = results["local_removed"]
    
    return results 