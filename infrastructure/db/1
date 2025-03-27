# infrastructure/db/base.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config.settings import settings # Import settings from the config module

# Create the SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    # pool_pre_ping=True # Optional: checks connections before handing them out
    # echo=True # Optional: Log all SQL statements (useful for debugging)
)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class for declarative class definitions
Base = declarative_base()

# Dependency to get DB session in FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
