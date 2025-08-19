import json
import logging
import boto3  # Available in AWS Lambda runtime
import uuid
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException, Depends
from mangum import Mangum
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, ValidationError, VERSION as PYD_VER
from dynamodb.schemas import (
    UserFlowCreate, HighLevelRequirementCreate, LowLevelRequirementCreate, TestCaseCreate,
    UserFlow, HighLevelRequirement, LowLevelRequirement, TestCase, ProjectRequirementsResponse
)
from fastapi.encoders import jsonable_encoder
from boto3.dynamodb.conditions import Key
from decimal import Decimal
import os
from pprint import pprint

import inspect, pkg_resources, dynamodb.schemas as sch


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

# Pydantic models are now imported from dynamodb.code.schemas

def get_table(table_name: str):
    """Get DynamoDB table instance"""
    
    # Convert table name with hyphens to underscores for environment variable lookup
    # e.g., 'user-flows' -> 'USER_FLOWS_TABLE_NAME'
    env_var_name = f'{table_name.replace("-", "_").upper()}_TABLE_NAME'
    # Use dev-vishmaker as fallback to match the actual environment
    table_name_env = os.environ.get(env_var_name, f'dev-vishmaker-{table_name}')
    print(f"🔍 DEBUG: Getting table '{table_name}' -> env var '{env_var_name}' -> '{table_name_env}'")
    return dynamodb.Table(table_name_env)

def _safe_to_userflow(obj: dict) -> "UserFlow":
    """Convert a Dynamo dict to UserFlow, tolerant to extra keys."""
    try:
        if PYD_VER.startswith("2"):
            # Pydantic v2
            return UserFlow.model_validate(obj, strict=False)
        else:
            # Pydantic v1
            return UserFlow.parse_obj(obj)
    except ValidationError as exc:
        logger.error("❌ Failed to validate UserFlow: %s\nData: %s", exc, obj)
        raise HTTPException(status_code=500, detail="Bad data in user-flows table")

def _json_dump(model: BaseModel, limit: int = 10_240) -> str:
    """Dump a Pydantic model → compact JSON suitable for CloudWatch."""
    def default(o: Any):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, BaseModel):
            return o.model_dump() if PYD_VER.startswith("2") else o.dict()
        raise TypeError(f"Unserialisable: {type(o)}")

    raw = json.dumps(model, default=default)
    return raw[:limit] + (" …[truncated]" if len(raw) > limit else "")

def query_all(table, **kwargs) -> list[dict]:
    """Paginate over Dynamo Query/Scan."""
    items, cursor = [], None
    while True:
        if cursor:
            kwargs["ExclusiveStartKey"] = cursor
        page = table.query(**kwargs)
        items.extend(page.get("Items", []))
        cursor = page.get("LastEvaluatedKey")
        if not cursor:
            break
    return items

def _show_userflow_fields():
    fld_map = (UserFlow.__fields__           # Pydantic v1
               if hasattr(UserFlow, "__fields__")
               else UserFlow.model_fields)   # Pydantic v2
    print("🧩 UserFlow fields in runtime package:")
    pprint(list(fld_map.keys()))


@app.get("/")
def root():
    """Health check endpoint"""
    return {"message": "Requirements API is running", "status": "healthy"}

@app.post("/api/requirements/{project_id}/flows", response_model=UserFlow, status_code=201)
def create_user_flow(project_id: str, flow: UserFlowCreate):
    """Create a new user flow for a project"""
    try:
        print("🛫 ENTER create_user_flow(project_id=%s, flow=%s)", project_id, flow)
        table = get_table('user-flows')
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
        print(f"✅ User flow created: {uiid}")
        
        return UserFlow(**item)
        
    except Exception as e:
        logger.error(f"❌ Error creating user flow: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create user flow: {str(e)}")

@app.get("/api/requirements/{project_id}/flows", response_model=List[UserFlow])
def get_user_flows(project_id: str):
    """Get all user flows for a project"""
    try:
        print("🛫 ENTER get_user_flows(project_id=%s)", project_id)
        table = get_table('user-flows')
        
        response = table.query(
            IndexName='project_id-index',
            KeyConditionExpression='project_id = :project_id',
            ExpressionAttributeValues={':project_id': project_id}
        )
        
        flows = [UserFlow(**item) for item in response.get('Items', [])]
        print(f"✅ Retrieved {len(flows)} user flows for project {project_id}")
        
        return flows
        
    except Exception as e:
        logger.error(f"❌ Error retrieving user flows: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve user flows: {str(e)}")

@app.post("/api/requirements/{project_id}/high-level-requirements", response_model=HighLevelRequirement, status_code=201)
def create_high_level_requirement(project_id: str, hlr: HighLevelRequirementCreate):
    """Create a new high-level requirement"""
    try:
        print("🛫 ENTER create_high_level_requirement(project_id=%s, hlr=%s)", project_id, hlr)
        table = get_table('high-level-requirements')
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
        print(f"✅ High-level requirement created: {uiid}")
        
        return HighLevelRequirement(**item)
        
    except Exception as e:
        logger.error(f"❌ Error creating high-level requirement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create high-level requirement: {str(e)}")

@app.get("/api/requirements/{project_id}/high-level-requirements", response_model=List[HighLevelRequirement])
def get_high_level_requirements(project_id: str, parent_uiid: Optional[str] = None):
    """Get high-level requirements for a project"""
    try:
        print("🛫 ENTER get_high_level_requirements(project_id=%s, parent_uiid=%s)", project_id, parent_uiid)
        table = get_table('high-level-requirements')
        
        if parent_uiid:
            # Since parent_uiid is now the range key, we can scan and filter
            response = table.scan(
                FilterExpression='parent_uiid = :parent_uiid',
                ExpressionAttributeValues={':parent_uiid': parent_uiid}
            )
        else:
            response = table.scan()
        
        requirements = [HighLevelRequirement(**item) for item in response.get('Items', [])]
        print(f"✅ Retrieved {len(requirements)} high-level requirements")
        
        return requirements
        
    except Exception as e:
        logger.error(f"❌ Error retrieving high-level requirements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve high-level requirements: {str(e)}")

@app.post("/api/requirements/{project_id}/low-level-requirements", response_model=LowLevelRequirement, status_code=201)
def create_low_level_requirement(project_id: str, llr: LowLevelRequirementCreate):
    """Create a new low-level requirement"""
    try:
        print("🛫 ENTER create_low_level_requirement(project_id=%s, llr=%s)", project_id, llr)
        table = get_table('low-level-requirements')
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
        print(f"✅ Low-level requirement created: {uiid}")
        
        return LowLevelRequirement(**item)
        
    except Exception as e:
        logger.error(f"❌ Error creating low-level requirement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create low-level requirement: {str(e)}")

@app.get("/api/requirements/{project_id}/low-level-requirements", response_model=List[LowLevelRequirement])
def get_low_level_requirements(project_id: str, parent_uiid: Optional[str] = None):
    """Get low-level requirements for a project"""
    try:
        print("🛫 ENTER get_low_level_requirements(project_id=%s, parent_uiid=%s)", project_id, parent_uiid)
        table = get_table('low-level-requirements')
        
        if parent_uiid:
            # Since parent_uiid is now the range key, we can scan and filter
            response = table.scan(
                FilterExpression='parent_uiid = :parent_uiid',
                ExpressionAttributeValues={':parent_uiid': parent_uiid}
            )
        else:
            response = table.scan()
        
        requirements = [LowLevelRequirement(**item) for item in response.get('Items', [])]
        print(f"✅ Retrieved {len(requirements)} low-level requirements")
        
        return requirements
        
    except Exception as e:
        logger.error(f"❌ Error retrieving low-level requirements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve low-level requirements: {str(e)}")

@app.post("/api/requirements/{project_id}/test-cases", response_model=TestCase, status_code=201)
def create_test_case(project_id: str, test_case: TestCaseCreate):
    """Create a new test case"""
    try:
        print("🛫 ENTER create_test_case(project_id=%s, test_case=%s)", project_id, test_case)
        table = get_table('test-cases')
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
        print(f"✅ Test case created: {uiid}")
        
        return TestCase(**item)
        
    except Exception as e:
        logger.error(f"❌ Error creating test case: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create test case: {str(e)}")

@app.get("/api/requirements/{project_id}/test-cases", response_model=List[TestCase])
def get_test_cases(project_id: str, parent_uiid: Optional[str] = None):
    """Get test cases for a project"""
    try:
        print("🛫 ENTER get_test_cases(project_id=%s, parent_uiid=%s)", project_id, parent_uiid)
        table = get_table('test-cases')
        
        if parent_uiid:
            # Since parent_uiid is now the range key, we can scan and filter
            response = table.scan(
                FilterExpression='parent_uiid = :parent_uiid',
                ExpressionAttributeValues={':parent_uiid': parent_uiid}
            )
        else:
            response = table.scan()
        
        test_cases = [TestCase(**item) for item in response.get('Items', [])]
        print(f"✅ Retrieved {len(test_cases)} test cases")
        
        return test_cases
        
    except Exception as e:
        logger.error(f"❌ Error retrieving test cases: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve test cases: {str(e)}")

@app.get("/api/requirements/{project_id}", response_model=ProjectRequirementsResponse)
def get_project_requirements(project_id: str):
    
    try:
    
        print("🛫 ENTER get_project_requirements(project_id=%s)", project_id)

        flows_tbl = get_table("user-flows")
        hlr_tbl   = get_table("high-level-requirements")
        llr_tbl   = get_table("low-level-requirements")
        tc_tbl    = get_table("test-cases")

        # ── 1️⃣ USER FLOWS ──────────────────────────────────────────────────────
        flows_raw = query_all(
            flows_tbl,
            IndexName="project_id-index",
            KeyConditionExpression=Key("project_id").eq(project_id)
        )
        print("📦 Flows raw → %s", _json_dump(flows_raw))
        flows: list[UserFlow] = []
        for f in flows_raw:
            # ── 2️⃣ HLRs for each flow ────────────────────────────────────────
            # Since parent_uiid is now the range key, we can scan and filter
            hlrs_raw = hlr_tbl.scan(
                FilterExpression='parent_uiid = :parent_uiid',
                ExpressionAttributeValues={':parent_uiid': f["uiid"]}
            ).get('Items', [])
            print("📦 HLRs raw → %s", _json_dump(hlrs_raw))
            hlrs: list[HighLevelRequirement] = []
            for h in hlrs_raw:
                # ── 3️⃣ LLRs for each HLR ────────────────────────────────────
                # Since parent_uiid is now the range key, we can scan and filter
                llrs_raw = llr_tbl.scan(
                    FilterExpression='parent_uiid = :parent_uiid',
                    ExpressionAttributeValues={':parent_uiid': h["uiid"]}
                ).get('Items', [])
                print("📦 LLRs raw → %s", _json_dump(llrs_raw))
                llrs: list[LowLevelRequirement] = []
                for l in llrs_raw:
                    # ── 4️⃣ TC for each LLR ────────────────────────────────────
                    # Since parent_uiid is now the range key, we can scan and filter
                    tcs_raw = tc_tbl.scan(
                        FilterExpression='parent_uiid = :parent_uiid',
                        ExpressionAttributeValues={':parent_uiid': l["uiid"]}
                    ).get('Items', [])
                    tcs = [TestCase(**tc) for tc in tcs_raw]
                    llrs.append(LowLevelRequirement(**l, test_case_list=tcs))
                    print("📦 TCs → %s", _json_dump(tcs))
                hlrs.append(HighLevelRequirement(**h, low_level_requirement_list=llrs))

            flows.append(UserFlow(**f, high_level_requirement_list=hlrs))

        print("📦 Flows → %s", _json_dump(flows))
        response_obj = ProjectRequirementsResponse(project_id=project_id, flows=flows)

        
        summaries = []
        for flow in response_obj.flows:
            hlrs = getattr(flow, "high_level_requirement_list", [])
            llrs = sum(len(getattr(h, "low_level_requirement_list", [])) for h in hlrs)
            tcs  = sum(
                len(getattr(l, "test_case_list", []))
                for h in hlrs
                for l in getattr(h, "low_level_requirement_list", [])
            )
            summaries.append(f"{flow.name or flow.uiid}: HLR={len(hlrs)}, LLR={llrs}, TC={tcs}")
        print("📊 Flow summaries → %s", "; ".join(summaries))

        print("📦 Outbound JSON (≤10 KB) → %s", _json_dump(response_obj.model_dump()
                                                                if PYD_VER.startswith("2")
                                                                else response_obj.dict()))

        print("🏁 EXIT get_project_requirements(project_id=%s)", project_id)
        return response_obj

    except Exception as e:
        logger.error(f"❌ Error retrieving project requirements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve project requirements: {str(e)}")

# Lambda handler
def handler(event, context):
    """AWS Lambda handler"""
    try:
        print(f"Lambda invoked with event: {json.dumps(event)}")

        print("📦 schemas loaded from →", inspect.getfile(sch))
        _show_userflow_fields()

        
        # Create Mangum adapter for AWS Lambda
        asgi_handler = Mangum(app, lifespan="off")
        
        # Process the event
        response = asgi_handler(event, context)
        
        print(f"Lambda response: {json.dumps(response)}")
        return response
        
    except Exception as e:
        logger.error(f"❌ Lambda handler error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        } 