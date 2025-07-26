#!/usr/bin/env python3
"""
Database core module with connection setup and helper functions
"""
import os
import sys
import importlib
import pkgutil
import inspect
from pathlib import Path
from sqlalchemy import create_engine, text, inspect as sa_inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, DeclarativeMeta
import psycopg2
from dotenv import load_dotenv

# Add parent directory to path for importing modules
parent_dir = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(parent_dir))

# Load environment variables from Global/.env
env_path = parent_dir / 'Global' / '.env'
load_dotenv(env_path)

# Get database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/vish_db")

#--------------------------------
# SQLAlchemy setup
#--------------------------------

# Create SQLAlchemy engine
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith('sqlite') else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Dependency to get database session
def get_db():
    """Get a database session to be used in FastAPI dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

#--------------------------------
# Connection utilities
#--------------------------------

def get_connection_params():
    """Extract database connection parameters from DATABASE_URL"""
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/vish_db")
    
    # Parse the URL
    # Format: postgresql://username:password@hostname:port/database
    parts = db_url.replace("postgresql://", "").split("@")
    
    if len(parts) != 2:
        raise ValueError("Invalid DATABASE_URL format")
    
    auth = parts[0].split(":")
    host_db = parts[1].split("/")
    
    if len(auth) != 2 or len(host_db) != 2:
        raise ValueError("Invalid DATABASE_URL format")
    
    username, password = auth
    
    host_port = host_db[0].split(":")
    host = host_port[0]
    port = int(host_port[1]) if len(host_port) > 1 else 5432
    
    database = host_db[1]
    
    return {
        "host": host,
        "port": port,
        "database": database,
        "user": username,
        "password": password
    }

def check_database_exists():
    """Check if the database exists, and create it if it doesn't"""
    params = get_connection_params()
    database_name = params.pop("database")
    
    # Connect to default database to check if our database exists
    params["database"] = "postgres"
    
    try:
        conn = psycopg2.connect(**params)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{database_name}'")
        exists = cursor.fetchone() is not None
        
        if not exists:
            cursor.execute(f"CREATE DATABASE {database_name}")
            print(f"Database '{database_name}' created successfully")
        else:
            print(f"Database '{database_name}' already exists")
            
        cursor.close()
        conn.close()
        return {"status": "success", "message": f"Database '{database_name}' is ready"}
    except Exception as e:
        return {"status": "error", "message": f"Error checking/creating database: {str(e)}"}

def execute_query(query, params=None, fetch=True):
    """Execute a SQL query and return results"""
    connection_params = get_connection_params()
    
    try:
        conn = psycopg2.connect(**connection_params)
        cursor = conn.cursor()
        
        cursor.execute(query, params or ())
        
        if fetch:
            result = cursor.fetchall()
        else:
            conn.commit()
            result = cursor.rowcount
            
        cursor.close()
        conn.close()
        
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def test_connection():
    """Test the database connection and return connection status"""
    try:
        # Try to connect and execute a simple query
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "success", "message": "Successfully connected to PostgreSQL database"}
    except Exception as e:
        return {"status": "error", "message": f"Database connection error: {str(e)}"}

#--------------------------------
# Model discovery and table management
#--------------------------------

def discover_models(base_path='features', verbose=False):
    """
    Automatically discover all SQLAlchemy models in the features directory
    
    Returns:
        dict: Dictionary of feature name -> list of model classes
    """
    feature_models = {}
    models_found = 0
    
    # Handle specific known features first for reliability
    try:
        # Project setup models
        if verbose:
            print("Explicitly importing project_setup models...")
        from features.project_setup.core.models import Project, ProjectEnvironment, ProjectDependency
        
        feature_models['project_setup'] = [Project, ProjectEnvironment, ProjectDependency]
        models_found += 3
        
        if verbose:
            print(f"Imported project_setup models: {[m.__name__ for m in feature_models['project_setup']]}")
    except ImportError as e:
        if verbose:
            print(f"Could not import project_setup models: {str(e)}")
    
    # Try automatic discovery for other features
    features_path = parent_dir / base_path
    if not features_path.exists():
        return {"status": "error", "message": f"Features path {features_path} not found"}, feature_models
    
    # Get all feature directories
    feature_dirs = [d for d in features_path.iterdir() if d.is_dir() and not d.name.startswith('__') and d.name != 'project_setup']
    
    for feature_dir in feature_dirs:
        feature_name = feature_dir.name
        models_path = feature_dir / 'core'
        
        if not models_path.exists() or not models_path.is_dir():
            if verbose:
                print(f"Skipping {feature_name}: No core directory found")
            continue
        
        models_file = models_path / 'models.py'
        if not models_file.exists() or not models_file.is_file():
            if verbose:
                print(f"Skipping {feature_name}: No models.py file found")
            continue
            
        try:
            # Import the models module
            module_path = f"{base_path}.{feature_name}.core.models"
            models_module = importlib.import_module(module_path)
            
            # Find all SQLAlchemy model classes in the module
            model_classes = []
            for name, obj in inspect.getmembers(models_module):
                if inspect.isclass(obj) and issubclass(obj, Base) and obj != Base:
                    model_classes.append(obj)
                    models_found += 1
            
            if model_classes:
                feature_models[feature_name] = model_classes
                if verbose:
                    print(f"Found {len(model_classes)} models in {feature_name}: {[m.__name__ for m in model_classes]}")
            else:
                if verbose:
                    print(f"No models found in {feature_name}")
            
        except ImportError as e:
            if verbose:
                print(f"Error importing models from {feature_name}: {str(e)}")
            continue
    
    if models_found > 0:
        return {"status": "success", "message": f"Found {models_found} models in {len(feature_models)} features"}, feature_models
    else:
        return {"status": "warning", "message": "No models found in any feature"}, feature_models

def import_models(model_modules=None):
    """
    Import models to register them with Base before table creation
    
    Args:
        model_modules: Optional list of model modules to import
                      (e.g., [features.users.core.models, features.products.core.models])
    """
    try:
        if model_modules:
            # Import the specified modules
            imported_modules = []
            for module in model_modules:
                if isinstance(module, str):
                    # If it's a string, try to import the module
                    imported_modules.append(__import__(module, fromlist=['']))
                # If it's already a module object, it's already imported
            return {"status": "success", "message": f"Imported {len(imported_modules)} model modules"}
        else:
            # Auto-discover models from the features directory
            result, feature_models = discover_models()
            if result["status"] != "success":
                return result
            
            return {"status": "success", "message": result["message"], "feature_models": feature_models}
            
    except ImportError as e:
        return {"status": "warning", "message": f"Could not import models: {str(e)}"}

def create_all_tables(drop_existing=False, create_only_missing=True, verbose=False):
    """
    Create all database tables for all discovered models
    
    Args:
        drop_existing: Whether to drop existing tables before creating
        create_only_missing: Whether to only create tables that don't exist yet
        verbose: Whether to print verbose output
    """
    try:
        # Discover all models
        result, feature_models = discover_models(verbose=verbose)
        if result["status"] != "success" or not feature_models:
            return result
            
        if verbose:
            print(f"Preparing to initialize tables for {len(feature_models)} features")
        
        # Get existing tables
        inspector = sa_inspect(engine)
        existing_tables = inspector.get_table_names()
        
        # Collect all model tables
        all_model_tables = []
        feature_tables = {}
        
        for feature, models in feature_models.items():
            feature_tables[feature] = []
            for model in models:
                table_name = model.__tablename__
                all_model_tables.append(table_name)
                feature_tables[feature].append(table_name)
        
        # Filter existing tables
        existing_model_tables = [t for t in all_model_tables if t in existing_tables]
        missing_tables = [t for t in all_model_tables if t not in existing_tables]
        
        if verbose:
            print(f"Found {len(existing_model_tables)} existing tables and {len(missing_tables)} missing tables")
        
        # If all tables exist and we're not dropping them
        if not missing_tables and not drop_existing:
            return {
                "status": "success", 
                "message": f"All tables already exist. No changes made.",
                "existing_tables": existing_model_tables
            }
        
        # Create tables
        if drop_existing and not create_only_missing:
            # Drop and recreate all tables - this is dangerous!
            if verbose:
                print("Dropping and recreating all tables")
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            
            return {
                "status": "success", 
                "message": f"Dropped and recreated all tables ({len(all_model_tables)} tables)",
                "tables": all_model_tables
            }
        else:
            # Create only missing tables (safer)
            if verbose:
                print(f"Creating {len(missing_tables)} missing tables")
            Base.metadata.create_all(bind=engine)
            
            return {
                "status": "success", 
                "message": f"Created {len(missing_tables)} missing tables. {len(existing_model_tables)} tables already existed.",
                "created_tables": missing_tables,
                "existing_tables": existing_model_tables,
                "feature_tables": feature_tables
            }
        
    except Exception as e:
        return {"status": "error", "message": f"Error creating database tables: {str(e)}"}

def init_db(drop_existing=False):
    """
    Initialize database tables using registered models
    
    This is a simpler version of create_all_tables for backward compatibility
    """
    try:
        # Only drop if specifically requested
        if drop_existing:
            Base.metadata.drop_all(bind=engine)
        # Always create tables
        Base.metadata.create_all(bind=engine)
        return {"status": "success", "message": "Database tables created successfully"}
    except Exception as e:
        return {"status": "error", "message": f"Error creating database tables: {str(e)}"}

#--------------------------------
# Script execution
#--------------------------------

if __name__ == "__main__":
    # When run directly, check database connection and setup
    print("\n=== PostgreSQL Database Setup and Initialization ===\n")
    
    # 1. Check if database exists
    db_check = check_database_exists()
    print(f"Database check: {db_check['status']}")
    print(db_check['message'])
    
    # 2. Test connection
    connection = test_connection()
    print(f"Connection test: {connection['status']}")
    print(connection['message'])
    
    # 3. Create tables for all discovered models
    if connection['status'] == 'success':
        print("\n--- Discovering and creating tables ---")
        
        # Explicitly import known models to ensure they're registered
        try:
            from infrastructure.db.requirement import ProjectEntity, UserFlowEntity, HighLevelRequirementEntity, LowLevelRequirementEntity, TestCaseEntity
            from infrastructure.db.waitlist import WaitlistEntity
                      
            # Print model __tablename__ values to verify registration
            print(f"Table names: {ProjectEntity.__tablename__}, {UserFlowEntity.__tablename__}, {HighLevelRequirementEntity.__tablename__}, {LowLevelRequirementEntity.__tablename__}, {TestCaseEntity.__tablename__}")
            
            # Get the SQLAlchemy tables from the metadata
            print("\nRegistered tables in metadata:")
            for table_name, table in Base.metadata.tables.items():
                print(f"  {table_name}")
            
            # Directly create all tables
            print("\nDirect table creation:")
            Base.metadata.create_all(bind=engine)
            print("Tables created directly with Base.metadata.create_all()")
            
        except ImportError as e:
            print(f"Could not import models from project_setup: {str(e)}")
        
        # Use the automatic discovery and creation process
        print("\nAutomatic table discovery and creation:")
        result = create_all_tables(
            drop_existing=False,   # Don't drop existing tables for safety
            create_only_missing=True,  # Only create tables that don't exist
            verbose=True  # Print verbose output
        )
        
        print(f"\nTable creation: {result['status']}")
        print(result['message'])
        
        if result['status'] == 'success' and 'feature_tables' in result:
            print("\nTables by feature:")
            for feature, tables in result['feature_tables'].items():
                print(f"  {feature}: {', '.join(tables)}")
    
    print("\n=== Setup complete ===") 