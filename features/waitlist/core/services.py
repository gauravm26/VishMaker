# features/waitlist/core/services.py
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from local.db.waitlist import WaitlistEntity
from features.waitlist.api.schemas import WaitlistCreateRequest, WaitlistUpdateRequest
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

def add_to_waitlist(db: Session, email_data: WaitlistCreateRequest) -> dict:
    """
    Add an email to the waitlist
    
    Args:
        db: Database session
        email_data: Waitlist creation request data
        
    Returns:
        Dictionary with status and data/message
    """
    try:
        # Check if email already exists
        existing = db.query(WaitlistEntity).filter(WaitlistEntity.email == email_data.email).first()
        if existing:
            return {
                "status": "error",
                "message": "Email already exists in waitlist",
                "data": None
            }
        
        # Create new waitlist entry
        waitlist_entry = WaitlistEntity(
            email=email_data.email,
            status="pending"
        )
        
        db.add(waitlist_entry)
        db.commit()
        db.refresh(waitlist_entry)
        
        logger.info(f"Added email {email_data.email} to waitlist")
        
        return {
            "status": "success",
            "message": "Successfully added to waitlist",
            "data": waitlist_entry
        }
        
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error adding email to waitlist: {str(e)}")
        return {
            "status": "error",
            "message": "Email already exists in waitlist",
            "data": None
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding email to waitlist: {str(e)}")
        return {
            "status": "error",
            "message": "Failed to add email to waitlist",
            "data": None
        }

def get_waitlist_entries(db: Session, skip: int = 0, limit: int = 100) -> List[WaitlistEntity]:
    """
    Get all waitlist entries with pagination
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        
    Returns:
        List of waitlist entries
    """
    try:
        return db.query(WaitlistEntity).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error retrieving waitlist entries: {str(e)}")
        return []

def get_waitlist_count(db: Session) -> int:
    """
    Get total count of waitlist entries
    
    Args:
        db: Database session
        
    Returns:
        Total count of waitlist entries
    """
    try:
        return db.query(WaitlistEntity).count()
    except Exception as e:
        logger.error(f"Error getting waitlist count: {str(e)}")
        return 0

def update_waitlist_entry(db: Session, entry_id: int, update_data: WaitlistUpdateRequest) -> dict:
    """
    Update a waitlist entry
    
    Args:
        db: Database session
        entry_id: ID of the waitlist entry to update
        update_data: Data to update
        
    Returns:
        Dictionary with status and data/message
    """
    try:
        entry = db.query(WaitlistEntity).filter(WaitlistEntity.id == entry_id).first()
        if not entry:
            return {
                "status": "error",
                "message": "Waitlist entry not found",
                "data": None
            }
        
        # Update fields if provided
        if update_data.status is not None:
            entry.status = update_data.status
        if update_data.notes is not None:
            entry.notes = update_data.notes
            
        db.commit()
        db.refresh(entry)
        
        logger.info(f"Updated waitlist entry {entry_id}")
        
        return {
            "status": "success",
            "message": "Waitlist entry updated successfully",
            "data": entry
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating waitlist entry: {str(e)}")
        return {
            "status": "error",
            "message": "Failed to update waitlist entry",
            "data": None
        } 