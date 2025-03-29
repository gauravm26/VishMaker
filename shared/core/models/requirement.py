# shared/core/models/requirement.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from infrastructure.db.db_core import Base

# --- User Flow ---
class UserFlow(Base):
    __tablename__ = "user_flows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project") # Relationship back to Project (optional but useful)
    steps = relationship("FlowStep", back_populates="user_flow", cascade="all, delete-orphan")

# --- Flow Step ---
# Represents a single step within a user flow (e.g., "Login Page", "Submit Credentials")
class FlowStep(Base):
    __tablename__ = "flow_steps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    order = Column(Integer, nullable=False, default=0) # To maintain order within a flow
    user_flow_id = Column(Integer, ForeignKey("user_flows.id"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user_flow = relationship("UserFlow", back_populates="steps")
    high_level_requirements = relationship("HighLevelRequirement", back_populates="flow_step", cascade="all, delete-orphan")

# --- High-Level Requirement (HLR) ---
class HighLevelRequirement(Base):
    __tablename__ = "high_level_requirements"

    id = Column(Integer, primary_key=True, index=True)
    requirement_text = Column(Text, nullable=False)
    flow_step_id = Column(Integer, ForeignKey("flow_steps.id"), nullable=False, index=True)
    # project_id could be added for easier querying, but derivable via flow_step -> user_flow
    # project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    flow_step = relationship("FlowStep", back_populates="high_level_requirements")
    low_level_requirements = relationship("LowLevelRequirement", back_populates="high_level_requirement", cascade="all, delete-orphan")

# --- Low-Level Requirement (LLR) ---
class LowLevelRequirement(Base):
    __tablename__ = "low_level_requirements"

    id = Column(Integer, primary_key=True, index=True)
    requirement_text = Column(Text, nullable=False)
    tech_stack_details = Column(Text, nullable=True) # e.g., specific component, function signature
    high_level_requirement_id = Column(Integer, ForeignKey("high_level_requirements.id"), nullable=False, index=True)
    # project_id could be added for easier querying
    # project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    high_level_requirement = relationship("HighLevelRequirement", back_populates="low_level_requirements")
    # Add relationship to TestCases later if needed
    # test_cases = relationship("TestCase", back_populates="low_level_requirement")
    test_cases = relationship("TestCase", back_populates="low_level_requirement", cascade="all, delete-orphan")

class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(Text, nullable=False) # e.g., "Verify login with valid credentials"
    expected_result = Column(Text, nullable=True)
    low_level_requirement_id = Column(Integer, ForeignKey("low_level_requirements.id"), nullable=False, index=True)
    # project_id could be added for easier querying
    # project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    low_level_requirement = relationship("LowLevelRequirement", back_populates="test_cases")