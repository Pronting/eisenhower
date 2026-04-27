"""
Tests for Pydantic schema validators (``app.schemas.schemas``).

Verifies field constraints (min / max length), valid enum values, and
default-value behaviour.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from pydantic import ValidationError
from app.schemas.schemas import (
    RegisterRequest,
    LoginRequest,
    TaskCreate,
    TaskUpdate,
    ApiResponse,
)

# ======================================================================
# RegisterRequest
# ======================================================================

class TestRegisterRequest:
    def test_valid(self):
        r = RegisterRequest(username="user", email="a@b.com", password="123456")
        assert r.username == "user"
        assert r.email == "a@b.com"

    def test_password_too_short(self):
        with pytest.raises(ValidationError, match="at least 6"):
            RegisterRequest(username="user", email="a@b.com", password="12")

    def test_password_exactly_min_length(self):
        r = RegisterRequest(username="user", email="a@b.com", password="123456")
        assert len(r.password) == 6

    def test_username_too_long(self):
        with pytest.raises(ValidationError):
            RegisterRequest(
                username="x" * 51, email="a@b.com", password="123456"
            )

    def test_username_max_length(self):
        r = RegisterRequest(
            username="x" * 50, email="a@b.com", password="123456"
        )
        assert len(r.username) == 50

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            RegisterRequest(username="user", email="not-email", password="123456")

    def test_email_missing_at_sign(self):
        with pytest.raises(ValidationError):
            RegisterRequest(username="user", email="userexample.com", password="123456")


# ======================================================================
# LoginRequest
# ======================================================================

class TestLoginRequest:
    def test_valid(self):
        r = LoginRequest(email="a@b.com", password="secret")
        assert r.email == "a@b.com"
        assert r.password == "secret"

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="not-email", password="secret")


# ======================================================================
# TaskCreate
# ======================================================================

class TestTaskCreate:
    def test_valid(self):
        t = TaskCreate(title="test")
        assert t.title == "test"
        assert t.description == ""

    def test_with_description(self):
        t = TaskCreate(title="test", description="a description")
        assert t.description == "a description"

    def test_title_too_long(self):
        with pytest.raises(ValidationError):
            TaskCreate(title="x" * 201)

    def test_title_max_length(self):
        t = TaskCreate(title="x" * 200)
        assert len(t.title) == 200

    def test_description_too_long(self):
        with pytest.raises(ValidationError):
            TaskCreate(title="test", description="x" * 2001)

    def test_empty_title_allowed(self):
        """The schema does **not** enforce a minimum length, so an empty
        string is accepted (the database column is ``nullable=False``
        but will store an empty string)."""
        t = TaskCreate(title="")
        assert t.title == ""


# ======================================================================
# TaskUpdate
# ======================================================================

class TestTaskUpdate:
    def test_empty_update(self):
        """All fields default to None -> valid."""
        t = TaskUpdate()
        assert t.title is None
        assert t.description is None
        assert t.quadrant is None
        assert t.status is None

    def test_partial_title_only(self):
        t = TaskUpdate(title="new title")
        assert t.title == "new title"
        assert t.description is None
        assert t.quadrant is None
        assert t.status is None

    def test_valid_quadrant_values(self):
        for q in ["q1", "q2", "q3", "q4"]:
            t = TaskUpdate(quadrant=q)
            assert t.quadrant == q

    def test_invalid_quadrant(self):
        with pytest.raises(ValidationError):
            TaskUpdate(quadrant="q5")

    def test_invalid_quadrant_name(self):
        with pytest.raises(ValidationError):
            TaskUpdate(quadrant="important")

    def test_valid_status_values(self):
        for s in ["pending", "completed", "archived"]:
            t = TaskUpdate(status=s)
            assert t.status == s

    def test_invalid_status(self):
        with pytest.raises(ValidationError):
            TaskUpdate(status="invalid_status")

    def test_status_numeric(self):
        with pytest.raises(ValidationError):
            TaskUpdate(status=123)

    def test_title_too_long_in_update(self):
        with pytest.raises(ValidationError):
            TaskUpdate(title="x" * 201)

    def test_description_too_long_in_update(self):
        with pytest.raises(ValidationError):
            TaskUpdate(description="x" * 2001)


# ======================================================================
# ApiResponse
# ======================================================================

class TestApiResponse:
    def test_defaults(self):
        r = ApiResponse()
        assert r.code == 200
        assert r.message == "ok"
        assert r.data is None

    def test_custom_values(self):
        r = ApiResponse(code=201, data={"id": 1}, message="created")
        assert r.code == 201
        assert r.data == {"id": 1}

    def test_error_response(self):
        r = ApiResponse(code=400, data=None, message="Bad request")
        assert r.code == 400
        assert r.message == "Bad request"

    def test_data_as_list(self):
        r = ApiResponse(data=[1, 2, 3])
        assert r.data == [1, 2, 3]
