#!/bin/bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Change Directory to the root directory (parent of local)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

#Clear the logs directory
rm -rf logs/*

# Load environment variables (if .env exists)
if [ -f "global/.env" ]; then
    set -a
    source global/.env
    set +a
fi

# Set default values for environment variables
if [ -z "$VENV_PATH" ]; then
    VENV_PATH="$ROOT_DIR/local/venv"
fi


# Ensure we're using the correct virtual environment path
VENV_PATH="$ROOT_DIR/local/venv"

# Create logs directory if it doesn't exist
LOG_DIR="$ROOT_DIR/local/logs"
mkdir -p $LOG_DIR

# Initialize log file
LOG_FILE="$LOG_DIR/startup.log"
echo "VishMaker Application Startup Log" > $LOG_FILE
date >> $LOG_FILE
echo "" >> $LOG_FILE

# 1. Check virtual environment with correct Python version
if [ ! -d "$VENV_PATH" ]; then
    echo "Creating new virtual environment at $VENV_PATH with Python $PYTHON_VERSION"
    python3 -m venv "$VENV_PATH"
fi

# Activate virtual environment
source "$VENV_PATH/bin/activate"

# Set PATH to use virtual environment's Python and pip
export PATH="$VENV_PATH/bin:$PATH"

# Check Python version
CURRENT_PYTHON_VERSION=$(python3 --version | cut -d ' ' -f 2)
echo "1. Python Virtual Environment Activated: Python $CURRENT_PYTHON_VERSION" | tee -a $LOG_FILE

# 2. Kill existing processes on ports
# Use the PORT variables directly from .env
if [ -z "$FRONTEND_PORT" ]; then
    FRONTEND_PORT=3000  # Default if not set
fi
if [ -z "$BACKEND_PORT" ]; then
    BACKEND_PORT=8000  # Default if not set
fi

# Set URLs based on ports
FRONTEND_URL="http://localhost:$FRONTEND_PORT"
REACT_APP_BACKEND_URL="http://localhost:$BACKEND_PORT"

# Kill processes on frontend port if running
FRONTEND_PROCS=$(lsof -ti :$FRONTEND_PORT 2>/dev/null)
if [ -n "$FRONTEND_PROCS" ]; then
    echo "Killing processes on port $FRONTEND_PORT"
    lsof -ti :$FRONTEND_PORT | xargs -r kill -9
    EXISTING="Frontend port $FRONTEND_PORT"
fi

# Kill processes on backend port if running
BACKEND_PROCS=$(lsof -ti :$BACKEND_PORT 2>/dev/null)
if [ -n "$BACKEND_PROCS" ]; then
    echo "Killing processes on port $BACKEND_PORT"
    lsof -ti :$BACKEND_PORT | xargs -r kill -9
    if [ -n "$EXISTING" ]; then
        EXISTING="$EXISTING, Backend port $BACKEND_PORT"
    else
        EXISTING="Backend port $BACKEND_PORT"
    fi
fi

if [ -n "$EXISTING" ]; then
    echo "2. Existing Processes: $EXISTING" | tee -a $LOG_FILE
else
    echo "2. Existing Processes: None" | tee -a $LOG_FILE
fi


# 3. Check database connection
# Capture output but don't log yet
DB_RESULT=$("$VENV_PATH/bin/python3" -c "
import sys
from pathlib import Path

# Add the current directory to the Python path
sys.path.append('.')

try:
    from local.db.db_core import check_database_exists, test_connection
    
    # Check if database exists, create if it doesn't
    db_check = check_database_exists()
    
    # Test the connection
    connection = test_connection()
    
    # Return overall status
    if connection['status'] == 'success':
        db_name = db_check['message'].split(\"'\")[1] if \"'\" in db_check['message'] else 'unknown'
        print(f'Success, Database: {db_name}')
        print('DB_STATUS=ready')
    else:
        print('Failed')
        print('DB_STATUS=error')
        
except Exception as e:
    print('Failed')
    print('DB_STATUS=error')
")

DB_STATUS=$(echo "$DB_RESULT" | grep -v DB_STATUS)
echo "3. PostgreSQL Connection: $DB_STATUS" | tee -a $LOG_FILE

#4 Alembic Migration
# Set ALEMBIC_CONFIG to point to the local db directory
ALEMBIC_CONFIG="$ROOT_DIR/local/db/alembic/alembic.ini"
# alembic -c $ALEMBIC_CONFIG stamp head  ## To force the manual updates on tables in the current version
"$VENV_PATH/bin/alembic" -c $ALEMBIC_CONFIG revision --autogenerate -m "Migration"
"$VENV_PATH/bin/alembic" -c $ALEMBIC_CONFIG upgrade head
echo "4. Alembic Migration: Done" | tee -a $LOG_FILE

# 5. Check LLM models and their connectivity
# Use the existing test_aws_connection method but process its output into a simplified format
cd "$ROOT_DIR"
export PYTHONPATH="$ROOT_DIR:$ROOT_DIR/local"

# Get model statuses in a simpler format
LLM_CONNECTION_RESULT=$("$VENV_PATH/bin/python3" -c "
import sys
import json
import os
from pathlib import Path

sys.path.append('.')
try:
    # Load config to get model names
    config_path = Path('.') / 'global' / 'config.json'
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    if config and 'llm' in config and 'models' in config['llm']:
        # First print header
        print('4. LLM Models')
        
        # For each model, test connection using get_model_response
        from infrastructure.llms.llm_models import BedrockService
        bedrock = BedrockService()
        if not bedrock.client:
            raise Exception('Could not connect to AWS Bedrock')
        
        # Test each model with test_mode=True
        for model_key in config['llm']['models'].keys():
            try:
                # When test_mode=True and during startup, we bypass actual model invocation
                content, metadata = bedrock.get_model_response(
                    model_key=model_key,
                    instruction=None,
                    user_text=None,
                    request_id=f'startup_test_{model_key}',
                    test_mode=True
                )
                
                if content is not None:
                    model_id = metadata.get('model_id', 'unknown')
                    print(f'    - {model_key}: {model_id} : Success')
                else:
                    error = metadata.get('error', 'Unknown error')
                    print(f'    - {model_key}: Error - {error}')
            except Exception as model_error:
                print(f'    - {model_key}: Error - {str(model_error)}')
    else:
        print('No models defined in config.json')
except Exception as e:
    print(f'Error during model check: {str(e)}')
")

echo "$LLM_CONNECTION_RESULT" | tee -a $LOG_FILE

# 6. Start servers
# Start backend server
cd "$ROOT_DIR"
echo "Starting backend server on port $BACKEND_PORT..."
# Set PYTHONPATH correctly to include root directory and local directory
export PYTHONPATH="$ROOT_DIR:$ROOT_DIR/local"
echo "PYTHONPATH: $PYTHONPATH"
cd app-api
# Add PYTHONPATH to uvicorn command to ensure all modules can be found
PYTHONPATH="$ROOT_DIR:$ROOT_DIR/local" "$VENV_PATH/bin/uvicorn" app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
cd ..

# Check if backend started successfully
echo "Checking backend startup status..."
sleep 3  # Give the server a moment to start

# Function to check if backend is responding
check_backend_status() {
    local max_attempts=10
    local attempt=1
    local backend_url="http://localhost:$BACKEND_PORT"
    
    while [ $attempt -le $max_attempts ]; do
        # Check if the port is accepting connections (any response, even 404, means server is running)
        if curl -s "$backend_url/" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend is running and responding on $backend_url${NC}"
            return 0
        elif curl -s "$backend_url/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend is running and responding on $backend_url${NC}"
            return 0
        else
            echo -e "${YELLOW}Attempt $attempt/$max_attempts: Backend not responding yet...${NC}"
            sleep 2
            attempt=$((attempt + 1))
        fi
    done
    
    echo -e "${RED}✗ Backend failed to start or is not responding after $max_attempts attempts${NC}"
    echo -e "${YELLOW}Check logs/backend.log for error details${NC}"
    return 1
}

# Check backend status
if check_backend_status; then
    echo "5. Backend server started successfully on $REACT_APP_BACKEND_URL: PID $BACKEND_PID" | tee -a $LOG_FILE
    BACKEND_STATUS="success"
else
    echo "5. Backend server failed to start properly" | tee -a $LOG_FILE
    echo -e "${RED}Backend startup failed. Check logs/backend.log for details.${NC}"
    BACKEND_STATUS="failed"
    # Continue with frontend startup but warn user
fi

# Start frontend server
cd "$ROOT_DIR/app-ui"
echo "Starting frontend server on port $FRONTEND_PORT..."
npm run dev -- --port $FRONTEND_PORT > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
cd ..

# Check if frontend started successfully
echo "Checking frontend startup status..."
sleep 5  # Give the frontend server more time to start

# Function to check if frontend is responding
check_frontend_status() {
    local max_attempts=15
    local attempt=1
    local frontend_url="http://localhost:$FRONTEND_PORT"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$frontend_url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Frontend is running and responding on $frontend_url${NC}"
            return 0
        else
            echo -e "${YELLOW}Attempt $attempt/$max_attempts: Frontend not responding yet...${NC}"
            sleep 2
            attempt=$((attempt + 1))
        fi
    done
    
    echo -e "${RED}✗ Frontend failed to start or is not responding after $max_attempts attempts${NC}"
    echo -e "${YELLOW}Check logs/frontend.log for error details${NC}"
    return 1
}

# Check frontend status
if check_frontend_status; then
    echo "6. Frontend server started successfully on $FRONTEND_URL: PID $FRONTEND_PID" | tee -a $LOG_FILE
    FRONTEND_STATUS="success"
else
    echo "6. Frontend server failed to start properly" | tee -a $LOG_FILE
    echo -e "${RED}Frontend startup failed. Check logs/frontend.log for details.${NC}"
    FRONTEND_STATUS="failed"
fi



echo "" >> $LOG_FILE
echo "Press Ctrl+C to stop the servers" >> $LOG_FILE

# Final startup summary
echo "" >> $LOG_FILE
echo "=== STARTUP SUMMARY ===" >> $LOG_FILE
echo "Backend: $BACKEND_STATUS" >> $LOG_FILE
echo "Frontend: $FRONTEND_STATUS" >> $LOG_FILE
echo "=====================" >> $LOG_FILE

# Display final status to user
echo ""
echo -e "${BOLD}=== STARTUP SUMMARY ===${NC}"
if [ "$BACKEND_STATUS" = "success" ] && [ "$FRONTEND_STATUS" = "success" ]; then
    echo -e "${GREEN}✓ All services started successfully!${NC}"
elif [ "$BACKEND_STATUS" = "success" ]; then
    echo -e "${YELLOW}⚠ Backend started, but frontend failed${NC}"
elif [ "$FRONTEND_STATUS" = "success" ]; then
    echo -e "${YELLOW}⚠ Frontend started, but backend failed${NC}"
else
    echo -e "${RED}✗ Both services failed to start${NC}"
fi

# Display completion message
echo -e "\nApplication started successfully! Log saved to $LOG_FILE"
echo -e "Frontend is running at: ${BOLD}$FRONTEND_URL${NC}"
echo -e "Backend is running at: ${BOLD}$REACT_APP_BACKEND_URL${NC}"
echo -e "\n${YELLOW}NOTE: Check logs/frontend.log and logs/backend.log for detailed output${NC}"

# Create a trap to catch Ctrl+C and clean up
trap 'echo "Stopping servers..."; 
      # Kill processes on both ports
      lsof -ti :$BACKEND_PORT | xargs -r kill -9
      lsof -ti :$FRONTEND_PORT | xargs -r kill -9
      echo "Servers stopped."; exit' INT

# Wait for processes
wait 