# shared/core/models/project.py
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from infrastructure.db.db_core import Base # Import Base from the db_core setup

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    initial_prompt = Column(Text, nullable=True)
    # user_id = Column(Integer, ForeignKey("users.id")) # Add later when auth is implemented

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Add relationship to UserFlow with cascade delete
    user_flows = relationship(
        "UserFlow", 
        back_populates="project", 
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    # Add relationships later if needed, e.g., to requirements, flows, etc.
    # requirements = relationship("Requirement", back_populates="project")
