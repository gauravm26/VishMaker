import json
import logging
from fastapi import FastAPI, Request, HTTPException
from mangum import Mangum
from services import llm_processing_service
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="VishMaker LLM API",
    description="LLM processing service for VishMaker",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://vishmaker.com"],  # Production domain
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    """Health check endpoint"""
    return {"message": "VishMaker LLM API is running", "status": "healthy"}

@app.get("/ping")
def ping():
    """Simple ping endpoint for health checks"""
    return {"message": "pong", "status": "ok"}

@app.post("/llm/process")
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
        logger.info("📥 LLM process request received")
        
        # Parse request body
        body = await request.json()
        logger.info(f"🔍 Request body: {body}")
        
        # Validate required fields
        if not body.get("componentId"):
            raise HTTPException(status_code=400, detail="componentId is required")
        
        if not body.get("text"):
            raise HTTPException(status_code=400, detail="text is required")
        
        # Extract parameters
        component_id = body["componentId"]
        text = body["text"]
        project_id = body.get("project_id")
        parent_uiid = body.get("parent_uiid")
        save_to_db = body.get("save_to_db", False)
        
        logger.info(f"🔧 Processing component: {component_id}")
        logger.info(f"📝 Text length: {len(text)}")
        logger.info(f"🏗️ Project ID: {project_id}")
        logger.info(f"🔗 Parent UIID: {parent_uiid}")
        
        # Process with LLM service
        result = llm_processing_service.process_component(
            component_id=component_id,
            text=text,
            project_id=project_id,
            parent_uiid=parent_uiid
        )
        
        logger.info("✅ LLM processing completed successfully")
        logger.info(f"📊 Result success: {result.get('success', False)}")
        
        # Check if processing was successful
        if not result.get("success"):
            error_msg = result.get("error", "Unknown error occurred")
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
        
        logger.info("🎉 Returning successful response")
        return JSONResponse(
            content=response_data,
            headers={
                "Access-Control-Allow-Origin": "https://vishmaker.com",
                "Access-Control-Allow-Credentials": "true"
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in request body: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON in request body")
    except Exception as e:
        logger.error(f"❌ Unexpected error in LLM processing: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(e)}"
        )

@app.options("/llm/process")
async def options_llm_process():
    """Handle CORS preflight requests"""
    return JSONResponse(
        content={"message": "CORS preflight successful"},
        headers={
            "Access-Control-Allow-Origin": "https://vishmaker.com",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true"
        }
    )

# Lambda handler
handler = Mangum(app)
