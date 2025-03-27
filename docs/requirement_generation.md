# Requirement Generation Feature

## High-Level Functionality

The Requirement Generation feature uses AI to automatically generate software requirements from user prompts. It breaks down high-level project descriptions into:

1. User flows
2. High-level requirements (HLRs)
3. Low-level requirements (LLRs)
4. Test cases

These hierarchical requirements are visualized in a canvas interface that shows the relationships between different requirement levels.

## Folder Structure

```
features/requirement_generation/
├── api/                        # API endpoints and schemas
│   ├── __init__.py
│   ├── routes.py               # FastAPI route definitions
│   └── schemas.py              # Pydantic models for request/response validation
├── core/                       # Business logic
│   ├── __init__.py
│   ├── services.py             # Service layer with business logic
│   └── repositories.py         # Data access layer
└── tests/                      # Feature-specific tests
    └── __init__.py
```

## Data Flow

1. **Frontend to API**: 
   - User submits a project prompt through the UI
   - Frontend sends POST request to `/api/v1/requirements/generate/{project_id}`

2. **API to Service Layer**:
   - `routes.py` validates request using Pydantic models
   - Calls `generate_requirements_for_project()` in `services.py`

3. **Service to Repository Layer**:
   - Service processes the prompt using LLM (AI model)
   - Transforms AI output into domain models
   - Calls repository methods to persist the data

4. **Repository to Database**:
   - Repository methods map domain models to database models
   - Execute database operations through SQLAlchemy ORM
   - Store user flows, HLRs, LLRs, and test cases

5. **Database to Frontend Display**:
   - Frontend requests requirements via GET to `/api/v1/requirements/{project_id}`
   - Data is fetched from database and returned as JSON
   - Frontend transforms data using `transformRequirementsToFlow.ts`
   - Canvas display renders the hierarchical requirements

## Files Involved

### Backend Files

1. **API Layer**:
   - `features/requirement_generation/api/routes.py` - API endpoints for requirement generation
   - `features/requirement_generation/api/schemas.py` - Request/response data validation

2. **Service Layer**:
   - `features/requirement_generation/core/services.py` - Business logic for generating requirements
   - `features/requirement_generation/core/repositories.py` - Data access for requirements

3. **Shared Models**:
   - `shared/core/models/requirement.py` - Database models for requirements
   - `shared/core/models/__init__.py` - Model initialization

4. **Database Migrations**:
   - `infrastructure/db/alembic/versions/2aa122f533f5_add_test_case_model.py` - Migration for test cases table

### Frontend Files

1. **Canvas Components**:
   - `app-ui/src/components/canvas/CanvasViewer.tsx` - Main canvas component for displaying requirements
   - `app-ui/src/components/canvas/TableNode.tsx` - Component for rendering requirement tables

2. **Data Transformation**:
   - `app-ui/src/lib/transformRequirementsToFlow.ts` - Transforms API data to React Flow format

3. **Type Definitions**:
   - `app-ui/src/types/project.ts` - TypeScript interfaces for requirement data
   - `app-ui/src/types/canvas.ts` - TypeScript interfaces for canvas elements

4. **API Integration**:
   - `app-ui/src/lib/apiClient.ts` - HTTP client for API communication

5. **Project Dashboard**:
   - `app-ui/src/pages/ProjectDashboard.tsx` - Container for project visualization

## Flow Diagram

```
┌──────────────┐      ┌───────────────┐      ┌─────────────────┐      ┌───────────────┐
│              │      │               │      │                 │      │               │
│   React UI   ├──────►   Fast API    ├──────►    Services     ├──────►  Repositories │
│              │      │               │      │                 │      │               │
└──────┬───────┘      └───────────────┘      └─────────────────┘      └───────┬───────┘
       │                                                                      │
       │                                                                      │
       │                                                                      │
       │                                                                      ▼
┌──────▼───────┐                                                     ┌────────────────┐
│              │                                                     │                │
│    Canvas    │                                                     │   PostgreSQL   │
│    Display   │                                                     │   Database     │
│              │                                                     │                │
└──────────────┘                                                     └────────────────┘
``` 