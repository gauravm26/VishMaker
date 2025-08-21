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

## Communication Protocol: VishMaker ↔ VishCoder

VishMaker and VishCoder communicate through a standardized WebSocket protocol using structured JSON payloads. This ensures reliable, traceable, and extensible communication for all feature building and AI interactions.

### Payload Structure

All messages follow this standardized format:

```json
{
  "version": "1.0",
  "messageId": "uuid",
  "threadId": "uuid",
  "actor": "System|User|Coder",
  "type": "build_feature|question_to_ai|clarification_needed_from_user|status_update|heartbeat",
  "status": "Initiated|InProgress|Completed|Failed|Error",
  "timestamp": "2025-08-20T20:05:00Z",
  "origin": {
    "originMessageId": "uuid",
    "originActor": "System|User|Coder",
    "respondingToMessageId": "uuid",
    "respondingToActor": "System|User|Coder"
  },
    "body": {
    "contract": { "metadata": {}, "settings": {}, "requirements": {}, "statusDetails": {} },
    "messages": {},
    "statusDetails": {}
  }
```

### Field Definitions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `version` | string | Protocol version | `"1.0"` |
| `messageId` | string | Unique message identifier | `"msg_123e4567-e89b-12d3-a456-426614174000"` |
| `threadId` | string | Conversation thread identifier | `"thread_abc123"` |
| `actor` | string | Who is sending the message | `"System"`, `"User"`, `"Coder"` |
| `type` | string | Message type/category | `"build_feature"`, `"question_to_ai"` |
| `status` | string | Current status of the operation | `"Initiated"`, `"InProgress"`, `"Completed"` |
| `timestamp` | string | ISO 8601 timestamp | `"2025-08-20T20:05:00Z"` |
| `origin` | object | Message origin and response tracking | See origin structure below |
| `body` | object | Message body containing contract, messages, and statusDetails | See body structure below |

### Origin Structure

```json
{
  "originMessageId": "uuid",        // Root message that started the conversation
  "originActor": "System|User|Coder", // Who started the conversation
  "respondingToMessageId": "uuid",  // Message being responded to (if applicable)
  "respondingToActor": "System|User|Coder" // Who sent the message being responded to
}
```

### Body Structure

```json
{
  "body": {
    "contract": {
      "metadata": {},
      "settings": {},
      "requirements": {},
      "statusDetails": {}
    },
    "messages": {
      "question_text": "",
      "response_text": "",
      "context": "",
      "clarification_needed": false
    },
    "statusDetails": {
      "agent": "",
      "LLM": "",
      "details": ""
    }
  }
}
```

**Body Fields**:
- **`contract`**: Contains build feature contract data (metadata, settings, requirements, statusDetails)
- **`messages`**: Contains communication messages (questions, responses, clarifications)
- **`statusDetails`**: Contains real-time status updates from agents and LLMs

### Message Types & Payloads

#### 1. Build Feature Request (`build_feature`)

**Purpose**: Initiate feature building process with contract data

**Payload Structure**:
```json
{
  "body": {
    "contract": {
      "metadata": {
        "initiatedBy": "user",
        "dateTime": "2025-08-20T20:05:00Z",
        "feature_Number": "0.0.1"
      },
      "settings": {
        "tech_stack": "react,fastapi,python,aws",
        "bundle": "serverless-starter"
      },
      "requirements": {
        "low_level_requirements": { "name": "FE-LOGOUT-003", "description": "..." },
        "high_level_requirements": { "name": "UI Requirements", "description": "..." },
        "user_flow": { "name": "Logout Process", "description": "..." },
        "test_cases": [{ "name": "Test Case 1", "description": "..." }]
      },
      "statusDetails": {
        "priority": "high",
        "estimatedEffort": "3 days",
        "dependencies": ["auth-service", "user-management"]
      }
    },
    "messages": {},
    "statusDetails": {}
  }
}
```

**Sample Message**:
```json
{
  "version": "1.0",
  "messageId": "msg_build_001",
  "threadId": "thread_logout_feature",
  "actor": "System",
  "type": "build_feature",
  "status": "Initiated",
  "timestamp": "2025-08-20T20:05:00Z",
  "origin": {
    "originMessageId": "msg_build_001",
    "originActor": "System",
    "respondingToMessageId": null,
    "respondingToActor": null
  },
  "payload": {
    "contract": {
      "metadata": { "initiatedBy": "user", "dateTime": "2025-08-20T20:05:00Z", "feature_Number": "0.0.1" },
      "settings": { "tech_stack": "react,fastapi,python,aws" },
      "requirements": { "low_level_requirements": { "name": "FE-LOGOUT-003" } }
    }
  }
}
```

#### 2. AI Chat Question (`question_to_ai`)

**Purpose**: Ask AI questions about contracts, requirements, or technical details

**Body Structure**:
```json
{
  "body": {
    "contract": {},
    "messages": {
      "question_text": "What are the security considerations for this logout feature?",
      "response_text": null
    },
    "statusDetails": {}
  }
}
```

**Sample Message**:
```json
{
  "version": "1.0",
  "messageId": "msg_ai_001",
  "threadId": "thread_logout_feature",
  "actor": "User",
  "type": "question_to_ai",
  "status": "Initiated",
  "timestamp": "2025-08-20T20:05:00Z",
  "origin": {
    "originMessageId": "msg_build_001",
    "originActor": "System",
    "respondingToMessageId": "msg_build_001",
    "respondingToActor": "System"
  },
  "body": {
    "contract": {},
    "messages": {
      "question_text": "What are the security considerations for this logout feature?",
      "response_text": null
    },
    "statusDetails": {}
  }
}
```

#### 3. Status Update (`status_update`)

**Purpose**: Provide real-time updates on processing status

**Body Structure**:
```json
{
  "body": {
    "contract": {},
    "messages": {
      "message": "Processing build feature request...",
      "progress": 75,
      "currentStep": "Generating code files"
    },
    "statusDetails": {}
  }
}
```

**Sample Message**:
```json
{
  "version": "1.0",
  "messageId": "msg_status_001",
  "threadId": "thread_logout_feature",
  "actor": "Coder",
  "type": "status_update",
  "status": "InProgress",
  "timestamp": "2025-08-20T20:06:00Z",
  "origin": {
    "originMessageId": "msg_build_001",
    "originActor": "System",
    "respondingToMessageId": "msg_build_001",
    "respondingToActor": "System"
  },
  "body": {
    "contract": {},
    "messages": {
      "message": "Processing build feature request...",
      "progress": 75,
      "currentStep": "Generating code files"
    },
    "statusDetails": {}
  }
}
```

#### 4. Clarification Request (`clarification_needed_from_user`)

**Purpose**: Request additional information from the user

**Body Structure**:
```json
{
  "body": {
    "contract": {},
    "messages": {
      "question_text": "What authentication method should be used for the logout feature?",
      "context": "Current contract specifies JWT but doesn't detail the logout mechanism"
    },
    "statusDetails": {}
  }
}
```

**Sample Message**:
```json
{
  "version": "1.0",
  "messageId": "msg_clarify_001",
  "threadId": "thread_logout_feature",
  "actor": "Coder",
  "type": "clarification_needed_from_user",
  "status": "InProgress",
  "timestamp": "2025-08-20T20:07:00Z",
  "origin": {
    "originMessageId": "msg_build_001",
    "originActor": "System",
    "respondingToMessageId": "msg_build_001",
    "respondingToActor": "System"
  },
  "payload": {
    "message": {
      "question_text": "What authentication method should be used for the logout feature?",
      "context": "Current contract specifies JWT but doesn't detail the logout mechanism"
    }
  }
}
```

### Response Handling

#### Success Responses

**Build Feature Completed**:
```json
{
  "version": "1.0",
  "messageId": "msg_complete_001",
  "threadId": "thread_logout_feature",
  "actor": "Coder",
  "type": "build_feature",
  "status": "Completed",
  "timestamp": "2025-08-20T20:10:00Z",
  "origin": {
    "originMessageId": "msg_build_001",
    "originActor": "System",
    "respondingToMessageId": "msg_build_001",
    "respondingToActor": "System"
  },
  "body": {
    "contract": {
      "statusDetails": {
        "agent": "CodeGenerator",
        "LLM": "GPT-4",
        "details": "Build feature completed successfully. Generated 3 files: logout.js, logout.test.js, README.md. Total execution time: 5m 23s"
      }
    },
    "messages": {},
    "statusDetails": {
      "agent": "CodeGenerator",
      "LLM": "GPT-4",
      "details": "Build feature completed successfully. Generated 3 files: logout.js, logout.test.js, README.md. Total execution time: 5m 23s"
    }
  }
}
```

**AI Question Answered**:
```json
{
  "version": "1.0",
  "messageId": "msg_ai_response_001",
  "threadId": "thread_logout_feature",
  "actor": "Coder",
  "type": "question_to_ai",
  "status": "Completed",
  "timestamp": "2025-08-20T20:08:00Z",
  "origin": {
    "originMessageId": "msg_build_001",
    "originActor": "System",
    "respondingToMessageId": "msg_ai_001",
    "respondingToActor": "User"
  },
  "body": {
    "contract": {},
    "messages": {
      "question_text": "What are the security considerations for this logout feature?",
      "response_text": "Key security considerations include: 1) JWT token invalidation, 2) Session cleanup, 3) CSRF protection, 4) Audit logging..."
    },
    "statusDetails": {}
  }
}
```

#### Error Responses

**Build Feature Failed**:
```json
{
  "version": "1.0",
  "messageId": "msg_error_001",
  "threadId": "thread_logout_feature",
  "actor": "Coder",
  "type": "build_feature",
  "status": "Failed",
  "timestamp": "2025-08-20T20:09:00Z",
  "origin": {
    "originMessageId": "msg_build_001",
    "originActor": "System",
    "respondingToMessageId": "msg_build_001",
    "respondingToActor": "System"
  },
  "body": {
    "contract": {},
    "messages": {
      "error": "Failed to generate code files",
      "details": "Template engine error: Invalid requirement format",
      "suggestion": "Please check the requirements structure and try again"
    },
    "statusDetails": {
      "agent": "ErrorHandler",
      "LLM": "System",
      "details": "Build feature failed: Template engine error"
    }
  }
}
```

### Message Flow Examples

#### Complete Build Feature Flow

1. **System → Coder**: Build feature request
2. **Coder → System**: Status update (InProgress)
3. **Coder → System**: Status update (75% complete)
4. **Coder → System**: Build feature completed
5. **System → User**: Success notification

#### AI Chat Flow

1. **User → System**: AI question
2. **System → Coder**: Forward question
3. **Coder → System**: AI response
4. **System → User**: Display response

#### Clarification Flow

1. **Coder → System**: Clarification needed
2. **System → User**: Display clarification request
3. **User → System**: Provide clarification
4. **System → Coder**: Forward clarification
5. **Coder → System**: Continue processing

### WebSocket Connection

**Endpoint**: `wss://vishmaker.com/ws`

**Connection States**:
- `WebSocket.CONNECTING` (0): Connection is being established
- `WebSocket.OPEN` (1): Connection is ready for communication
- `WebSocket.CLOSING` (2): Connection is being closed
- `WebSocket.CLOSED` (3): Connection is closed

**Heartbeat**: Send `heartbeat` message type every 30 seconds to maintain connection

### Status Details Handling

VishCoder includes `statusDetails` in responses to provide real-time updates on processing status. The `statusDetails` object contains:

```json
{
  "statusDetails": {
    "agent": "AgentName",
    "LLM": "LLMModel",
    "details": "Human-readable status description"
  }
}
```

**Display Format**: Status messages are formatted as `agent(LLM) : details` and displayed in the AI Chat interface.

**Examples**:
- `CodeGenerator(GPT-4) : Analyzing requirements and generating code structure`
- `TestRunner(Claude-3) : Executing test cases and validating functionality`
- `Deployer(AWS-Lambda) : Deploying feature to staging environment`

### Error Handling

- **Connection Errors**: Automatic reconnection with exponential backoff
- **Message Errors**: Invalid payloads are logged and ignored
- **Timeout Errors**: Long-running operations have configurable timeouts
- **Retry Logic**: Failed messages are retried up to 3 times

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
