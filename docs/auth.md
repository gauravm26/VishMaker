# Authentication Feature

## High-Level Functionality

The Authentication feature handles user registration, login, token management, and access control in the VishGoogle platform. Its core functionalities include:

1. User registration and account creation
2. User login and authentication
3. JWT token generation and validation
4. Password hashing and verification
5. Role-based access control
6. Session management

This feature provides the security foundation for the entire application, ensuring that users can only access data and operations they are authorized for.

## Folder Structure

```
features/auth/
├── api/                        # API endpoints and schemas
│   ├── __init__.py
│   ├── routes.py               # FastAPI route definitions for auth
│   ├── schemas.py              # Pydantic models for auth requests/responses
│   └── dependencies.py         # Auth dependencies (e.g., get_current_user)
├── core/                       # Business logic
│   ├── __init__.py
│   ├── services.py             # Auth service with login/register logic
│   ├── repositories.py         # User data access
│   ├── security.py             # Password hashing, JWT functions
│   └── permissions.py          # Permission checking utilities
├── ui/                         # React components specific to auth
│   ├── components/
│   │   ├── LoginForm.tsx       # Login form component
│   │   ├── RegisterForm.tsx    # Registration form component
│   │   └── ProtectedRoute.tsx  # Route wrapper for authentication
└── tests/                      # Feature-specific tests
    └── __init__.py
```

## Data Flow

1. **Frontend to API**: 
   - User submits login/register form
   - Frontend sends credentials to `/api/v1/auth/token` or `/api/v1/auth/register`
   - Auth token is received and stored in local storage

2. **API to Service Layer**:
   - `routes.py` validates credentials using Pydantic models
   - Calls `authenticate_user()` or `register_user()` in `services.py`

3. **Service to Security Layer**:
   - Service verifies credentials or creates new users
   - Passwords are hashed using `security.py` functions
   - JWT tokens are generated for authenticated users

4. **Protected Resources**:
   - Subsequent API requests include JWT token in Authorization header
   - `dependencies.py` provides `get_current_user` to validate tokens
   - Protected endpoints use the dependency to ensure authentication

5. **Frontend Authentication Flow**:
   - `ProtectedRoute.tsx` checks for valid token before rendering pages
   - Unauthorized users are redirected to login page
   - Token expiration is handled by refreshing or redirecting to login

## Files Involved

### Backend Files

1. **API Layer**:
   - `features/auth/api/routes.py` - Endpoints for login, register, refresh token
   - `features/auth/api/schemas.py` - Auth request/response validation models
   - `features/auth/api/dependencies.py` - Auth middleware and dependencies

2. **Service Layer**:
   - `features/auth/core/services.py` - Authentication and user management logic
   - `features/auth/core/repositories.py` - User data access methods
   - `features/auth/core/security.py` - JWT and password security utilities
   - `features/auth/core/permissions.py` - Permission checking utilities

3. **Shared Models**:
   - `shared/core/models/user.py` - User database model
   - `shared/core/models/__init__.py` - Model initialization

4. **Database Migrations**:
   - `infrastructure/db/alembic/versions/xxxx_create_users_table.py` - Migration for users table

### Frontend Files

1. **Auth UI Components**:
   - `features/auth/ui/components/LoginForm.tsx` - Login form and logic
   - `features/auth/ui/components/RegisterForm.tsx` - Registration form and logic
   - `features/auth/ui/components/ProtectedRoute.tsx` - Auth-protected route component

2. **Shared UI Components**:
   - `app-ui/src/components/common/Button.tsx` - Reusable button component
   - `app-ui/src/components/common/Input.tsx` - Form input component
   - `app-ui/src/components/common/Form.tsx` - Form container component

3. **Pages**:
   - `app-ui/src/pages/LoginPage.tsx` - Login page
   - `app-ui/src/pages/RegisterPage.tsx` - Registration page

4. **Auth Utilities**:
   - `app-ui/src/lib/auth.ts` - Frontend authentication utilities
   - `app-ui/src/lib/apiClient.ts` - HTTP client with auth token handling

5. **Context and Hooks**:
   - `app-ui/src/contexts/AuthContext.tsx` - React context for auth state
   - `app-ui/src/hooks/useAuth.ts` - Custom hook for auth operations

## API Endpoints

| Method | Endpoint                 | Description                 | Request Body               | Response                  |
|--------|--------------------------|-----------------------------|-----------------------------|----------------------------|
| POST   | `/api/v1/auth/register`  | Register new user           | `{email, password, name}`   | User object with token    |
| POST   | `/api/v1/auth/token`     | Login and get token         | `{email, password}`         | Access and refresh tokens |
| POST   | `/api/v1/auth/refresh`   | Refresh access token        | `{refresh_token}`           | New access token         |
| GET    | `/api/v1/auth/me`        | Get current user info       | -                           | Current user data        |
| POST   | `/api/v1/auth/logout`    | Logout and invalidate token | -                           | Success message          |

## Security Considerations

1. **Password Management**:
   - Passwords are hashed using bcrypt before storage
   - No plaintext passwords are ever stored or logged

2. **Token Security**:
   - JWTs have configurable expiration times
   - Tokens include user roles for authorization
   - Refresh tokens are handled securely

3. **API Protection**:
   - All sensitive endpoints are protected by authentication
   - Role-based access control for sensitive operations

## Flow Diagram

```
┌──────────────┐      ┌───────────────┐      ┌─────────────────┐      ┌───────────────┐
│              │      │               │      │                 │      │               │
│  Login/      ├──────►   Auth API    ├──────►  Auth Service   ├──────►  Repository   │
│  Register UI │      │               │      │                 │      │               │
│              │      │               │      │                 │      │               │
└──────┬───────┘      └───────┬───────┘      └────────┬────────┘      └───────┬───────┘
       │                      │                       │                        │
       │                      │                       │                        │
       │                      │                       │                        │
       │                      ▼                       │                        ▼
┌──────▼───────┐      ┌───────────────┐      ┌───────▼─────────┐      ┌───────────────┐
│              │      │               │      │                 │      │               │
│  Protected   │◄─────┤  JWT Token    │◄─────┤  Password Hash  │      │  PostgreSQL   │
│  Application │      │  Validation   │      │  & Security     │      │  (users)      │
│              │      │               │      │                 │      │               │
└──────────────┘      └───────────────┘      └─────────────────┘      └───────────────┘
``` 