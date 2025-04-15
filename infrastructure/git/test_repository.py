"""
Test Git repository operations.
This script provides tests for Git repository operations used in the application.
"""

import os
import logging
import sys
import argparse
import shutil
from dotenv import load_dotenv
from infrastructure.git.repository import (
    get_repo_name,
    check_repository_exists,
    create_repository,
    clone_repository,
    commit_changes,
    push_changes,
    pull_changes,
    merge_branch,
    create_github_repository,
    remove_repository,
    delete_github_repository
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(dotenv_path="global/.env")

def test_get_repo_name(project_id=999):
    """Test generating repository name for a project."""
    logger.info(f"\n=== Testing Get Repository Name for Project {project_id} ===")
    
    # Get repository name
    repo_name = get_repo_name(project_id)
    
    logger.info(f"Repository name for project {project_id}: {repo_name}")
    return True

def test_create_repository(project_id=999, repo_name=None, cleanup=False):
    """Test creating a Git repository."""
    logger.info(f"\n=== Testing Create Repository for Project {project_id} ===")
    
    # Use a specific repo name if provided, otherwise create one
    if not repo_name:
        repo_name = f"test-project-{project_id}"
    
    # Create repository
    result = create_repository(
        project_id=project_id,
        repo_name=repo_name,
        remote_url=f"https://github.com/gauravm26/{repo_name}.git"
    )
    
    # Log the entire result for debugging
    logger.info(f"Full result: {result}")
    
    if result.get("success"):
        logger.info(f"Repository created successfully at: {result.get('repository_path')}")
        
        # Clean up the repository if requested
        if cleanup:
            repo_path = result.get('repository_path')
            if repo_path and os.path.exists(repo_path):
                logger.info(f"Cleaning up repository at {repo_path}")
                shutil.rmtree(repo_path)
                
        return True
    else:
        logger.error(f"Failed to create repository: {result.get('error')}")
        return False

def test_check_repository(project_id=999):
    """Test checking if a repository exists."""
    logger.info(f"\n=== Testing Check Repository for Project {project_id} ===")
    
    # Check repository
    result = check_repository_exists(project_id)
    
    if result.get("exists"):
        logger.info(f"Repository exists at: {result.get('repository_path')}")
        logger.info(f"Current branch: {result.get('current_branch')}")
        logger.info(f"Remotes: {result.get('remotes')}")
        return True
    else:
        logger.info(f"Repository does not exist for project {project_id}")
        return False

def test_clone_repository(project_id=999, remote_url=None):
    """Test cloning a repository."""
    logger.info(f"\n=== Testing Clone Repository for Project {project_id} ===")
    
    # Clone repository
    result = clone_repository(project_id, remote_url)
    
    if result.get("success"):
        logger.info(f"Repository cloned successfully to: {result.get('clone_path')}")
        return True
    else:
        logger.error(f"Failed to clone repository: {result.get('error')}")
        return False

def test_repository_workflow(project_id=999, cleanup=True):
    """Test the full Git repository workflow."""
    logger.info(f"\n=== Testing Full Repository Workflow for Project {project_id} ===")
    
    try:
        # Test creating a repository
        create_result = create_repository(project_id)
        if not create_result.get("success"):
            logger.error("Failed to create repository")
            return False
        
        repo_path = create_result.get("repository_path")
        logger.info(f"Repository created at: {repo_path}")
        
        # Test adding a file and committing changes
        test_file_path = os.path.join(repo_path, "test_file.txt")
        with open(test_file_path, "w") as f:
            f.write("This is a test file.")
        
        commit_result = commit_changes(
            project_id=project_id,
            repo_path=repo_path,
            message="Add test file",
            files=["test_file.txt"]
        )
        
        if not commit_result.get("success"):
            logger.error(f"Failed to commit changes: {commit_result.get('error')}")
            return False
        
        logger.info(f"Changes committed: {commit_result.get('message')}")
        
        # Clean up the repository if requested
        if cleanup:
            if repo_path and os.path.exists(repo_path):
                logger.info(f"Cleaning up repository at {repo_path}")
                shutil.rmtree(repo_path)
        
        return True
    
    except Exception as e:
        logger.error(f"Error testing repository workflow: {str(e)}")
        return False

def test_github_repository(project_id=999, repo_name=None):
    """Test creating a GitHub repository directly."""
    logger.info(f"\n=== Testing GitHub Repository Creation for Project {project_id} ===")
    
    if not repo_name:
        repo_name = f"project-{project_id}"
    
    result = create_github_repository(
        name=repo_name,
        description=f"Test repository for project {project_id}"
    )
    
    if result.get("success"):
        logger.info(f"GitHub repository created: {result.get('repo_url')}")
        logger.info(f"HTML URL: {result.get('html_url')}")
        return True
    else:
        logger.error(f"Failed to create GitHub repository: {result.get('error')}")
        return False

def test_remove_repository(repo_name=None, project_id=None, local_only=False):
    """Test removing a repository."""
    if repo_name:
        logger.info(f"\n=== Testing Remove Repository: {repo_name} ===")
    elif project_id:
        logger.info(f"\n=== Testing Remove Repository for Project ID: {project_id} ===")
    else:
        logger.error("Either repo_name or project_id must be provided")
        return False
    
    if project_id is None:
        # Use a dummy project ID if only repo_name is provided
        project_id = 999
    
    # Remove repository
    result = remove_repository(
        project_id=project_id, 
        repo_name=repo_name,
        local_only=local_only
    )
    
    logger.info(f"Full result: {result}")
    
    if result.get("success"):
        if result.get("local_removed"):
            logger.info("Local repository removed successfully")
        
        if result.get("github_removed"):
            logger.info("GitHub repository removed successfully")
        elif result.get("github_removed") is False:
            logger.warning("Failed to remove GitHub repository")
        
        return True
    else:
        logger.error(f"Failed to remove repository: {result.get('error')}")
        return False

def main():
    """Run the repository tests based on command-line arguments."""
    parser = argparse.ArgumentParser(description="Test Git repository operations.")
    parser.add_argument("--create", action="store_true", help="Test create repository")
    parser.add_argument("--clone", action="store_true", help="Test clone repository")
    parser.add_argument("--commit", action="store_true", help="Test commit changes")
    parser.add_argument("--push", action="store_true", help="Test push changes")
    parser.add_argument("--pull", action="store_true", help="Test pull changes")
    parser.add_argument("--merge", action="store_true", help="Test merge branch")
    parser.add_argument("--workflow", action="store_true", help="Test full workflow")
    parser.add_argument("--github", action="store_true", help="Test GitHub repository creation")
    parser.add_argument("--remove", action="store_true", help="Test repository removal")
    parser.add_argument("--local-only", action="store_true", help="Only remove local repository")
    parser.add_argument("--project-id", type=int, default=999, help="Project ID to use for testing")
    parser.add_argument("--repo-name", type=str, help="Repository name to use for GitHub test")
    parser.add_argument("--no-cleanup", action="store_true", help="Don't clean up after tests")
    
    args = parser.parse_args()
    
    # Default to running all tests if none specified
    run_all = not any([
        args.create, args.clone, args.commit, args.push, 
        args.pull, args.merge, args.workflow, args.github,
        args.remove
    ])
    
    cleanup = not args.no_cleanup
    results = {}
    
    if args.remove:
        results['remove_repository'] = test_remove_repository(args.repo_name, args.project_id, args.local_only)
    
    if args.github or run_all:
        results['github_repository'] = test_github_repository(args.project_id, args.repo_name)
    
    if args.create or run_all:
        results['create_repository'] = test_create_repository(args.project_id, args.repo_name, cleanup)
        
    if args.clone or run_all:
        results['clone_repository'] = test_clone_repository(args.project_id, cleanup)
        
    if args.commit or run_all:
        results['commit_changes'] = test_commit_changes(args.project_id, cleanup)
        
    if args.push or run_all:
        results['push_changes'] = test_push_changes(args.project_id, cleanup)
        
    if args.pull or run_all:
        results['pull_changes'] = test_pull_changes(args.project_id, cleanup)
        
    if args.merge or run_all:
        results['merge_branch'] = test_merge_branch(args.project_id, cleanup)
        
    if args.workflow or run_all:
        results['repository_workflow'] = test_repository_workflow(args.project_id, cleanup)
    
    # Print results summary
    logger.info("\n=== Test Results Summary ===")
    for test_name, result in results.items():
        logger.info(f"{test_name.replace('_', ' ').title()}: {'PASS' if result else 'FAIL'}")
    
    # Return 0 if all tests passed, otherwise 1
    return 0 if all(results.values()) else 1

if __name__ == "__main__":
    sys.exit(main()) 