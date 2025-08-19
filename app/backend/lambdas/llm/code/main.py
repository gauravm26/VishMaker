import json
import logging
from fastapi import FastAPI, Request, HTTPException, APIRouter
from mangum import Mangum
from services import llm_processing_service
from fastapi.responses import JSONResponse
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="VishMaker LLM API",
    description="LLM processing service for VishMaker",
    version="1.0.0"
)

@app.get("/")
def root():
    """Health check endpoint"""
    return {"message": "VishMaker LLM API is running", "status": "healthy"}

@app.get("/ping")
def ping():
    """Simple ping endpoint for health checks"""
    return {"message": "pong", "status": "ok"}

@app.post("/api/llm/process")
async def process_llm(request: Request):
    """
    Process LLM request for a specific component.
    
    Expected request body:
    {
        "componentId": "string",
        "text": "string",
        "project_id": "number" (optional),
        "parent_uiid": "string" (optional),
        "save_to_db": "boolean" (optional)
    }
    """
    try:
        print("=" * 80)
        print("LLM PROCESS ENDPOINT CALLED")
        print("=" * 80)
        print(f"Request method: {request.method}")
        print(f"Request URL: {request.url}")
        print(f"Request headers: {dict(request.headers)}")
        print(f"Request query params: {dict(request.query_params)}")
        
        # Log the raw request body
        body_bytes = await request.body()
        print(f"Raw request body (bytes): {body_bytes}")
        print(f"Raw request body (string): {body_bytes.decode('utf-8') if body_bytes else 'None'}")
        
        logger.info("📥 LLM process request received")
        
        # Parse request body
        body = await request.json()
        print(f"Parsed request body: {json.dumps(body, indent=2)}")
        logger.info(f"🔍 Request body: {body}")
        
        # Validate required fields
        if not body.get("component_id"):
            print("❌ Missing component_id in request body")
            raise HTTPException(status_code=400, detail="component_id is required")
        
        if not body.get("text"):
            print("❌ Missing text in request body")
            raise HTTPException(status_code=400, detail="text is required")
        
        # Extract parameters
        component_id = body["component_id"]
        text = body["text"]
        project_id = body.get("project_id")
        parent_uiid = body.get("parent_uiid")
        save_to_db = body.get("save_to_database", False)  # Fixed: was "save_to_db", now "save_to_database"
        target_table = body.get("target_table")  # Optional, will be determined from config if not provided
        
        print(f"✅ Extracted parameters:")
        print(f"   - component_id: {component_id}")
        print(f"   - text length: {len(text)}")
        print(f"   - project_id: {project_id}")
        print(f"   - parent_uiid: {parent_uiid}")
        print(f"   - save_to_db: {save_to_db}")
        print(f"   - target_table: {target_table}")
        print(f"   - save_to_database from body: {body.get('save_to_database')}")
        print(f"   - save_to_db from body: {body.get('save_to_db')}")
        
        logger.info(f"🔧 Processing component: {component_id}")
        logger.info(f"📝 Text length: {len(text)}")
        logger.info(f"🏗️ Project ID: {project_id}")
        logger.info(f"🔗 Parent UIID: {parent_uiid}")
        logger.info(f"💾 Save to database: {save_to_db}")
        
        print("🔄 Calling LLM processing service...")
        
        # Process with LLM service
        result = llm_processing_service.process_component(
            component_id=component_id,
            text=text,
            project_id=project_id,
            parent_uiid=parent_uiid,
            save_to_db=save_to_db,
            target_table=target_table
        )
        
        print(f"✅ LLM service result: {json.dumps(result, indent=2)}")
        logger.info("✅ LLM processing completed successfully")
        logger.info(f"📊 Result success: {result.get('success', False)}")
        
        # Check if processing was successful
        if not result.get("success"):
            error_msg = result.get("error", "Unknown error occurred")
            print(f"❌ LLM processing failed: {error_msg}")
            logger.error(f"❌ LLM processing failed: {error_msg}")
            raise HTTPException(
                status_code=500, 
                detail=f"LLM processing failed: {error_msg}"
            )
        
        # Return successful response
        response_data = {
            "success": True,
            "result": result.get("result", ""),
            "modelId": result.get("modelId", ""),
            "instructionId": result.get("instructionId", ""),
            "progressUpdates": result.get("progressUpdates", []),
            "generated_uiids": result.get("generated_uiids", []),
            "metadata": result.get("metadata", {})
        }
        
        print(f"🎉 Returning successful response: {json.dumps(response_data, indent=2)}")
        logger.info("🎉 Returning successful response")
        return response_data
        
    except HTTPException as he:
        print(f"❌ HTTP Exception: {he.status_code} - {he.detail}")
        # Re-raise HTTP exceptions
        raise
    except json.JSONDecodeError as e:
        print(f"❌ JSON Decode Error: {e}")
        logger.error(f"❌ Invalid JSON in request body: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON in request body")
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        print(f"❌ Error type: {type(e)}")
        import traceback
        print(f"❌ Full traceback: {traceback.format_exc()}")
        logger.error(f"❌ Unexpected error in LLM processing: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(e)}"
        )

@app.options("/api/llm/process")
async def options_llm_process():
    """Handle CORS preflight requests"""
    return {"message": "CORS preflight successful"}

# Lambda handler
def handler(event, context):
    try:
        print("=" * 80)
        print("LAMBDA INVOCATION STARTED")
        print("=" * 80)
        print(f"Full event: {json.dumps(event, indent=2)}")
        print(f"Context: {context}")
        print(f"Function name: {context.function_name}")
        print(f"Function version: {context.function_version}")
        print(f"Invoked function ARN: {context.invoked_function_arn}")
        print(f"Request ID: {context.aws_request_id}")
        print("=" * 80)
        
        # Call the Mangum handler
        result = Mangum(app)(event, context)
        print(f"✅ Lambda handler completed successfully")
        print(f"Result: {result}")
        return result
        
    except Exception as e:
        print("=" * 80)
        print("LAMBDA INVOCATION FAILED")
        print("=" * 80)
        print(f"Exception message: {str(e)}")
        print(f"Exception type: {type(e)}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        print("=" * 80)
        raise
