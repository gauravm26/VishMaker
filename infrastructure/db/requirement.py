# shared/core/models/requirement.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from infrastructure.db.db_core import Base

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
    requirement_text = Column(Text, nullable=False)
    user_flow_id = Column(Integer, ForeignKey("user_flows.id"), nullable=False, index=True)
    order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_user_flow = relationship("UserFlowEntity", back_populates="high_level_requirement_list")
    low_level_requirement_list = relationship("LowLevelRequirementEntity", back_populates="parent_high_level_requirement", cascade="all, delete-orphan")

# --- Low-Level Requirement (LLR) ---
class LowLevelRequirementEntity(Base):
    __tablename__ = "low_level_requirements"

    id = Column(Integer, primary_key=True, index=True)
    requirement_text = Column(Text, nullable=False)
    tech_stack_details = Column(Text, nullable=True) # e.g., specific component, function signature
    high_level_requirement_id = Column(Integer, ForeignKey("high_level_requirements.id"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_high_level_requirement = relationship("HighLevelRequirementEntity", back_populates="low_level_requirement_list")
    test_case_list = relationship("TestCaseEntity", back_populates="parent_low_level_requirement", cascade="all, delete-orphan")

class TestCaseEntity(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(Text, nullable=False) # e.g., "Verify login with valid credentials"
    expected_result = Column(Text, nullable=True)
    low_level_requirement_id = Column(Integer, ForeignKey("low_level_requirements.id"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_low_level_requirement = relationship("LowLevelRequirementEntity", back_populates="test_case_list")