# features/waitlist/api/schemas.py
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class WaitlistCreateRequest(BaseModel):
    email: EmailStr

class WaitlistResponse(BaseModel):
    id: int
    email: str
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WaitlistUpdateRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None 