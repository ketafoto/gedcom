# run "uvicorn backend.main:app --host 0.0.0.0 --port 8000" from the root folder to start the webserver
# run "uvicorn backend.main:app --reload" if there is running server
#
# Open http://localhost:8000 for "Hello World!"
# Open http://localhost:8000/docs for interactive Swagger UI documentation
#
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import text

from database import db
from backend.api import individuals

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    try:
        # Ensure the underlying database file was initialized and is accessible
        #
        engine = db.init_db_once()
        with engine.connect() as connection:
            connection.execute(text("SELECT 1 FROM main_individuals LIMIT 1"))
    except Exception as e:
        print("Database not initialized or unavailable:", e)
        raise RuntimeError("Database is not initialized properly. Run database initialization.")
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(individuals.router)

@app.get("/")
def read_root():
    return {"message": "GEDCOM API"}
