import json
import os
import sys
import boto3
from pathlib import Path

def get_secret(secret_arn):
    """Get secret from AWS Secrets Manager"""
    client = boto3.client('secretsmanager')
    try:
        response = client.get_secret_value(SecretId=secret_arn)
        if 'SecretString' in response:
            return json.loads(response['SecretString'])
        return None
    except Exception as e:
        print(f"Error getting secret: {e}")
        return None

def get_database_url():
    """Get database URL from Secrets Manager"""
    secret_arn = os.environ.get('DATABASE_SECRET_ARN')
    if not secret_arn:
        raise ValueError("DATABASE_SECRET_ARN environment variable not set")
    
    secret = get_secret(secret_arn)
    if not secret:
        raise ValueError("Could not retrieve database secret")
    
    db_endpoint = os.environ.get('DB_ENDPOINT')
    db_name = os.environ.get('DB_NAME')
    db_username = os.environ.get('DB_USERNAME')
    
    return f"postgresql://{db_username}:{secret}@{db_endpoint}/{db_name}"

def handler(event, context):
    print("Projects Lambda invoked!")
    print(f"Event: {json.dumps(event)}")
    
    try:
        # Get database URL from Secrets Manager
        database_url = get_database_url()
        
        # Set up database connection and initialize tables
        setup_database(database_url)
        
        # Parse the API Gateway event
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '/')
        
        # Route the request based on the path and method
        if http_method == 'GET' and path.startswith('/projects'):
            return handle_get_projects()
        elif http_method == 'POST' and path.startswith('/projects'):
            return handle_create_project(event)
        elif http_method == 'PUT' and path.startswith('/projects/'):
            return handle_update_project(event)
        elif http_method == 'DELETE' and path.startswith('/projects/'):
            return handle_delete_project(event)
        else:
            return {
                "statusCode": 404,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Endpoint not found"})
            }
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Internal server error: {str(e)}"})
        }

def setup_database(database_url):
    """Set up database connection and ensure tables exist"""
    try:
        # Set the DATABASE_URL environment variable
        os.environ['DATABASE_URL'] = database_url
        
        # Import database initialization function
        from db.db_core import init_db, test_connection
        
        # Test connection
        test_connection()
        
        # Initialize database tables (create if they don't exist)
        init_db(drop_existing=False)
        
        print("Database setup completed successfully")
        
    except Exception as e:
        print(f"Database setup error: {str(e)}")
        raise

def handle_get_projects():
    """Handle GET /projects - List all projects"""
    try:
        from db.db_core import SessionLocal
        from db.requirement import ProjectEntity
        
        db = SessionLocal()
        projects = db.query(ProjectEntity).all()
        
        project_list = []
        for project in projects:
            project_list.append({
                "id": project.id,
                "name": project.name,
                "initial_prompt": project.initial_prompt,
                "created_at": project.created_at.isoformat() if project.created_at else None,
                "updated_at": project.updated_at.isoformat() if project.updated_at else None
            })
        
        db.close()
        
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"projects": project_list})
        }
        
    except Exception as e:
        print(f"Error getting projects: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Failed to get projects: {str(e)}"})
        }

def handle_create_project(event):
    """Handle POST /projects - Create a new project"""
    try:
        from db.db_core import SessionLocal
        from db.requirement import ProjectEntity
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        name = body.get('name')
        initial_prompt = body.get('initial_prompt')
        
        if not name:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Project name is required"})
            }
        
        db = SessionLocal()
        new_project = ProjectEntity(
            name=name,
            initial_prompt=initial_prompt
        )
        
        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        
        project_data = {
            "id": new_project.id,
            "name": new_project.name,
            "initial_prompt": new_project.initial_prompt,
            "created_at": new_project.created_at.isoformat() if new_project.created_at else None
        }
        
        db.close()
        
        return {
            "statusCode": 201,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"project": project_data})
        }
        
    except Exception as e:
        print(f"Error creating project: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Failed to create project: {str(e)}"})
        }

def handle_update_project(event):
    """Handle PUT /projects/{id} - Update a project"""
    try:
        from db.db_core import SessionLocal
        from db.requirement import ProjectEntity
        
        # Extract project ID from path
        path_parts = event.get('path', '').split('/')
        project_id = path_parts[-1] if len(path_parts) > 2 else None
        
        if not project_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Project ID is required"})
            }
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        db = SessionLocal()
        project = db.query(ProjectEntity).filter(ProjectEntity.id == int(project_id)).first()
        
        if not project:
            db.close()
            return {
                "statusCode": 404,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Project not found"})
            }
        
        # Update fields
        if 'name' in body:
            project.name = body['name']
        if 'initial_prompt' in body:
            project.initial_prompt = body['initial_prompt']
        
        db.commit()
        db.refresh(project)
        
        project_data = {
            "id": project.id,
            "name": project.name,
            "initial_prompt": project.initial_prompt,
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "updated_at": project.updated_at.isoformat() if project.updated_at else None
        }
        
        db.close()
        
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"project": project_data})
        }
        
    except Exception as e:
        print(f"Error updating project: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Failed to update project: {str(e)}"})
        }

def handle_delete_project(event):
    """Handle DELETE /projects/{id} - Delete a project"""
    try:
        from db.db_core import SessionLocal
        from db.requirement import ProjectEntity
        
        # Extract project ID from path
        path_parts = event.get('path', '').split('/')
        project_id = path_parts[-1] if len(path_parts) > 2 else None
        
        if not project_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Project ID is required"})
            }
        
        db = SessionLocal()
        project = db.query(ProjectEntity).filter(ProjectEntity.id == int(project_id)).first()
        
        if not project:
            db.close()
            return {
                "statusCode": 404,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Project not found"})
            }
        
        db.delete(project)
        db.commit()
        db.close()
        
        return {
            "statusCode": 204,
            "headers": {"Content-Type": "application/json"},
            "body": ""
        }
        
    except Exception as e:
        print(f"Error deleting project: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Failed to delete project: {str(e)}"})
        } 