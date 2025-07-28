# features/requirement_generation/api/routes.py
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field

from local.db.db_core import get_db # DB session dependency
from features.requirement_generation.core.services import req_gen_service, RequirementGenerationService
from features.requirement_generation.api import schemas # API Schemas

router = APIRouter(
    prefix="/requirements", # Endpoint group: /api/v1/requirements/...
    tags=["Requirement Generation"] # Tag for OpenAPI docs
)

@router.get(
    "/{project_id}",
    response_model=schemas.ProjectRequirementsResponse # Use the new response schema
)
def get_project_requirements_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    service: RequirementGenerationService = Depends(lambda: req_gen_service)
):
    """
    Retrieves the generated user flows, steps, and nested requirements for a specific project.
    """
    try:
        # Log that we're retrieving requirements
        print(f"Retrieving requirements for project {project_id}")
        
        # Get flows from service
        flows = service.get_project_requirements(db=db, project_id=project_id)
        
        # Log the retrieved flows
        print(f"Retrieved {len(flows)} flows for project {project_id}")
        for flow in flows:
            print(f"Flow: {flow.name}, has {len(flow.high_level_requirement_list if hasattr(flow, 'high_level_requirement_list') else [])} HLRs")
        
        # Manually convert ORM objects to Pydantic models
        pydantic_flows = []
        for flow in flows:
            # Create UserFlow model
            pydantic_flow = schemas.UserFlow(
                id=flow.id,
                name=flow.name,
                description=flow.description,
                project_id=flow.project_id,
                created_at=flow.created_at,
                high_level_requirement_list=[],
                uiid=flow.uiid
            )
            
            # Add high level requirements
            for hlr in flow.high_level_requirement_list:
                pydantic_hlr = schemas.HighLevelRequirement(
                    id=hlr.id,
                    name=hlr.name,
                    description=hlr.description,
                    created_at=hlr.created_at,
                    low_level_requirement_list=[],
                    uiid=hlr.uiid,
                    parent_uiid=hlr.parent_uiid
                )
                
                # Add low level requirements
                for llr in hlr.low_level_requirement_list:
                    pydantic_llr = schemas.LowLevelRequirement(
                        id=llr.id,
                        name=llr.name,
                        description=llr.description,
                        created_at=llr.created_at,
                        test_case_list=[],
                        uiid=llr.uiid,
                        parent_uiid=llr.parent_uiid
                    )
                    
                    # Add test cases
                    for tc in llr.test_case_list:
                        pydantic_tc = schemas.TestCase(
                            id=tc.id,
                            name=tc.name,
                            description=tc.description,
                            created_at=tc.created_at,
                            uiid=tc.uiid,
                            parent_uiid=tc.parent_uiid
                        )
                        pydantic_llr.test_case_list.append(pydantic_tc)
                    
                    pydantic_hlr.low_level_requirement_list.append(pydantic_llr)
                
                pydantic_flow.high_level_requirement_list.append(pydantic_hlr)
            
            pydantic_flows.append(pydantic_flow)
        
        # Create and return response with manually converted objects
        return schemas.ProjectRequirementsResponse(project_id=project_id, flows=pydantic_flows)
    
    except ValueError as e: # Catch 'Project not found' from service
         raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        # Enhanced error logging
        import traceback
        print(f"ERROR retrieving requirements for project {project_id}: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        # Try to provide more details about the error
        print(f"Error type: {type(e).__name__}")
        print(f"Error args: {getattr(e, 'args', None)}")
        if hasattr(e, '__cause__'):
            print(f"Cause: {e.__cause__}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error retrieving requirements: {str(e)}")

@router.post(
    "/{project_id}/generate-hlr-from-flows",
    response_model=schemas.GenerationTriggerResponse
)
def generate_hlr_from_flows_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    service: RequirementGenerationService = Depends(lambda: req_gen_service)
):
    """
    Generates high-level requirements automatically from existing user flows.
    """
    try:
        # Get existing flows 
        flows = service.get_project_requirements(db=db, project_id=project_id)
        
        if not flows:
            raise ValueError(f"No flows found for project with ID {project_id}")
        
        # Create a basic generated data structure
        generated_data = {
            "flows": []
        }
        
        # Add each flow to the generated data with an empty high_level_requirement_list
        # The save_requirements method will automatically create high-level requirements
        for flow in flows:
            generated_data["flows"].append({
                "name": flow.name,
                "description": flow.description,
                "high_level_requirement_list": []
            })
        
        # Save the requirements, which will auto-generate HLRs for each flow
        service.save_requirements(db, project_id, generated_data)
        
        return schemas.GenerationTriggerResponse(
            message="Successfully generated high-level requirements from user flows",
            project_id=project_id
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        # Enhanced error logging
        import traceback
        print(f"ERROR generating HLRs from flows for project {project_id}: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal server error: {str(e)}")