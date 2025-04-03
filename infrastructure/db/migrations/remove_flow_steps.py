"""
Migration script to remove flow_steps table and connect high_level_requirements directly to user_flows.
This script should be run to migrate existing data to the new schema.
"""

import sys
from pathlib import Path
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Add project root to path for imports
project_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.append(str(project_root))

from infrastructure.db.db_core import engine, get_connection_params

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def migrate():
    """Execute the schema migration and data transition."""
    try:
        # Use the existing engine from db_core
        conn = engine.connect()
        
        # Begin transaction
        trans = conn.begin()
        
        try:
            logger.info("Starting migration: Removing flow_steps and updating high_level_requirements")
            
            # 1. Add user_flow_id column to high_level_requirements
            logger.info("Adding user_flow_id column to high_level_requirements table")
            conn.execute(text("""
                ALTER TABLE high_level_requirements 
                ADD COLUMN user_flow_id INTEGER
            """))
            
            # 2. Add order column to high_level_requirements if it doesn't exist
            logger.info("Adding order column to high_level_requirements table")
            conn.execute(text("""
                ALTER TABLE high_level_requirements 
                ADD COLUMN "order" INTEGER DEFAULT 0 NOT NULL
            """))
            
            # 3. Migrate the data - set user_flow_id based on the relationship chain
            logger.info("Migrating data: setting user_flow_id values based on flow_steps")
            conn.execute(text("""
                UPDATE high_level_requirements hlr
                SET user_flow_id = (
                    SELECT fs.user_flow_id 
                    FROM flow_steps fs 
                    WHERE fs.id = hlr.flow_step_id
                )
            """))
            
            # 4. Create not null constraint for user_flow_id
            logger.info("Adding NOT NULL constraint to user_flow_id")
            conn.execute(text("""
                ALTER TABLE high_level_requirements 
                ALTER COLUMN user_flow_id SET NOT NULL
            """))
            
            # 5. Create index on user_flow_id
            logger.info("Creating index on user_flow_id")
            conn.execute(text("""
                CREATE INDEX idx_hlr_user_flow_id ON high_level_requirements(user_flow_id)
            """))
            
            # 6. Add foreign key constraint
            logger.info("Adding foreign key constraint for user_flow_id")
            conn.execute(text("""
                ALTER TABLE high_level_requirements 
                ADD CONSTRAINT fk_hlr_user_flow 
                FOREIGN KEY (user_flow_id) REFERENCES user_flows(id)
            """))
            
            # 7. Drop foreign key from flow_step_id first (we need to know the constraint name)
            logger.info("Getting foreign key constraint name for flow_step_id")
            fk_result = conn.execute(text("""
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'high_level_requirements'::regclass
                AND contype = 'f'
                AND confrelid = 'flow_steps'::regclass
            """))
            
            fk_name = fk_result.fetchone()[0]
            logger.info(f"Dropping foreign key constraint: {fk_name}")
            
            conn.execute(text(f"""
                ALTER TABLE high_level_requirements 
                DROP CONSTRAINT {fk_name}
            """))
            
            # 8. Drop flow_step_id column
            logger.info("Dropping flow_step_id column")
            conn.execute(text("""
                ALTER TABLE high_level_requirements 
                DROP COLUMN flow_step_id
            """))
            
            # 9. Drop flow_steps table
            logger.info("Dropping flow_steps table")
            conn.execute(text("""
                DROP TABLE flow_steps
            """))
            
            # Commit all changes
            trans.commit()
            logger.info("Migration completed successfully")
            
        except SQLAlchemyError as e:
            trans.rollback()
            logger.error(f"Migration failed: {str(e)}")
            raise
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        sys.exit(1) 