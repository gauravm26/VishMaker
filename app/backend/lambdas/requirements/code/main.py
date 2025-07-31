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
from dynamodb.code.schemas import (
    UserFlowCreate, HighLevelRequirementCreate, LowLevelRequirementCreate, TestCaseCreate,
    UserFlow, HighLevelRequirement, LowLevelRequirement, TestCase, ProjectRequirementsResponse
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

app = FastAPI(
    title="VishMaker Requirements API",
    description="Requirements generation and management service for VishMaker",
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

def get_table(table_name: str):
    """Get DynamoDB table instance"""
    import os
    # Use underscores in the table name to match the actual DynamoDB table names
    table_name_env = os.environ.get(f'{table_name.upper()}_TABLE_NAME', f'prod-vishmaker-{table_name}')
    logger.info(f"🔍 DEBUG: Getting table '{table_name}' -> '{table_name_env}'")
    print(f"🔍 DEBUG: Getting table '{table_name}' -> '{table_name_env}'")
    return dynamodb.Table(table_name_env)


@app.get("/")
def root():
    """Health check endpoint"""
    return {"message": "Requirements API is running", "status": "healthy"}

@app.post("/requirements/{project_id}/flows", response_model=UserFlow, status_code=201)
def create_user_flow(project_id: str, flow: UserFlowCreate):
    """Create a new user flow for a project"""
    try:
        table = get_table('user_flows')
        uiid = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        
        item = {
            'uiid': uiid,
            'name': flow.name,
            'description': flow.description,
            'project_id': project_id,
            'created_at': timestamp,
            'updated_at': timestamp
        }
        
        table.put_item(Item=item)
        logger.info(f"✅ User flow created: {uiid}")
        
        return UserFlow(**item)
        
    except Exception as e:
        logger.error(f"❌ Error creating user flow: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create user flow: {str(e)}")

@app.get("/requirements/{project_id}/flows", response_model=List[UserFlow])
def get_user_flows(project_id: str):
    """Get all user flows for a project"""
    try:
        table = get_table('user_flows')
        
        response = table.query(
            IndexName='project_id-index',
            KeyConditionExpression='project_id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        
        flows = [UserFlow(**item) for item in response.get('Items', [])]
        logger.info(f"✅ Retrieved {len(flows)} user flows for project {project_id}")
        
        return flows
        
    except Exception as e:
        logger.error(f"❌ Error retrieving user flows: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve user flows: {str(e)}")

@app.post("/requirements/{project_id}/high-level-requirements", response_model=HighLevelRequirement, status_code=201)
def create_high_level_requirement(project_id: str, hlr: HighLevelRequirementCreate):
    """Create a new high-level requirement"""
    try:
        table = get_table('high_level_requirements')
        uiid = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        
        item = {
            'uiid': uiid,
            'name': hlr.name,
            'description': hlr.description,
            'parent_uiid': hlr.parent_uiid,
            'created_at': timestamp,
            'updated_at': timestamp
        }
        
        table.put_item(Item=item)
        logger.info(f"✅ High-level requirement created: {uiid}")
        
        return HighLevelRequirement(**item)
        
    except Exception as e:
        logger.error(f"❌ Error creating high-level requirement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create high-level requirement: {str(e)}")

@app.get("/requirements/{project_id}/high-level-requirements", response_model=List[HighLevelRequirement])
def get_high_level_requirements(project_id: str, parent_uiid: Optional[str] = None):
    """Get high-level requirements for a project"""
    try:
        table = get_table('high_level_requirements')
        
        if parent_uiid:
            response = table.query(
                IndexName='parent_uiid-index',
                KeyConditionExpression='parent_uiid = :parent_uiid',
                ExpressionAttributeValues={':parent_uiid': parent_uiid}
            )
        else:
            response = table.scan()
        
        requirements = [HighLevelRequirement(**item) for item in response.get('Items', [])]
        logger.info(f"✅ Retrieved {len(requirements)} high-level requirements")
        
        return requirements
        
    except Exception as e:
        logger.error(f"❌ Error retrieving high-level requirements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve high-level requirements: {str(e)}")

@app.post("/requirements/{project_id}/low-level-requirements", response_model=LowLevelRequirement, status_code=201)
def create_low_level_requirement(project_id: str, llr: LowLevelRequirementCreate):
    """Create a new low-level requirement"""
    try:
        table = get_table('low_level_requirements')
        uiid = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        
        item = {
            'uiid': uiid,
            'name': llr.name,
            'description': llr.description,
            'parent_uiid': llr.parent_uiid,
            'created_at': timestamp,
            'updated_at': timestamp
        }
        
        table.put_item(Item=item)
        logger.info(f"✅ Low-level requirement created: {uiid}")
        
        return LowLevelRequirement(**item)
        
    except Exception as e:
        logger.error(f"❌ Error creating low-level requirement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create low-level requirement: {str(e)}")

@app.get("/requirements/{project_id}/low-level-requirements", response_model=List[LowLevelRequirement])
def get_low_level_requirements(project_id: str, parent_uiid: Optional[str] = None):
    """Get low-level requirements for a project"""
    try:
        table = get_table('low_level_requirements')
        
        if parent_uiid:
            response = table.query(
                IndexName='parent_uiid-index',
                KeyConditionExpression='parent_uiid = :parent_uiid',
                ExpressionAttributeValues={':parent_uiid': parent_uiid}
            )
        else:
            response = table.scan()
        
        requirements = [LowLevelRequirement(**item) for item in response.get('Items', [])]
        logger.info(f"✅ Retrieved {len(requirements)} low-level requirements")
        
        return requirements
        
    except Exception as e:
        logger.error(f"❌ Error retrieving low-level requirements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve low-level requirements: {str(e)}")

@app.post("/requirements/{project_id}/test-cases", response_model=TestCase, status_code=201)
def create_test_case(project_id: str, test_case: TestCaseCreate):
    """Create a new test case"""
    try:
        table = get_table('test_cases')
        uiid = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        
        item = {
            'uiid': uiid,
            'name': test_case.name,
            'description': test_case.description,
            'parent_uiid': test_case.parent_uiid,
            'created_at': timestamp,
            'updated_at': timestamp
        }
        
        table.put_item(Item=item)
        logger.info(f"✅ Test case created: {uiid}")
        
        return TestCase(**item)
        
    except Exception as e:
        logger.error(f"❌ Error creating test case: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create test case: {str(e)}")

@app.get("/requirements/{project_id}/test-cases", response_model=List[TestCase])
def get_test_cases(project_id: str, parent_uiid: Optional[str] = None):
    """Get test cases for a project"""
    try:
        table = get_table('test_cases')
        
        if parent_uiid:
            response = table.query(
                IndexName='parent_uiid-index',
                KeyConditionExpression='parent_uiid = :parent_uiid',
                ExpressionAttributeValues={':parent_uiid': parent_uiid}
            )
        else:
            response = table.scan()
        
        test_cases = [TestCase(**item) for item in response.get('Items', [])]
        logger.info(f"✅ Retrieved {len(test_cases)} test cases")
        
        return test_cases
        
    except Exception as e:
        logger.error(f"❌ Error retrieving test cases: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve test cases: {str(e)}")

@app.get("/requirements/{project_id}", response_model=ProjectRequirementsResponse)
def get_project_requirements(project_id: str):
    """Get complete requirements hierarchy for a project"""
    try:
        logger.info(f"🔍 DEBUG: Starting get_project_requirements for project_id: {project_id}")
        print(f"🔍 DEBUG: Starting get_project_requirements for project_id: {project_id}")
        
        # Get user flows
        flows_table = get_table('user_flows')
        logger.info(f"🔍 DEBUG: Got user_flows table: {flows_table.name}")
        print(f"🔍 DEBUG: Got user_flows table: {flows_table.name}")
        
        # Get user flows for this project
        flows_response = flows_table.query(
            IndexName='project_id-index',
            KeyConditionExpression='project_id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        
        logger.info(f"🔍 Found {len(flows_response.get('Items', []))} user flows for project {project_id}")
        
        # If no flows found, try with different project_id formats
        if not flows_response.get('Items'):
            logger.info(f"🔍 No flows found with project_id: {project_id}, trying integer format")
            
            # Try with integer project_id
            try:
                int_project_id = int(project_id)
                flows_response = flows_table.query(
                    IndexName='project_id-index',
                    KeyConditionExpression='project_id = :project_id',
                    ExpressionAttributeValues={':project_id': int_project_id}
                )
                logger.info(f"🔍 Found {len(flows_response.get('Items', []))} flows with integer project_id")
            except ValueError:
                logger.info(f"🔍 Could not convert project_id to int: {project_id}")
        
        flows = []
        for flow_item in flows_response.get('Items', []):
            logger.info(f"🔍 DEBUG: Processing flow item: {flow_item}")
            logger.info(f"🔍 DEBUG: Flow item keys: {list(flow_item.keys())}")
            
            # Get high-level requirements for this flow (even if empty)
            flow_uiid = flow_item.get('uiid')
            high_level_requirements = []
            
            # Try to get HLRs for this flow
            hlr_table = get_table('high_level_requirements')
            hlr_response = hlr_table.scan(
                FilterExpression='parent_uiid = :parent_uiid',
                ExpressionAttributeValues={':parent_uiid': flow_uiid}
            )
            
            logger.info(f"🔍 DEBUG: Found {len(hlr_response.get('Items', []))} HLRs for flow {flow_uiid}")
            
            for hlr_item in hlr_response.get('Items', []):
                logger.info(f"🔍 DEBUG: Processing HLR item: {hlr_item}")
                logger.info(f"🔍 DEBUG: HLR item keys: {list(hlr_item.keys())}")
                
                # Get low-level requirements for this HLR
                llr_table = get_table('low_level_requirements')
                llr_response = llr_table.scan(
                    FilterExpression='parent_uiid = :parent_uiid',
                    ExpressionAttributeValues={':parent_uiid': hlr_item.get('uiid')}
                )
                
                logger.info(f"🔍 DEBUG: Found {len(llr_response.get('Items', []))} LLRs for HLR {hlr_item.get('uiid')}")
                
                low_level_requirements = []
                for llr_item in llr_response.get('Items', []):
                    logger.info(f"🔍 DEBUG: Processing LLR item: {llr_item}")
                    logger.info(f"🔍 DEBUG: LLR item keys: {list(llr_item.keys())}")
                    
                    # Get test cases for this LLR
                    tc_table = get_table('test_cases')
                    tc_response = tc_table.scan(
                        FilterExpression='parent_uiid = :parent_uiid',
                        ExpressionAttributeValues={':parent_uiid': llr_item.get('uiid')}
                    )
                    
                    test_cases = []
                    for tc_item in tc_response.get('Items', []):
                        tc = TestCase(
                            uiid=tc_item.get('uiid'),
                            name=tc_item.get('name'),
                            description=tc_item.get('description'),
                            parent_uiid=tc_item.get('parent_uiid'),
                            created_at=tc_item.get('created_at'),
                            updated_at=tc_item.get('updated_at')
                        )
                        test_cases.append(tc)
                    
                    # Create LLR with test cases
                    llr = LowLevelRequirement(
                        uiid=llr_item.get('uiid'),
                        name=llr_item.get('name'),
                        description=llr_item.get('description'),
                        parent_uiid=llr_item.get('parent_uiid'),
                        created_at=llr_item.get('created_at'),
                        updated_at=llr_item.get('updated_at'),
                        test_case_list=test_cases
                    )
                    low_level_requirements.append(llr)
                
                # Create HLR with LLRs
                hlr = HighLevelRequirement(
                    uiid=hlr_item.get('uiid'),
                    name=hlr_item.get('name'),
                    description=hlr_item.get('description'),
                    parent_uiid=hlr_item.get('parent_uiid'),
                    created_at=hlr_item.get('created_at'),
                    updated_at=hlr_item.get('updated_at'),
                    low_level_requirement_list=low_level_requirements
                )
                high_level_requirements.append(hlr)
            
            # Create UserFlow with HLRs (even if empty)
            # Note: high_level_requirement_list is not stored in DynamoDB, it's computed
            try:
                flow = UserFlow(
                    uiid=flow_item.get('uiid'),
                    name=flow_item.get('name'),
                    description=flow_item.get('description'),
                    project_id=flow_item.get('project_id'),
                    created_at=flow_item.get('created_at'),
                    updated_at=flow_item.get('updated_at'),
                    high_level_requirement_list=high_level_requirements  # This is computed, not from DB
                )
                logger.info(f"✅ Created UserFlow: {flow.name} with {len(high_level_requirements)} HLRs")
                flows.append(flow)
            except Exception as e:
                logger.error(f"❌ Error creating UserFlow: {str(e)}")
                logger.error(f"❌ Flow item data: {flow_item}")
                raise HTTPException(status_code=500, detail=f"Failed to create UserFlow: {str(e)}")
        
        logger.info(f"✅ Retrieved {len(flows)} user flows for project {project_id}")
        
        # Create the response with proper structure
        try:
            response = ProjectRequirementsResponse(project_id=project_id, flows=flows)
            
            # Log summary of the response structure with safe attribute access
            total_hlrs = 0
            total_llrs = 0
            total_tcs = 0
            
            for flow in flows:
                if hasattr(flow, 'high_level_requirement_list'):
                    total_hlrs += len(flow.high_level_requirement_list)
                    for hlr in flow.high_level_requirement_list:
                        if hasattr(hlr, 'low_level_requirement_list'):
                            total_llrs += len(hlr.low_level_requirement_list)
                            for llr in hlr.low_level_requirement_list:
                                if hasattr(llr, 'test_case_list'):
                                    total_tcs += len(llr.test_case_list)
            
            logger.info(f"📊 Response summary: {len(flows)} flows, {total_hlrs} HLRs, {total_llrs} LLRs, {total_tcs} test cases")
            
            return response
        except Exception as e:
            logger.error(f"❌ Error creating ProjectRequirementsResponse: {str(e)}")
            logger.error(f"❌ Flows data: {flows}")
            raise HTTPException(status_code=500, detail=f"Failed to create response: {str(e)}")
        
    except Exception as e:
        logger.error(f"❌ Error retrieving project requirements: {str(e)}")
        print(f"❌ DEBUG: Error retrieving project requirements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve project requirements: {str(e)}")

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