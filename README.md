# VishGoogle

Full-Product Generation Platform using Agentic Coding.

## Architecture Overview

This project follows a **Vertical Slice Architecture** pattern, which organizes code around features rather than technical layers. Each feature contains all the components it needs (UI, API, business logic, data access) to function independently.

### Benefits of Vertical Slice Architecture

- **Feature Cohesion**: All code related to a specific feature is located together
- **Isolated Changes**: Modifications to one feature have minimal impact on others
- **Clear Boundaries**: Features have well-defined interfaces and dependencies
- **Independent Development**: Teams can work on different features with minimal coordination

## Tech Stack

- **Frontend**: React.js with Tailwind CSS for styling
- **API**: FastAPI for high-performance REST API endpoints
- **Backend**: Python for business logic and data processing
- **Database**: PostgreSQL running in Docker for data persistence
- **Development**: Docker for consistent development and deployment environments

## Project Structure

```
VishGoogle/
├── app-ui/                # Frontend application with reusable UI components
├── app-api/               # Backend API entry points and configuration
├── shared/                # Shared code used across features
├── config/                # Application configuration
├── infrastructure/        # Infrastructure concerns (database, migrations, etc.)
├── docs/                  # Documentation
├── tests/                 # Project-wide tests
├── scripts/               # Utility scripts
└── features/              # Feature modules (vertical slices)
    ├── auth/              # Authentication feature
    ├── project_management/  # Project management feature
    ├── requirement_generation/  # Requirement generation feature
    └── canvas_editor/     # Canvas editing feature
```

### Feature Structure

Each feature in the `features/` directory follows a similar structure:

```
feature_name/
├── api/                   # API routes, controllers, schemas
├── core/                  # Business logic, services, repositories
├── tests/                 # Feature-specific tests
└── (optional) ui/         # Feature-specific UI components
```

## Principles

1. **Feature First**: Code is organized around business features, not technical layers
2. **Self-Contained**: Each feature has all the components it needs
3. **Shared Code Minimization**: Only truly common code is placed in shared directories
4. **Clear Dependencies**: Dependencies between features are explicitly defined

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/VishGoogle.git
   cd VishGoogle
   ```

2. Set up the backend:
   ```
   # Create and activate virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Run migrations
   alembic upgrade head
   
   # Start the backend server
   uvicorn app-api.main:app --reload
   ```

3. Set up the frontend:
   ```
   cd app-ui
   npm install
   npm run dev
   ```

## Contributing

1. Each new feature should be added as a new directory under `features/`
2. Reusable components should be placed in `app-ui/` or `shared/`
3. Follow the existing patterns for consistency

## License

This project is licensed under the MIT License - see the LICENSE file for details.
