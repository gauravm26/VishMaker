# config/settings.py
import os
from pydantic_settings import BaseSettings
from typing import List, Union
from pydantic import AnyHttpUrl, validator # Import validator

# Load .env file from the project root, relative to this file's location
from dotenv import load_dotenv
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', 'global', '.env') # Navigate up two levels, then into global
load_dotenv(dotenv_path=dotenv_path)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vishmaker API"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str
    
    # Port settings
    FRONTEND_PORT: int = 3000  # Default if not in .env
    BACKEND_PORT: int = 8000   # Default if not in .env

    # CORS Origins
    # Accepts a comma-separated string from .env and converts it to a list
    BACKEND_CORS_ORIGINS: Union[List[AnyHttpUrl], List[str]] = ["*"]  # Using wildcard for development

    # Optional: Secret Key for things like JWT later
    # SECRET_KEY: str = "default_secret_key" # Replace with a securely generated key

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]], values) -> Union[List[str], str]:
        if not v:  # If BACKEND_CORS_ORIGINS is empty, use FRONTEND_PORT
            frontend_port = values.get("FRONTEND_PORT", 3000)
            return [f"http://localhost:{frontend_port}"]
        if isinstance(v, str) and not v.startswith("["):
            # Split comma-separated string from .env
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            # Already a list or a JSON-like string representation of a list
            return v
        raise ValueError(v)

    class Config:
        case_sensitive = True
        # If your .env file is elsewhere or named differently:
        # env_file = ".env"
        # env_file_encoding = "utf-8"

settings = Settings()
