# config/settings.py
import os
# *** Ensure pydantic_settings is installed: pip show pydantic-settings ***
from pydantic_settings import BaseSettings
from typing import List, Union
# *** Ensure pydantic is installed: pip show pydantic ***
from pydantic import AnyHttpUrl, validator # Import validator

# *** Ensure python-dotenv is installed: pip show python-dotenv ***
from dotenv import load_dotenv

# Calculate path to .env file in the project root
# This assumes settings.py is in VishGoogle/config/
dotenv_path = os.path.join(
    os.path.dirname(__file__), # Directory of settings.py (VishGoogle/config)
    '..',                      # Go up one level (to VishGoogle)
    '.env'                     # Target .env file
)
print(f"DEBUG: config/settings.py - Attempting to load .env from: {dotenv_path}")

# *** Check if .env file actually exists at that path ***
if not os.path.exists(dotenv_path):
    print(f"WARNING: config/settings.py - .env file not found at {dotenv_path}")
# Load the .env file
load_dotenv(dotenv_path=dotenv_path, verbose=True) # Add verbose=True for debugging dotenv

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vishmaker API"
    API_V1_STR: str = "/api/v1"

    # Database - THIS MUST BE PRESENT IN .env OR HAVE A DEFAULT
    DATABASE_URL: str
    # If DATABASE_URL might be missing, add a default for testing:
    # DATABASE_URL: str = "postgresql+psycopg2://user:pass@host:port/db"

    # CORS Origins
    BACKEND_CORS_ORIGINS: Union[List[AnyHttpUrl], List[str]] = ["http://localhost:5173"]

    # SECRET_KEY: str = "default_secret_key"

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    class Config:
        case_sensitive = True
        # env_file = '.env' # Don't specify here if using load_dotenv manually above
        # env_file_encoding = "utf-8"

# *** This is the critical line where the error might originate ***
try:
    print("DEBUG: config/settings.py - Instantiating Settings()")
    settings = Settings()
    print("DEBUG: config/settings.py - Settings() instantiated successfully.")
    # Optionally print a loaded setting to confirm
    # print(f"DEBUG: Loaded DATABASE_URL: {settings.DATABASE_URL}")
except Exception as e:
    print(f"ERROR: config/settings.py - Failed during Settings() instantiation: {e}")
    # Make 'settings' None or raise the error to make the failure clear downstream
    settings = None
    raise e # Re-raise to see the error during Alembic run
