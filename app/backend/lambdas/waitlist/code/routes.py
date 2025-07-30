# features/waitlist/api/routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from local.db.db_core import get_db
from features.waitlist.api.schemas import WaitlistCreateRequest, WaitlistResponse, WaitlistUpdateRequest
from features.waitlist.core.services import (
    add_to_waitlist, 
    get_waitlist_entries, 
    get_waitlist_count,
    update_waitlist_entry
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/waitlist",
    tags=["Waitlist"]
)

@router.post("/", response_model=dict)
async def join_waitlist(
    request: WaitlistCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Add an email to the waitlist
    """
    try:
        result = add_to_waitlist(db, request)
        
        if result["status"] == "error":
            if "already exists" in result["message"]:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=result["message"]
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=result["message"]
                )
        
        return {
            "status": "success",
            "message": result["message"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in join_waitlist: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )

@router.get("/entries", response_model=List[WaitlistResponse])
async def get_waitlist(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all waitlist entries (admin endpoint)
    """
    try:
        entries = get_waitlist_entries(db, skip=skip, limit=limit)
        return entries
    except Exception as e:
        logger.error(f"Error retrieving waitlist entries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve waitlist entries"
        )

@router.get("/count")
async def get_waitlist_stats(db: Session = Depends(get_db)):
    """
    Get waitlist statistics
    """
    try:
        total_count = get_waitlist_count(db)
        return {
            "total_entries": total_count
        }
    except Exception as e:
        logger.error(f"Error getting waitlist stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve waitlist statistics"
        )

@router.put("/{entry_id}", response_model=WaitlistResponse)
async def update_waitlist(
    entry_id: int,
    request: WaitlistUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Update a waitlist entry (admin endpoint)
    """
    try:
        result = update_waitlist_entry(db, entry_id, request)
        
        if result["status"] == "error":
            if "not found" in result["message"]:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=result["message"]
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=result["message"]
                )
        
        return result["data"]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in update_waitlist: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        ) 