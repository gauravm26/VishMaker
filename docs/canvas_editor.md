# Canvas Editor Feature

## High-Level Functionality

The Canvas Editor feature provides an interactive visualization and editing interface for project requirements. Its main functionalities include:

1. Rendering a graphical representation of user flows, requirements, and test cases
2. Allowing users to navigate through the hierarchy of project requirements
3. Supporting zoom, pan, and selection of elements in the canvas
4. Enabling users to modify and update requirements directly in the canvas
5. Visualizing relationships between different levels of requirements (flows, HLRs, LLRs, tests)

This feature serves as the primary visual interface for users to interact with the hierarchical structure of generated requirements.

## Folder Structure

```
features/canvas_editor/
├── api/                        # API endpoints for canvas operations
│   ├── __init__.py
│   ├── routes.py               # FastAPI route definitions for canvas data
│   └── schemas.py              # Pydantic models for canvas data
├── core/                       # Business logic
│   ├── __init__.py
│   ├── services.py             # Canvas data manipulation services
│   └── repositories.py         # Canvas data storage/retrieval
├── ui/                         # React components for canvas
│   ├── components/
│   │   ├── Canvas.tsx          # Main canvas container
│   │   ├── CanvasNode.tsx      # Node component for canvas elements
│   │   ├── CanvasEdge.tsx      # Edge component for relationships
│   │   ├── Toolbar.tsx         # Canvas editing toolbar
│   │   └── Controls.tsx        # Zoom/pan controls
└── tests/                      # Feature-specific tests
    └── __init__.py
```

## Data Flow

1. **Frontend to Canvas**:
   - User accesses the project dashboard
   - Canvas retrieves requirement data via `/api/v1/requirements/{project_id}`
   - Data is transformed into nodes and edges for visualization

2. **Canvas Interaction**:
   - User interacts with the canvas (zoom, pan, select)
   - React Flow manages canvas state and interactions
   - Selection events trigger UI updates for editing

3. **Editing Requirements**:
   - User modifies requirement data in the canvas
   - Changes are sent to API endpoints
   - Updated data is reflected in real-time in the canvas

4. **Canvas to Database**:
   - Modified requirement data is saved through the requirements API
   - Database is updated with new requirement information
   - Changes are persisted for future sessions

## Files Involved

### Backend Files

1. **API Layer**:
   - `features/canvas_editor/api/routes.py` - Canvas-specific API endpoints
   - `features/canvas_editor/api/schemas.py` - Canvas data models

2. **Service Layer**:
   - `features/canvas_editor/core/services.py` - Canvas data processing services
   - `features/canvas_editor/core/repositories.py` - Canvas layout storage/retrieval

3. **Shared Components**:
   - `features/requirement_generation/api/routes.py` - Requirements API used by canvas
   - `shared/core/models/requirement.py` - Requirement database models

### Frontend Files

1. **Canvas Components**:
   - `app-ui/src/components/canvas/CanvasViewer.tsx` - Main canvas component
   - `app-ui/src/components/canvas/TableNode.tsx` - Custom node for requirements tables

2. **Data Transformation**:
   - `app-ui/src/lib/transformRequirementsToFlow.ts` - Transforms API data to React Flow format

3. **Type Definitions**:
   - `app-ui/src/types/canvas.ts` - Canvas-specific TypeScript interfaces
   - `app-ui/src/types/project.ts` - Project and requirement interfaces

4. **React Flow Integration**:
   - `app-ui/src/components/canvas/CanvasControls.tsx` - Canvas control components
   - Third-party library: ReactFlow - Used for canvas rendering

5. **Pages**:
   - `app-ui/src/pages/ProjectDashboard.tsx` - Container for canvas editor

## Canvas Components

### Nodes

The canvas uses several custom node types to represent different elements of the requirements hierarchy:

1. **TableNode**: Displays tabular data for flows, requirements, and test cases
2. **FlowNode**: Represents user flows (navigation paths)
3. **RequirementNode**: Shows requirement details with editable fields
4. **TestCaseNode**: Displays test cases with pass/fail status

### Edges

Edges represent relationships between elements and are rendered with different styles:

1. **Flow-to-HLR**: Connects user flows to high-level requirements
2. **HLR-to-LLR**: Connects high-level requirements to low-level requirements
3. **LLR-to-Test**: Connects low-level requirements to test cases

## React Flow Integration

The canvas editor leverages React Flow for its interactive capabilities:

1. **Layout**: Automatic layout of nodes and edges
2. **Interaction**: Zoom, pan, and selection behaviors
3. **Customization**: Custom nodes and edges for specific requirements
4. **State Management**: Managing the state of the canvas elements

## Flow Diagram

```
┌──────────────┐      ┌───────────────┐      ┌─────────────────┐      ┌───────────────┐
│              │      │               │      │                 │      │               │
│  Canvas UI   ├──────►   React Flow  ├──────►  Transformation ├──────►  Requirements │
│  Components  │      │   Library     │      │  Functions      │      │  API          │
│              │      │               │      │                 │      │               │
└──────┬───────┘      └───────┬───────┘      └────────┬────────┘      └───────┬───────┘
       │                      │                       │                        │
       │                      │                       │                        │
       │                      │                       │                        │
       ▼                      ▼                       ▼                        ▼
┌──────────────┐      ┌───────────────┐      ┌─────────────────┐      ┌───────────────┐
│              │      │               │      │                 │      │               │
│  User        │      │  Canvas       │      │  Data Models    │      │  PostgreSQL   │
│  Interaction │      │  State        │      │  (TypeScript)   │      │  Database     │
│              │      │               │      │                 │      │               │
└──────────────┘      └───────────────┘      └─────────────────┘      └───────────────┘
```

## Key Features

1. **Interactive Visualization**:
   - Hierarchical display of requirements
   - Relationship visualization between different levels
   - Zoom and pan capabilities

2. **Custom Nodes**:
   - TableNode for displaying tabular data
   - Customized styling for different requirement types
   - Interactive elements within nodes

3. **Performance Optimizations**:
   - Virtualized rendering for large requirements sets
   - Efficient data transformation
   - Responsive layout for different screen sizes

4. **Integration with Requirements**:
   - Seamless connection to requirement generation
   - Real-time updates when requirements change
   - Consistent visualization of the requirements hierarchy 