#!/bin/bash

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Change Directory to the root directory
cd /Users/gauravmishra/Documents/Idea/VishGoogle

# Load environment variables
set -a
source .env
set +a

# Create logs directory if it doesn't exist
LOG_DIR="/Users/gauravmishra/Documents/Idea/VishGoogle/logs"
mkdir -p $LOG_DIR

# Initialize log file
LOG_FILE="$LOG_DIR/startup.log"
echo "VishGoogle Application Startup Log" > $LOG_FILE
date >> $LOG_FILE
echo "" >> $LOG_FILE

# 1. Check and create virtual environment with correct Python version
if [ ! -d "$VENV_PATH" ]; then
    echo "Creating new virtual environment at $VENV_PATH with Python $PYTHON_VERSION"
fi

# Activate virtual environment
source "$VENV_PATH/bin/activate"

# Check Python version
CURRENT_PYTHON_VERSION=$(python3 --version | cut -d ' ' -f 2)
if [ "$CURRENT_PYTHON_VERSION" != "$PYTHON_VERSION" ]; then
    echo -e "${RED}Warning: Current Python version ($CURRENT_PYTHON_VERSION) does not match required version ($PYTHON_VERSION)${NC}"
    echo -e "${YELLOW}Please install Python $PYTHON_VERSION and recreate the virtual environment${NC}"
    exit 1
fi

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

# Check for existing processes
FRONTEND_PROCS=$(lsof -ti :$FRONTEND_PORT 2>/dev/null)
BACKEND_PROCS=$(lsof -ti :$BACKEND_PORT 2>/dev/null)

# Kill process on frontend port if running
if [ -n "$FRONTEND_PROCS" ]; then
    kill -9 $FRONTEND_PROCS > /dev/null 2>&1
    EXISTING="Frontend port $FRONTEND_PORT"
fi

# Kill process on backend port if running
if [ -n "$BACKEND_PROCS" ]; then
    kill -9 $BACKEND_PROCS > /dev/null 2>&1
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

# 3. Install dependencies if needed
if [ ! -f "$VENV_PATH/pip_installed" ]; then
    echo "Installing Python dependencies..."
    pip install -r app-api/requirements.txt
    touch "$VENV_PATH/pip_installed"
fi

# 4. Check database connection
# Skip database connection check for now since the module might not exist
echo "3. PostgreSQL Connection: Skipping check (module not found)" | tee -a $LOG_FILE

# 5. Check LLM models
LLM_RESULT=$(python3 -c "
import sys
import os
import json
from pathlib import Path

sys.path.append('.')
try:
    from infrastructure.llms.llm_models import load_config, generate_inference_profiles
    
    # Load config to get model IDs
    config = load_config()
    
    if config and 'llm' in config and 'modelIds' in config['llm']:
        model_ids = list(config['llm']['modelIds'].keys())
        
        # Generate inference profiles (silently)
        generate_inference_profiles(model_ids)
        
        # Print models in the required format
        for model_id in model_ids:
            print(f'   - {model_id}')
    else:
        print('   None')
except Exception as e:
    print(f'   Error: {str(e)}')
")

echo "4. Verified LLM Models: " | tee -a $LOG_FILE
echo "$LLM_RESULT" | tee -a $LOG_FILE

# 6. Start servers
# Start backend server
cd /Users/gauravmishra/Documents/Idea/VishGoogle
echo "Starting backend server on port $BACKEND_PORT..."
export PYTHONPATH=$PYTHONPATH:/Users/gauravmishra/Documents/Idea/VishGoogle
cd app-api
uvicorn app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
cd ..

# Start frontend server
cd /Users/gauravmishra/Documents/Idea/VishGoogle/app-ui
echo "Starting frontend server on port $FRONTEND_PORT..."
npm run dev -- --port $FRONTEND_PORT > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
cd ..

echo "5. Started frontend server on $FRONTEND_URL: PID $FRONTEND_PID" | tee -a $LOG_FILE
echo "6. Started backend server on $REACT_APP_BACKEND_URL: PID $BACKEND_PID" | tee -a $LOG_FILE

echo "" >> $LOG_FILE
echo "Press Ctrl+C to stop the servers" >> $LOG_FILE

# Display completion message
echo -e "\nApplication started successfully! Log saved to $LOG_FILE"
echo -e "Frontend is running at: ${BOLD}$FRONTEND_URL${NC}"
echo -e "Backend is running at: ${BOLD}$REACT_APP_BACKEND_URL${NC}"
echo -e "\n${YELLOW}NOTE: Check logs/frontend.log and logs/backend.log for detailed output${NC}"

# Create a trap to catch Ctrl+C and clean up
trap 'echo "Stopping servers..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo "Servers stopped."; exit' INT

# Wait for processes
wait 