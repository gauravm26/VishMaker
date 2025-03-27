# VishGoogle Features

This document provides an overview of all features in the VishGoogle platform and links to their detailed documentation.

## Core Features

### [Project Management](project_management.md)

The Project Management feature handles the creation, retrieval, updating, and deletion of projects in the VishGoogle platform. It serves as the foundation for organizing user data and provides the entry point for accessing other features.

**Key Components:**
- Project creation with initial prompts
- Project listing and details views
- Project editing and deletion
- Dashboard integration

### [Requirement Generation](requirement_generation.md)

The Requirement Generation feature uses AI to automatically generate software requirements from user prompts. It creates a hierarchical structure of user flows, high-level requirements, low-level requirements, and test cases.

**Key Components:**
- AI-based requirement generation from initial prompts
- Hierarchical requirements structure
- Storage and retrieval of complex requirement data
- Integration with canvas visualization

### [Canvas Editor](canvas_editor.md)

The Canvas Editor feature provides an interactive visualization and editing interface for project requirements. It allows users to navigate, view, and edit the hierarchical structure of generated requirements.

**Key Components:**
- Interactive canvas visualization
- Custom nodes for different requirement types
- Relationship visualization between requirements
- Zoom, pan, and interactive editing capabilities

### [Authentication](auth.md)

The Authentication feature handles user registration, login, token management, and access control in the VishGoogle platform, ensuring secure access to the application's features.

**Key Components:**
- User registration and login
- JWT token-based authentication
- Password security and encryption
- Protected route access

## Feature Integration

The diagram below shows how these features interact within the VishGoogle platform:

```
┌───────────────────┐
│                   │
│  Authentication   │◄────────────────────────┐
│                   │                         │
└─────────┬─────────┘                         │
          │                                   │
          │  Secures                          │
          ▼                                   │
┌───────────────────┐    Creates     ┌────────┴──────────┐
│                   │◄───────────────┤                   │
│  Project          │                │  User             │
│  Management       │───────────────►│  Interface        │
│                   │    Displays    │                   │
└─────────┬─────────┘                └─────────┬─────────┘
          │                                    │
          │  Initiates                         │
          ▼                                    │
┌───────────────────┐                          │
│                   │                          │
│  Requirement      │                          │
│  Generation       │                          │
│                   │                          │
└─────────┬─────────┘                          │
          │                                    │
          │  Visualizes                        │
          ▼                                    │
┌───────────────────┐                          │
│                   │                          │
│  Canvas           │◄─────────────────────────┘
│  Editor           │     Interacts
│                   │
└───────────────────┘
```

## Technology Stack

- **Frontend**: React.js with Tailwind CSS
- **API**: FastAPI
- **Backend**: Python
- **Database**: PostgreSQL in Docker

## Documentation Structure

Each feature's documentation follows a similar structure:

1. **High-Level Functionality**: Overview of the feature's purpose and capabilities
2. **Folder Structure**: Organization of code files for the feature
3. **Data Flow**: How data moves through the feature's components
4. **Files Involved**: Specific files that implement the feature
5. **Flow Diagram**: Visual representation of the feature's architecture

For implementation details, refer to the individual feature documentation files. 