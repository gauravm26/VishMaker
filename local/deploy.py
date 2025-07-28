#!/usr/bin/env python3
"""
VishMaker AWS Infrastructure Deployment Script.
This script provides a command-line interface for deploying and managing AWS infrastructure.
"""

import sys
import os
import argparse
import logging
import json
from typing import Dict, Any

# Add the project root to Python path (parent of local directory)
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from infrastructure.aws.deployment_manager import DeploymentManager, deploy_environment, get_environment_status
from infrastructure.aws.environment_config import (
    get_environment_config, 
    list_available_environments, 
    validate_environment_config,
    env_manager
)
from infrastructure.aws.sam_templates import generate_vish_maker_template, save_template_as_yaml

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_logging(verbose: bool = False):
    """Setup logging configuration."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        force=True
    )

def print_banner():
    """Print deployment script banner."""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                    VishMaker AWS Deployment                  ║
║              Infrastructure as Code Management               ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)

def validate_environment_name(environment: str):
    """Validate environment name."""
    available_envs = list_available_environments()
    if environment not in available_envs:
        logger.error(f"Invalid environment '{environment}'. Available: {', '.join(available_envs)}")
        sys.exit(1)

def cmd_validate(args):
    """Validate environment configuration and AWS setup."""
    print_banner()
    logger.info(f"Validating {args.environment} environment...")
    
    validate_environment_name(args.environment)
    
    # Validate environment configuration
    config_validation = validate_environment_config(args.environment)
    
    logger.info("=== Configuration Validation ===")
    if config_validation["valid"]:
        logger.info("✓ Environment configuration is valid")
    else:
        logger.error("✗ Environment configuration has errors:")
        for error in config_validation["errors"]:
            logger.error(f"  - {error}")
    
    if config_validation["warnings"]:
        logger.warning("Configuration warnings:")
        for warning in config_validation["warnings"]:
            logger.warning(f"  - {warning}")
    
    # Validate AWS environment
    manager = DeploymentManager(args.environment)
    aws_validation = manager.validate_environment()
    
    logger.info("\n=== AWS Environment Validation ===")
    if aws_validation["valid"]:
        logger.info("✓ AWS environment is ready for deployment")
        logger.info(f"  - AWS Region: {manager.region}")
        logger.info(f"  - Account ID: {manager.account_id}")
    else:
        logger.error("✗ AWS environment validation failed:")
        for error in aws_validation["errors"]:
            logger.error(f"  - {error}")
    
    overall_valid = config_validation["valid"] and aws_validation["valid"]
    
    if overall_valid:
        logger.info("\n✓ Environment is ready for deployment!")
        return 0
    else:
        logger.error("\n✗ Environment validation failed. Please fix the issues above.")
        return 1

def cmd_generate_template(args):
    """Generate SAM template for the environment."""
    print_banner()
    logger.info(f"Generating SAM template for {args.environment} environment...")
    
    validate_environment_name(args.environment)
    
    try:
        # Generate template
        template = generate_vish_maker_template(args.environment)
        
        # Create output directory
        output_dir = args.output or f"infrastructure/templates/{args.environment}"
        os.makedirs(output_dir, exist_ok=True)
        
        # Save template
        template_path = os.path.join(output_dir, "template.yaml")
        if save_template_as_yaml(template, template_path):
            logger.info(f"✓ SAM template saved to: {template_path}")
            
            # Also save as JSON if requested
            if args.json:
                json_path = os.path.join(output_dir, "template.json")
                with open(json_path, 'w') as f:
                    json.dump(template, f, indent=2)
                logger.info(f"✓ SAM template also saved as JSON to: {json_path}")
            
            return 0
        else:
            logger.error("✗ Failed to save SAM template")
            return 1
    
    except Exception as e:
        logger.error(f"✗ Error generating template: {str(e)}")
        return 1

def cmd_deploy(args):
    """Deploy infrastructure to AWS."""
    print_banner()
    logger.info(f"Deploying {args.environment} environment to AWS...")
    
    validate_environment_name(args.environment)
    
    # Validate before deployment if not skipped
    if not args.skip_validation:
        logger.info("Validating environment before deployment...")
        manager = DeploymentManager(args.environment)
        validation = manager.validate_environment()
        
        if not validation["valid"]:
            logger.error("Environment validation failed. Use --skip-validation to bypass.")
            for error in validation["errors"]:
                logger.error(f"  - {error}")
            return 1
    
    # Confirm deployment for production
    if args.environment == "prod" and not args.yes:
        confirmation = input("⚠️  You are about to deploy to PRODUCTION. Are you sure? (yes/no): ")
        if confirmation.lower() != "yes":
            logger.info("Deployment cancelled.")
            return 0
    
    # Perform deployment
    try:
        result = deploy_environment(args.environment)
        
        if result["success"]:
            logger.info(f"✓ Deployment completed successfully!")
            logger.info(f"  Duration: {result.get('duration_seconds', 0):.2f} seconds")
            
            # Show deployment summary
            logger.info("\n=== Deployment Summary ===")
            for step_name, step_result in result.get("steps", {}).items():
                status = "✓" if step_result.get("success", False) else "✗"
                logger.info(f"{status} {step_name.replace('_', ' ').title()}")
            
            return 0
        else:
            logger.error(f"✗ Deployment failed!")
            if result.get("errors"):
                for error in result["errors"]:
                    logger.error(f"  - {error}")
            return 1
    
    except Exception as e:
        logger.error(f"✗ Deployment error: {str(e)}")
        return 1

def cmd_status(args):
    """Get deployment status."""
    print_banner()
    logger.info(f"Getting status for {args.environment} environment...")
    
    validate_environment_name(args.environment)
    
    try:
        status = get_environment_status(args.environment)
        
        logger.info(f"\n=== {args.environment.upper()} Environment Status ===")
        logger.info(f"Region: {status.get('region', 'unknown')}")
        logger.info(f"Account ID: {status.get('account_id', 'unknown')}")
        logger.info(f"Timestamp: {status.get('timestamp', 'unknown')}")
        
        logger.info("\n=== Services Status ===")
        services = status.get('services', {})
        
        for service_name, service_info in services.items():
            service_status = service_info.get('status', 'unknown')
            status_icon = "✓" if service_status == "deployed" else "✗"
            logger.info(f"{status_icon} {service_name.upper()}: {service_status}")
            
            # Show resource counts
            if service_name == "dynamodb" and service_info.get('tables'):
                logger.info(f"    Tables ({service_info.get('table_count', 0)}):")
                for table in service_info.get('tables', [])[:5]:
                    logger.info(f"      - {table}")
                if service_info.get('table_count', 0) > 5:
                    logger.info(f"      ... and {service_info.get('table_count', 0) - 5} more")
            
            elif service_name == "lambda" and service_info.get('functions'):
                logger.info(f"    Functions ({service_info.get('function_count', 0)}):")
                for func in service_info.get('functions', [])[:5]:
                    logger.info(f"      - {func}")
                if service_info.get('function_count', 0) > 5:
                    logger.info(f"      ... and {service_info.get('function_count', 0) - 5} more")
            
            elif service_name == "api_gateway" and service_info.get('apis'):
                logger.info(f"    APIs ({service_info.get('api_count', 0)}):")
                for api in service_info.get('apis', []):
                    logger.info(f"      - {api}")
        
        # Output JSON if requested
        if args.json:
            print("\n=== JSON Output ===")
            print(json.dumps(status, indent=2))
        
        return 0
    
    except Exception as e:
        logger.error(f"✗ Error getting status: {str(e)}")
        return 1

def cmd_list_environments(args):
    """List available environments."""
    print_banner()
    logger.info("Available environments:")
    
    environments = list_available_environments()
    for env in environments:
        logger.info(f"  - {env}")
        
        # Show environment configuration summary
        try:
            config = get_environment_config(env)
            logger.info(f"    Region: {config.aws_resources.region}")
            logger.info(f"    Lambda Memory: {config.aws_resources.lambda_memory}MB")
            logger.info(f"    DynamoDB Billing: {config.aws_resources.dynamodb_billing_mode}")
        except Exception as e:
            logger.info(f"    (Error loading config: {str(e)})")
    
    return 0

def cmd_export_config(args):
    """Export environment configurations."""
    print_banner()
    logger.info("Exporting environment configurations...")
    
    try:
        if env_manager.export_all_configs():
            logger.info("✓ All environment configurations exported successfully")
            return 0
        else:
            logger.error("✗ Failed to export some configurations")
            return 1
    
    except Exception as e:
        logger.error(f"✗ Error exporting configurations: {str(e)}")
        return 1

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="VishMaker AWS Infrastructure Deployment Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Validate environment
  python infrastructure/deploy.py validate --environment dev

  # Generate SAM template
  python infrastructure/deploy.py generate-template --environment dev

  # Deploy to development
  python infrastructure/deploy.py deploy --environment dev

  # Get deployment status
  python infrastructure/deploy.py status --environment dev

  # Deploy to production (with confirmation)
  python infrastructure/deploy.py deploy --environment prod
        """
    )
    
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate environment configuration and AWS setup')
    validate_parser.add_argument('--environment', '-e', required=True, help='Environment name (dev, staging, prod)')
    
    # Generate template command
    template_parser = subparsers.add_parser('generate-template', help='Generate SAM template for environment')
    template_parser.add_argument('--environment', '-e', required=True, help='Environment name (dev, staging, prod)')
    template_parser.add_argument('--output', '-o', help='Output directory for template files')
    template_parser.add_argument('--json', action='store_true', help='Also save template as JSON')
    
    # Deploy command
    deploy_parser = subparsers.add_parser('deploy', help='Deploy infrastructure to AWS')
    deploy_parser.add_argument('--environment', '-e', required=True, help='Environment name (dev, staging, prod)')
    deploy_parser.add_argument('--skip-validation', action='store_true', help='Skip environment validation')
    deploy_parser.add_argument('--yes', '-y', action='store_true', help='Auto-confirm deployment (for automation)')
    
    # Status command
    status_parser = subparsers.add_parser('status', help='Get deployment status')
    status_parser.add_argument('--environment', '-e', required=True, help='Environment name (dev, staging, prod)')
    status_parser.add_argument('--json', action='store_true', help='Output status as JSON')
    
    # List environments command
    subparsers.add_parser('list-environments', help='List available environments')
    
    # Export config command
    subparsers.add_parser('export-config', help='Export environment configurations to files')
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.verbose)
    
    # Handle commands
    if args.command == 'validate':
        return cmd_validate(args)
    elif args.command == 'generate-template':
        return cmd_generate_template(args)
    elif args.command == 'deploy':
        return cmd_deploy(args)
    elif args.command == 'status':
        return cmd_status(args)
    elif args.command == 'list-environments':
        return cmd_list_environments(args)
    elif args.command == 'export-config':
        return cmd_export_config(args)
    else:
        parser.print_help()
        return 1

if __name__ == '__main__':
    sys.exit(main()) 