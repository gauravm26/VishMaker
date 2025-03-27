# shared/core/models/project.py
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from infrastructure.db.base import Base # Import Base from the infrastructure setup

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    initial_prompt = Column(Text, nullable=True)
    # user_id = Column(Integer, ForeignKey("users.id")) # Add later when auth is implemented

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Add relationships later if needed, e.g., to requirements, flows, etc.
    # requirements = relationship("Requirement", back_populates="project")
