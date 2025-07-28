# shared/core/models/requirement.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from local.db.db_core import Base

class ProjectEntity(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    initial_prompt = Column(Text, nullable=True)
    # user_id = Column(Integer, ForeignKey("users.id")) # Add later when auth is implemented

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Add relationship to UserFlow with cascade delete
    user_flow_list = relationship("UserFlowEntity", back_populates="parent_project", cascade="all, delete-orphan", passive_deletes=True)

    # Add relationships later if needed, e.g., to requirements, flows, etc.
    # requirements = relationship("Requirement", back_populates="project")

# --- User Flow ---
class UserFlowEntity(Base):
    __tablename__ = "user_flows"
    id = Column(Integer, primary_key=True, index=True)
    uiid = Column(String(255), nullable=False, unique=True, index=True)  # Add unique constraint and index
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_project = relationship("ProjectEntity", back_populates="user_flow_list") # Relationship back to Project (optional but useful)
    high_level_requirement_list = relationship("HighLevelRequirementEntity", back_populates="parent_user_flow", cascade="all, delete-orphan")

# --- High-Level Requirement (HLR) ---
class HighLevelRequirementEntity(Base):
    __tablename__ = "high_level_requirements"

    id = Column(Integer, primary_key=True, index=True)
    uiid = Column(String(255), nullable=False, unique=True, index=True)  # Add unique constraint and index
    parent_uiid = Column(String(255), ForeignKey("user_flows.uiid"), nullable=False, index=True)  # Foreign key to UserFlowEntity.uiid
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
   
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_user_flow = relationship("UserFlowEntity", back_populates="high_level_requirement_list")
    low_level_requirement_list = relationship("LowLevelRequirementEntity", back_populates="parent_high_level_requirement", cascade="all, delete-orphan")

# --- Low-Level Requirement (LLR) ---
class LowLevelRequirementEntity(Base):
    __tablename__ = "low_level_requirements"

    id = Column(Integer, primary_key=True, index=True)
    uiid = Column(String(255), nullable=False, unique=True, index=True)  # Add unique constraint and index
    parent_uiid = Column(String(255), ForeignKey("high_level_requirements.uiid"), nullable=False, index=True)  # Foreign key to HighLevelRequirementEntity.uiid
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_high_level_requirement = relationship("HighLevelRequirementEntity", back_populates="low_level_requirement_list")
    test_case_list = relationship("TestCaseEntity", back_populates="parent_low_level_requirement", cascade="all, delete-orphan")

class TestCaseEntity(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    uiid = Column(String(255), nullable=False, unique=True, index=True)  # Add unique constraint and index
    parent_uiid = Column(String(255), ForeignKey("low_level_requirements.uiid"), nullable=False, index=True)  # Foreign key to LowLevelRequirementEntity.uiid
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)    

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_low_level_requirement = relationship("LowLevelRequirementEntity", back_populates="test_case_list")