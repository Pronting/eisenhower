"""
Shared fixtures for API tests.

Sets up an isolated SQLite test database. The DATABASE_URL environment
variable is set BEFORE any app module is imported, so the app's internal
engine and SessionLocal already point to the test database.
"""
import sys
import os
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path so "from app import ..." works
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# -- Test database path -------------------------------------------------------
# Place the file under tests/ so it is easy to find and clean up.
TEST_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_ishwe.db")

# Remove any leftover database from a previously interrupted run.
if os.path.exists(TEST_DB_PATH):
    try:
        os.unlink(TEST_DB_PATH)
    except PermissionError:
        pass

# CRITICAL: set the database URL BEFORE importing any app code.
# The app reads DATABASE_URL from the environment and will create its engine
# pointing to this test database instead of the production one.
os.environ["DATABASE_URL"] = "sqlite:///" + TEST_DB_PATH.replace("\\", "/")
os.environ["DEEPSEEK_API_KEY"] = ""  # Force rule-based fallback in tests

# Now it is safe to import the app – engine, SessionLocal, and
# Base.metadata.create_all() all use the test database.
from app.core.database import Base, engine
from app.main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def setup_db():
    """Create fresh tables before each test; drop them afterwards.

    Because this fixture has ``autouse=True`` it runs for *every* test in
    the suite, guaranteeing isolation even for tests that do not explicitly
    ask for a database session.
    """
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    """Return a :class:`TestClient` bound to the FastAPI app."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def token(client):
    """Register a demo user and return a valid JWT access token.

    The user is created inside the test database (``setup_db`` already ran
    before this fixture).  Each test gets its own database, so the
    username/email pair will never collide across tests.
    """
    client.post("/api/auth/register", json={
        "username": "testuser",
        "email": "test@test.com",
        "password": "123456",
    })
    resp = client.post("/api/auth/login", json={
        "email": "test@test.com",
        "password": "123456",
    })
    return resp.json()["data"]["token"]


# ---------------------------------------------------------------------------
# Session-level cleanup
# ---------------------------------------------------------------------------

def pytest_sessionfinish(session, exitstatus):
    """Remove the test database file after the whole test session finishes."""
    engine.dispose()
    if os.path.exists(TEST_DB_PATH):
        try:
            os.unlink(TEST_DB_PATH)
        except PermissionError:
            pass
