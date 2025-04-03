"""
Create a fresh database schema based on the updated models.
This approach is simpler than trying to alter the existing tables.
NOTE: This will DROP and recreate all tables, so it will result in data loss.
"""

import sys
from pathlib import Path
import logging

# Add project root to path for imports
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(project_root))

from infrastructure.db.db_core import engine, Base, create_all_tables, discover_models

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_fresh_schema():
    """Create a fresh database schema from scratch."""
    try:
        logger.info("Creating all tables with the new schema...")
        # Drop all existing tables and create new ones
        create_all_tables(drop_existing=True, create_only_missing=False, verbose=True)
        logger.info("Schema creation completed successfully!")
        
    except Exception as e:
        logger.error(f"Schema creation failed: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        # Warning prompt
        print("WARNING: This will DROP ALL TABLES and create new ones.")
        print("All existing data will be lost.")
        confirmation = input("Are you sure you want to proceed? (yes/no): ")
        
        if confirmation.lower() == "yes":
            create_fresh_schema()
            print("Schema creation completed. The database has been reset with the new structure.")
        else:
            print("Operation cancelled.")
    except Exception as e:
        logger.error(f"Schema creation failed: {str(e)}")
        sys.exit(1) 