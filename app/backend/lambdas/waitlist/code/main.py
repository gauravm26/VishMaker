import json
import logging
from mangum import Mangum
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import boto3
from botocore.exceptions import ClientError
from typing import Dict, Any, Optional
import os
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="VishMaker Waitlist API",
    description="API for managing waitlist entries",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('WAITLIST_TABLE_NAME', 'dev-vishmaker-waitlist')
table = dynamodb.Table(table_name)

# Pydantic models for request/response
from pydantic import BaseModel, EmailStr
from typing import Optional

class WaitlistCreateRequest(BaseModel):
    email: EmailStr

class WaitlistResponse(BaseModel):
    id: str
    email: str
    status: str
    created_at: str
    updated_at: Optional[str] = None

class WaitlistUpdateRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

# Utility functions
def generate_id() -> str:
    """Generate a unique ID for waitlist entries"""
    import uuid
    return str(uuid.uuid4())

def get_current_timestamp() -> str:
    """Get current timestamp in ISO format"""
    return datetime.now(timezone.utc).isoformat()

# API Endpoints
@app.post("/api/waitlist", response_model=Dict[str, Any])
async def join_waitlist(request: WaitlistCreateRequest):
    """
    Add an email to the waitlist
    """
    try:
        email = request.email.lower().strip()
        
        # Check if email already exists
        response = table.query(
            IndexName='email-index',
            KeyConditionExpression='email = :email',
            ExpressionAttributeValues={':email': email}
        )
        
        if response['Items']:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists in waitlist"
            )
        
        # Create new waitlist entry
        entry_id = generate_id()
        timestamp = get_current_timestamp()
        
        item = {
            'id': entry_id,
            'email': email,
            'status': 'pending',
            'created_at': timestamp,
            'updated_at': timestamp
        }
        
        table.put_item(Item=item)
        
        logger.info(f"Added email {email} to waitlist with ID {entry_id}")
        
        return {
            "status": "success",
            "message": "Successfully added to waitlist",
            "data": {
                "id": entry_id,
                "email": email,
                "status": "pending",
                "created_at": timestamp
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding email to waitlist: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add email to waitlist"
        )

@app.get("/api/waitlist/entries", response_model=Dict[str, Any])
async def get_waitlist_entries(skip: int = 0, limit: int = 100):
    """
    Get all waitlist entries (admin endpoint)
    """
    try:
        response = table.scan(
            Limit=limit,
            ExclusiveStartKey={'id': str(skip)} if skip > 0 else None
        )
        
        items = response['Items']
        # Sort by created_at descending
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return {
            "status": "success",
            "data": items,
            "count": len(items),
            "total": response.get('Count', 0)
        }
        
    except Exception as e:
        logger.error(f"Error retrieving waitlist entries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve waitlist entries"
        )

@app.get("/api/waitlist/count", response_model=Dict[str, Any])
async def get_waitlist_stats():
    """
    Get waitlist statistics
    """
    try:
        response = table.scan(Select='COUNT')
        total_count = response.get('Count', 0)
        
        return {
            "status": "success",
            "total_entries": total_count
        }
        
    except Exception as e:
        logger.error(f"Error getting waitlist stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve waitlist statistics"
        )

@app.put("/api/waitlist/{entry_id}", response_model=Dict[str, Any])
async def update_waitlist(entry_id: str, request: WaitlistUpdateRequest):
    """
    Update a waitlist entry (admin endpoint)
    """
    try:
        # Get current entry
        response = table.get_item(Key={'id': entry_id})
        if 'Item' not in response:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Waitlist entry not found"
            )
        
        current_item = response['Item']
        update_expression = "SET updated_at = :updated_at"
        expression_attribute_values = {':updated_at': get_current_timestamp()}
        
        # Update status if provided
        if request.status is not None:
            update_expression += ", #status = :status"
            expression_attribute_values[':status'] = request.status
            expression_attribute_names = {'#status': 'status'}
        
        # Update notes if provided
        if request.notes is not None:
            update_expression += ", notes = :notes"
            expression_attribute_values[':notes'] = request.notes
        
        # Perform update
        update_params = {
            'Key': {'id': entry_id},
            'UpdateExpression': update_expression,
            'ExpressionAttributeValues': expression_attribute_values,
            'ReturnValues': 'ALL_NEW'
        }
        
        if 'expression_attribute_names' in locals():
            update_params['ExpressionAttributeNames'] = expression_attribute_names
        
        response = table.update_item(**update_params)
        updated_item = response['Attributes']
        
        logger.info(f"Updated waitlist entry {entry_id}")
        
        return {
            "status": "success",
            "message": "Waitlist entry updated successfully",
            "data": updated_item
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating waitlist entry: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update waitlist entry"
        )

@app.get("/api/waitlist/health")
async def health_check():
    """
    Health check endpoint
    """
    try:
        # Test DynamoDB connection
        table.table_status
        return {"status": "healthy", "message": "Waitlist service is running"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unavailable"
        )

# Lambda handler
def lambda_handler(event, context):
    """AWS Lambda handler"""
    try:
        # Add DynamoDB table name to environment for the lambda
        os.environ['WAITLIST_TABLE_NAME'] = table_name
        
        # Use Mangum to handle API Gateway events
        asgi_handler = Mangum(app, lifespan="off")
        return asgi_handler(event, context)
        
    except Exception as e:
        logger.error(f"Lambda handler error: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error"}),
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        }
