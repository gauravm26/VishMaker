"""
DynamoDB waitlist model for users lambda
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, EmailStr

from ...dynamodb.code.dynamodb_core import (
    create_item, get_item, update_item, delete_item, 
    query_items, scan_items, format_timestamp,
    TABLE_NAMES
)

#--------------------------------
# Pydantic Models (for API validation)
#--------------------------------

class WaitlistBase(BaseModel):
    email: EmailStr
    status: str = Field(default="pending", regex="^(pending|contacted|converted)$")
    notes: Optional[str] = Field(None, max_length=500)

class WaitlistCreate(WaitlistBase):
    pass

class WaitlistUpdate(BaseModel):
    status: Optional[str] = Field(None, regex="^(pending|contacted|converted)$")
    notes: Optional[str] = Field(None, max_length=500)

class Waitlist(WaitlistBase):
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

#--------------------------------
# DynamoDB Model (for database operations)
#--------------------------------

class WaitlistEntity:
    """DynamoDB Waitlist entity operations"""
    
    @staticmethod
    def create(waitlist_data: WaitlistCreate) -> Dict[str, Any]:
        """Create a new waitlist entry"""
        item = {
            "email": waitlist_data.email,
            "status": waitlist_data.status,
            "notes": waitlist_data.notes,
            "created_at": format_timestamp(),
            "updated_at": format_timestamp()
        }
        
        return create_item(TABLE_NAMES['waitlist'], item)
    
    @staticmethod
    def get_by_email(email: str) -> Dict[str, Any]:
        """Get waitlist entry by email"""
        key = {"email": email}
        return get_item(TABLE_NAMES['waitlist'], key)
    
    @staticmethod
    def get_by_status(status: str) -> Dict[str, Any]:
        """Get all waitlist entries by status"""
        return query_items(
            TABLE_NAMES['waitlist'],
            "status = :status",
            {":status": status},
            "status-index"
        )
    
    @staticmethod
    def get_all() -> Dict[str, Any]:
        """Get all waitlist entries"""
        return scan_items(TABLE_NAMES['waitlist'])
    
    @staticmethod
    def update(email: str, update_data: WaitlistUpdate) -> Dict[str, Any]:
        """Update a waitlist entry"""
        key = {"email": email}
        
        update_expression = "SET updated_at = :updated_at"
        expression_values = {":updated_at": format_timestamp()}
        
        if update_data.status is not None:
            update_expression += ", #status = :status"
            expression_values[":status"] = update_data.status
            expression_values["#status"] = "status"  # Reserved word handling
        
        if update_data.notes is not None:
            update_expression += ", notes = :notes"
            expression_values[":notes"] = update_data.notes
        
        return update_item(TABLE_NAMES['waitlist'], key, update_expression, expression_values)
    
    @staticmethod
    def delete(email: str) -> Dict[str, Any]:
        """Delete a waitlist entry"""
        key = {"email": email}
        return delete_item(TABLE_NAMES['waitlist'], key)
    
    @staticmethod
    def exists(email: str) -> bool:
        """Check if a waitlist entry exists"""
        result = WaitlistEntity.get_by_email(email)
        return result['status'] == 'success' and 'data' in result
    
    @staticmethod
    def get_stats() -> Dict[str, Any]:
        """Get waitlist statistics"""
        try:
            # Get all entries
            all_result = WaitlistEntity.get_all()
            if all_result['status'] != 'success':
                return {"status": "error", "message": "Failed to get waitlist data"}
            
            all_entries = all_result['data']
            total_count = len(all_entries)
            
            # Count by status
            status_counts = {}
            for entry in all_entries:
                status = entry.get('status', 'unknown')
                status_counts[status] = status_counts.get(status, 0) + 1
            
            return {
                "status": "success",
                "data": {
                    "total_count": total_count,
                    "status_counts": status_counts,
                    "pending_count": status_counts.get('pending', 0),
                    "contacted_count": status_counts.get('contacted', 0),
                    "converted_count": status_counts.get('converted', 0)
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    @staticmethod
    def bulk_update_status(emails: List[str], new_status: str) -> Dict[str, Any]:
        """Bulk update status for multiple emails"""
        if new_status not in ['pending', 'contacted', 'converted']:
            return {"status": "error", "message": "Invalid status"}
        
        results = []
        for email in emails:
            update_data = WaitlistUpdate(status=new_status)
            result = WaitlistEntity.update(email, update_data)
            results.append({
                "email": email,
                "result": result
            })
        
        success_count = sum(1 for r in results if r['result']['status'] == 'success')
        
        return {
            "status": "success",
            "data": {
                "total_processed": len(emails),
                "success_count": success_count,
                "failed_count": len(emails) - success_count,
                "results": results
            }
        } 