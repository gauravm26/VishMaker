import json
import logging
import boto3
import uuid
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException, Depends
from mangum import Mangum
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from dynamodb.schemas import ProjectCreate, ProjectUpdate, Project
from shared.auth import get_current_user

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

# Pydantic models are now imported from dynamodb.code.schemas

def get_table():
    """Get DynamoDB table instance"""
    global table_name
    if table_name is None:
        # Get table name from environment variable
        import os
        # Convert table name with hyphens to underscores for environment variable lookup
        # e.g., 'projects' -> 'PROJECTS_TABLE_NAME'
        env_var_name = 'PROJECTS_TABLE_NAME'
        table_name = os.environ.get(env_var_name, f'dev-vishmaker-projects')
    return dynamodb.Table(table_name)

@app.get("/")
def root():
    """Health check endpoint"""
    return {"message": "Projects API is running", "status": "healthy"}

@app.post("/api/projects", response_model=Project, status_code=201)
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

@app.get("/api/projects", response_model=List[Project])
def get_projects(skip: int = 0, limit: int = 100, user_id: Optional[str] = None):
    """Get all projects with optional filtering by user_id"""
    try:
        table = get_table()
        
        if user_id:
            # Query by user_id if provided
            response = table.query(
                IndexName='user_id-index',  # GSI on user_id for efficient user-based queries
                KeyConditionExpression='user_id = :user_id',
                ExpressionAttributeValues={':user_id': user_id},
                Limit=limit
            )
        else:
            # Scan all projects (consider adding pagination for large datasets)
            response = table.scan(Limit=limit)
        
        projects = [Project(**item) for item in response.get('Items', [])]
        logger.info(f"✅ Retrieved {len(projects)} projects")
        
        return projects
        
    except Exception as e:
        logger.error(f"❌ Error retrieving projects: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve projects: {str(e)}")

@app.get("/api/projects/{project_id}", response_model=Project)
def get_project(project_id: str):
    """Get a specific project by ID"""
    try:
        table = get_table()
        
        # Note: This requires a GSI on 'id' or we need to restructure the table
        # For now, using scan but this should be optimized with proper indexing
        response = table.scan(
            FilterExpression='id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        
        items = response.get('Items', [])
        if not items:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Take the first match (should be unique by id)
        project = Project(**items[0])
        logger.info(f"✅ Retrieved project: {project_id}")
        
        return project
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error retrieving project {project_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve project: {str(e)}")

@app.put("/api/projects/{project_id}", response_model=Project)
def update_project(project_id: str, project_update: ProjectUpdate):
    """Update an existing project"""
    try:
        table = get_table()
        
        # First, get the project to find the user_id
        response = table.scan(
            FilterExpression='id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        
        items = response.get('Items', [])
        if not items:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project_item = items[0]
        user_id = project_item.get('user_id')
        
        if not user_id:
            raise HTTPException(status_code=400, detail="Project missing user_id")
        
        # Build update expression
        update_expression = "SET updated_at = :updated_at"
        expression_attribute_values = {':updated_at': datetime.utcnow().isoformat()}
        expression_attribute_names = {}
        
        if project_update.name is not None:
            update_expression += ", #name = :name"
            expression_attribute_values[':name'] = project_update.name
            expression_attribute_names['#name'] = 'name'
        
        if project_update.initial_prompt is not None:
            update_expression += ", initial_prompt = :initial_prompt"
            expression_attribute_values[':initial_prompt'] = project_update.initial_prompt
        
        # Update the item with both keys
        response = table.update_item(
            Key={'id': project_id, 'user_id': user_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_attribute_values,
            ExpressionAttributeNames=expression_attribute_names if expression_attribute_names else None,
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

@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str):
    """Delete a project by ID with cascade deletion of all related data"""
    try:
        # Get table names from environment variables
        import os
        projects_table = get_table()
        
        # Use the same pattern as requirements lambda for consistency
        def get_table_by_name(table_name: str):
            """Get DynamoDB table instance by name"""
            env_var_name = f'{table_name.replace("-", "_").upper()}_TABLE_NAME'
            # Use dev-vishmaker as fallback to match the actual environment
            table_name_env = os.environ.get(env_var_name, f'dev-vishmaker-{table_name}')
            return dynamodb.Table(table_name_env)
        
        user_flows_table = get_table_by_name('user-flows')
        high_level_reqs_table = get_table_by_name('high-level-requirements')
        low_level_reqs_table = get_table_by_name('low-level-requirements')
        test_cases_table = get_table_by_name('test-cases')
        
        # First, get the project to find the user_id
        response = projects_table.scan(
            FilterExpression='id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        
        items = response.get('Items', [])
        if not items:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project_item = items[0]
        user_id = project_item.get('user_id')
        
        if not user_id:
            raise HTTPException(status_code=400, detail="Project missing user_id")
        
        logger.info(f"🗑️ Starting cascade deletion for project: {project_id}")
        
        # Delete all items by project_id using GSIs - much simpler and faster!
        
        # Delete test cases
        tc_response = test_cases_table.query(
            IndexName='project_id-index',
            KeyConditionExpression='project_id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        test_cases = tc_response.get('Items', [])
        logger.info(f"Found {len(test_cases)} test cases to delete")
        for tc in test_cases:
            try:
                test_cases_table.delete_item(
                    Key={
                        'uiid': tc.get('uiid'),
                        'parent_uiid': tc.get('parent_uiid')
                    }
                )
                logger.info(f"Deleted test case: {tc.get('uiid')}")
            except Exception as e:
                logger.warning(f"Failed to delete test case {tc.get('uiid')}: {str(e)}")
        
        # Delete low level requirements
        llr_response = low_level_reqs_table.query(
            IndexName='project_id-index',
            KeyConditionExpression='project_id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        low_level_reqs = llr_response.get('Items', [])
        logger.info(f"Found {len(low_level_reqs)} low level requirements to delete")
        for llr in low_level_reqs:
            try:
                low_level_reqs_table.delete_item(
                    Key={
                        'uiid': llr.get('uiid'),
                        'parent_uiid': llr.get('parent_uiid')
                    }
                )
                logger.info(f"Deleted LLR: {llr.get('uiid')}")
            except Exception as e:
                logger.warning(f"Failed to delete LLR {llr.get('uiid')}: {str(e)}")
        
        # Delete high level requirements
        hlr_response = high_level_reqs_table.query(
            IndexName='project_id-index',
            KeyConditionExpression='project_id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        high_level_reqs = hlr_response.get('Items', [])
        logger.info(f"Found {len(high_level_reqs)} high level requirements to delete")
        for hlr in high_level_reqs:
            try:
                high_level_reqs_table.delete_item(
                    Key={
                        'uiid': hlr.get('uiid'),
                        'parent_uiid': hlr.get('parent_uiid')
                    }
                )
                logger.info(f"Deleted HLR: {hlr.get('uiid')}")
            except Exception as e:
                logger.warning(f"Failed to delete HLR {hlr.get('uiid')}: {str(e)}")
        
        # Delete user flows
        user_flows_response = user_flows_table.query(
            IndexName='project_id-index',
            KeyConditionExpression='project_id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        user_flows = user_flows_response.get('Items', [])
        logger.info(f"Found {len(user_flows)} user flows to delete")
        for user_flow in user_flows:
            try:
                user_flows_table.delete_item(
                    Key={
                        'uiid': user_flow.get('uiid'),
                        'project_id': user_flow.get('project_id')
                    }
                )
                logger.info(f"Deleted user flow: {user_flow.get('uiid')}")
            except Exception as e:
                logger.warning(f"Failed to delete user flow {user_flow.get('uiid')}: {str(e)}")
        
        # Finally delete the project itself
        projects_table.delete_item(Key={'id': project_id, 'user_id': user_id})
        
        logger.info(f"✅ Successfully deleted project {project_id} and all related data")
        return None
        
    except table.meta.client.exceptions.ResourceNotFoundException:
        raise HTTPException(status_code=404, detail="Project not found")
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