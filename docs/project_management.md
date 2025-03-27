# Project Management Feature

## High-Level Functionality

The Project Management feature handles the creation, retrieval, updating, and deletion of projects in the VishGoogle platform. It provides the foundation for managing user projects, including:

1. Creating new projects with an initial prompt
2. Listing all projects for a user
3. Viewing project details
4. Updating project information
5. Deleting projects

This feature serves as the entry point for users to start working with the system and organize their generated requirements.

## Folder Structure

```
features/project_management/
├── api/                        # API endpoints and schemas
│   ├── __init__.py
│   ├── routes.py               # FastAPI route definitions
│   └── schemas.py              # Pydantic models for request/response validation
├── core/                       # Business logic
│   ├── __init__.py
│   ├── services.py             # Service layer with business logic
│   └── repositories.py         # Data access layer
├── ui/                         # React components specific to project management
│   ├── components/
│   │   ├── ProjectList.tsx     # List of projects component
│   │   ├── ProjectForm.tsx     # Project creation/edit form
│   │   └── ProjectCard.tsx     # Project card display component
└── tests/                      # Feature-specific tests
    └── __init__.py
```

## Data Flow

1. **Frontend to API**: 
   - User interacts with project management UI (create/view/edit/delete)
   - Frontend sends appropriate HTTP requests to `/api/v1/projects/` endpoints

2. **API to Service Layer**:
   - `routes.py` validates requests using Pydantic models in `schemas.py`
   - Calls appropriate methods in `services.py` (e.g., `create_project()`, `get_projects()`)

3. **Service to Repository Layer**:
   - Service implements business logic around projects
   - Calls repository methods to interact with the database

4. **Repository to Database**:
   - Repository methods map between domain models and database models
   - Execute database operations through SQLAlchemy ORM
   - Store and retrieve project data from PostgreSQL

5. **Database to Frontend Display**:
   - API returns project data as JSON
   - Frontend renders projects in various views (list, detail, edit)

## Files Involved

### Backend Files

1. **API Layer**:
   - `features/project_management/api/routes.py` - API endpoints for project operations
   - `features/project_management/api/schemas.py` - Project request/response data models

2. **Service Layer**:
   - `features/project_management/core/services.py` - Business logic for project operations
   - `features/project_management/core/repositories.py` - Data access for projects

3. **Shared Models**:
   - `shared/core/models/project.py` - Database model for projects
   - `shared/core/models/__init__.py` - Model initialization

4. **Database Migrations**:
   - `infrastructure/db/alembic/versions/xxxx_create_projects_table.py` - Migration for projects table

### Frontend Files

1. **Project UI Components**:
   - `features/project_management/ui/components/ProjectList.tsx` - List of projects
   - `features/project_management/ui/components/ProjectForm.tsx` - Create/edit project form
   - `features/project_management/ui/components/ProjectCard.tsx` - Individual project display

2. **Shared UI Components**:
   - `app-ui/src/components/common/Button.tsx` - Reusable button component
   - `app-ui/src/components/common/Card.tsx` - Reusable card component
   - `app-ui/src/components/common/Modal.tsx` - Reusable modal component

3. **Pages**:
   - `app-ui/src/pages/ProjectsPage.tsx` - Projects list page
   - `app-ui/src/pages/ProjectDashboard.tsx` - Project details page

4. **API Integration**:
   - `app-ui/src/lib/apiClient.ts` - HTTP client for API communication

5. **Type Definitions**:
   - `app-ui/src/types/project.ts` - TypeScript interfaces for project data

## API Endpoints

| Method | Endpoint                 | Description                 | Request Body            | Response                   |
|--------|--------------------------|-----------------------------|--------------------------|-----------------------------|
| GET    | `/api/v1/projects`       | List all projects           | -                        | Array of Project objects    |
| GET    | `/api/v1/projects/{id}`  | Get project by ID           | -                        | Project object             |
| POST   | `/api/v1/projects`       | Create new project          | `{name, initial_prompt}` | Created Project object     |
| PUT    | `/api/v1/projects/{id}`  | Update project              | `{name, initial_prompt}` | Updated Project object     |
| DELETE | `/api/v1/projects/{id}`  | Delete project              | -                        | 204 No Content             |

## Flow Diagram

```
┌──────────────┐      ┌───────────────┐      ┌─────────────────┐      ┌───────────────┐
│              │      │               │      │                 │      │               │
│   React UI   ├──────►   Fast API    ├──────►    Services     ├──────►  Repositories │
│  (Projects)  │      │  (Projects)   │      │   (Projects)    │      │  (Projects)   │
│              │      │               │      │                 │      │               │
└──────┬───────┘      └───────────────┘      └─────────────────┘      └───────┬───────┘
       │                                                                      │
       │                                                                      │
       │                                                                      │
       ▼                                                                      ▼
┌──────────────┐                                                     ┌────────────────┐
│              │                                                     │                │
│  Project UI  │                                                     │   PostgreSQL   │
│ (List/Detail)│                                                     │   (projects)   │
│              │                                                     │                │
└──────────────┘                                                     └────────────────┘
``` 