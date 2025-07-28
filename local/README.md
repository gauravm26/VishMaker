# Local Development & Testing

This directory contains all files and configurations specific to local development and testing that are not needed for AWS deployment.

## 📁 Directory Structure

```
local/
├── README.md              # This file
├── start.sh               # Local startup script
├── start_output.txt       # Local startup output logs
├── Dockerfile             # Local Docker configuration
├── venv/                  # Local Python virtual environment
├── db/                    # Local database files (moved from infrastructure/db/)
├── terraform/             # Local Terraform state and configs (moved from infrastructure/terraform/)
├── deploy.sh              # Local deployment script (moved from infrastructure/)
├── deploy.py              # Local deployment script (moved from infrastructure/)
└── test/                  # Local testing files
    ├── test_auth.py       # Authentication testing script
    ├── confirm_user.py    # User confirmation script
    ├── show_credentials.py # Credentials display script
    └── test_credentials.json # Test user credentials
```

## 🧪 Testing Setup

### Authentication Testing

1. **View Test Credentials:**
   ```bash
   cd local/test
   python3 show_credentials.py
   ```

2. **Run Authentication Tests:**
   ```bash
   cd local/test
   python3 test_auth.py
   ```

3. **Confirm a User Account:**
   ```bash
   cd local/test
   python3 confirm_user.py <email> <confirmation_code>
   ```

### Available Test Users

- **Primary User:** `testuser@example.com` / `TestPassword123!`
- **Secondary User:** `test@example.com` / `TestPassword123!`
- **Admin User:** `admin@example.com` / `AdminPassword123!`

## 🚀 Local Development

### Starting the Application

```bash
# Start the backend (from project root)
cd ../../app-api
python3 -m uvicorn app.main:app --reload

# Start the frontend (in another terminal, from project root)
cd ../../app-ui
npm run dev
```

### Using the Local Startup Script

```bash
cd local
./start.sh
```

**Note:** The startup script automatically navigates to the project root directory and starts both backend and frontend servers.

## 🗄️ Local Database

The local database files are stored in `local/db/`. This includes:
- Database migrations
- Local database state
- Development database configurations

## ☁️ Terraform (Local)

Local Terraform configurations and state files are stored in `local/terraform/`. This includes:
- Local infrastructure state
- Development environment configurations
- Local deployment configurations

## 🔧 Local Deployment

Local deployment scripts are available:
- `local/deploy.sh` - Shell deployment script
- `local/deploy.py` - Python deployment script

## 📝 Notes

- All test credentials are stored in `local/test/test_credentials.json`
- This file is gitignored to keep credentials secure
- The local setup is separate from AWS deployment configurations
- Use these files only for local development and testing 