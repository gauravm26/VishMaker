"""
Refresh database schema with our updated models.
This script explicitly imports our models and recreates the database tables.
"""

import sys
from pathlib import Path
import logging
from sqlalchemy import text

# Add project root to path for imports
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(project_root))

from infrastructure.db.db_core import engine, Base
from shared.core.models.project import Project
from shared.core.models.requirement import UserFlow, HighLevelRequirement, LowLevelRequirement, TestCase

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def refresh_schema():
    """Drop all tables and recreate them based on our updated models."""
    try:
        logger.info("Dropping existing tables...")
        
        # Drop tables in correct order to avoid constraint violations
        tables = [
            "test_cases",
            "low_level_requirements",
            "high_level_requirements",
            "flow_steps",
            "user_flows",
            "projects"
        ]
        
        with engine.begin() as conn:
            for table in tables:
                try:
                    conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                    logger.info(f"Dropped table: {table}")
                except Exception as e:
                    logger.warning(f"Error dropping table {table}: {str(e)}")
        
        logger.info("Creating tables based on updated models...")
        # Create all tables based on the updated models
        Base.metadata.create_all(engine)
        logger.info("Schema refresh completed successfully!")
        
    except Exception as e:
        logger.error(f"Schema refresh failed: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        # Warning prompt
        print("WARNING: This will DROP ALL TABLES and create new ones.")
        print("All existing data will be lost.")
        confirmation = input("Are you sure you want to proceed? (yes/no): ")
        
        if confirmation.lower() == "yes":
            refresh_schema()
            print("Schema refresh completed. The database has been reset with the new structure.")
        else:
            print("Operation cancelled.")
    except Exception as e:
        logger.error(f"Schema refresh failed: {str(e)}")
        sys.exit(1) 