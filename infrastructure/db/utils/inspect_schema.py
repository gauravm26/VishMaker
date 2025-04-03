"""
Utility script to inspect the current database schema.
"""

import sys
from pathlib import Path
import logging
from sqlalchemy import inspect, text

# Add project root to path for imports
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(project_root))

from infrastructure.db.db_core import engine

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def inspect_schema():
    """Inspect and print the current database schema."""
    try:
        inspector = inspect(engine)
        
        # Get list of tables
        tables = inspector.get_table_names()
        print("Tables in the database:")
        for table in tables:
            print(f"- {table}")
            
            # Get columns for each table
            columns = inspector.get_columns(table)
            print("  Columns:")
            for column in columns:
                print(f"    - {column['name']} ({column['type']})")
            
            # Get foreign keys for each table
            foreign_keys = inspector.get_foreign_keys(table)
            if foreign_keys:
                print("  Foreign Keys:")
                for fk in foreign_keys:
                    print(f"    - {fk['constrained_columns']} → {fk['referred_table']}.{fk['referred_columns']}")
            
            print()  # Add a blank line between tables
            
    except Exception as e:
        logger.error(f"Schema inspection failed: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        inspect_schema()
    except Exception as e:
        logger.error(f"Schema inspection failed: {str(e)}")
        sys.exit(1) 