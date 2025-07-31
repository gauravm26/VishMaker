import json
import logging
import boto3
import uuid
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException, Depends
from mangum import Mangum
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from dynamodb.code.schemas import ProjectCreate, ProjectUpdate, Project

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
table_name = None  # Will be set from environment variable

app = FastAPI(
    title="VishMaker Projects API",
    description="Project management service for VishMaker",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://vishmaker.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Pydantic models are now imported from dynamodb.code.schemas

def get_table():
    """Get DynamoDB table instance"""
    global table_name
    if table_name is None:
        # Get table name from environment variable
        import os
        table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'prod-vishmaker-projects')
    return dynamodb.Table(table_name)

@app.get("/")
def root():
    """Health check endpoint"""
    return {"message": "Projects API is running", "status": "healthy"}

@app.post("/projects", response_model=Project, status_code=201)
def create_project(project: ProjectCreate):
    """Create a new project"""
    try:
        # Debug logging
        logger.info(f"🔍 Received project data: name={project.name}, user_id={project.user_id}, type(user_id)={type(project.user_id)}")
        
        table = get_table()
        project_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        
        item = {
            'id': project_id,
            'name': project.name,
            'initial_prompt': project.initial_prompt,
            'user_id': project.user_id,
            'created_at': timestamp,
            'updated_at': timestamp
        }
        
        logger.info(f"🔍 Item to be inserted: {item}")
        
        table.put_item(Item=item)
        logger.info(f"✅ Project created: {project_id}")
        
        return Project(**item)
        
    except Exception as e:
        logger.error(f"❌ Error creating project: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

@app.get("/projects", response_model=List[Project])
def get_projects(skip: int = 0, limit: int = 100, user_id: Optional[str] = None):
    """Get all projects with optional filtering by user_id"""
    try:
        table = get_table()
        
        if user_id:
            # Query by user_id if provided
            response = table.query(
                IndexName='user_id-index',  # Assuming you have a GSI on user_id
                KeyConditionExpression='user_id = :user_id',
                ExpressionAttributeValues={':user_id': user_id},
                Limit=limit
            )
        else:
            # Scan all projects
            scan_params = {'Limit': limit}
            if skip > 0:
                scan_params['ExclusiveStartKey'] = {'id': str(skip)}
            
            response = table.scan(**scan_params)
        
        projects = [Project(**item) for item in response.get('Items', [])]
        logger.info(f"✅ Retrieved {len(projects)} projects")
        
        return projects
        
    except Exception as e:
        logger.error(f"❌ Error retrieving projects: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve projects: {str(e)}")

@app.get("/projects/{project_id}", response_model=Project)
def get_project(project_id: str):
    """Get a specific project by ID"""
    try:
        table = get_table()
        response = table.get_item(Key={'id': project_id})
        
        if 'Item' not in response:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project = Project(**response['Item'])
        logger.info(f"✅ Retrieved project: {project_id}")
        
        return project
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error retrieving project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve project: {str(e)}")

@app.put("/projects/{project_id}", response_model=Project)
def update_project(project_id: str, project_update: ProjectUpdate):
    """Update an existing project"""
    try:
        table = get_table()
        
        # Build update expression
        update_expression = "SET updated_at = :updated_at"
        expression_attribute_values = {':updated_at': datetime.utcnow().isoformat()}
        
        if project_update.name is not None:
            update_expression += ", #name = :name"
            expression_attribute_values[':name'] = project_update.name
            expression_attribute_names = {'#name': 'name'}
        
        if project_update.initial_prompt is not None:
            update_expression += ", initial_prompt = :initial_prompt"
            expression_attribute_values[':initial_prompt'] = project_update.initial_prompt
        
        # Update the item
        response = table.update_item(
            Key={'id': project_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_attribute_values,
            ExpressionAttributeNames=expression_attribute_names if 'expression_attribute_names' in locals() else None,
            ReturnValues="ALL_NEW"
        )
        
        project = Project(**response['Attributes'])
        logger.info(f"✅ Updated project: {project_id}")
        
        return project
        
    except table.meta.client.exceptions.ResourceNotFoundException:
        raise HTTPException(status_code=404, detail="Project not found")
    except Exception as e:
        logger.error(f"❌ Error updating project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(e)}")

@app.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str):
    """Delete a project by ID"""
    try:
        table = get_table()
        table.delete_item(Key={'id': project_id})
        
        logger.info(f"✅ Deleted project: {project_id}")
        return None
        
    except Exception as e:
        logger.error(f"❌ Error deleting project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

# Lambda handler
def handler(event, context):
    """AWS Lambda handler"""
    try:
        logger.info(f"Lambda invoked with event: {json.dumps(event)}")
        
        # Create Mangum adapter for AWS Lambda
        asgi_handler = Mangum(app, lifespan="off")
        
        # Process the event
        response = asgi_handler(event, context)
        
        logger.info(f"Lambda response: {json.dumps(response)}")
        return response
        
    except Exception as e:
        logger.error(f"❌ Lambda handler error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        } 