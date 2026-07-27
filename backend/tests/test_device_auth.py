"""
Integration tests for OAuth Device Flow endpoints.

Tests the full device authorization flow:
1. Desktop requests device_code
2. User authorizes via web
3. Desktop polls for token
"""
import sys
import os
from datetime import datetime, timedelta
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models.models import DeviceAuthRequest


class TestDeviceCode:
    """Tests for GET /api/auth/device/code"""

    def test_generate_device_code(self, client):
        resp = client.get("/api/auth/device/code")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "device_code" in data
        assert "user_code" in data
        assert "verification_uri" in data
        assert data["expires_in"] == 300
        assert data["interval"] == 5
        # user_code format: XXXX-XXXX
        assert len(data["user_code"]) == 9
        assert data["user_code"][4] == "-"

    def test_generate_unique_codes(self, client):
        """Each call should produce unique codes."""
        r1 = client.get("/api/auth/device/code")
        r2 = client.get("/api/auth/device/code")
        d1 = r1.json()["data"]
        d2 = r2.json()["data"]
        assert d1["device_code"] != d2["device_code"]
        assert d1["user_code"] != d2["user_code"]


class TestDeviceAuthorize:
    """Tests for POST /api/auth/device/authorize"""

    def test_authorize_success(self, client, token):
        # Generate a device code
        code_resp = client.get("/api/auth/device/code")
        user_code = code_resp.json()["data"]["user_code"]

        # Authorize it
        resp = client.post("/api/auth/device/authorize", json={
            "user_code": user_code,
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["message"] == "Device authorized successfully"

    def test_authorize_invalid_code(self, client, token):
        resp = client.post("/api/auth/device/authorize", json={
            "user_code": "XXXX-YYYY",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 404
        assert "Invalid user code" in resp.json()["message"]

    def test_authorize_already_used(self, client, token):
        # Generate and authorize
        code_resp = client.get("/api/auth/device/code")
        user_code = code_resp.json()["data"]["user_code"]
        client.post("/api/auth/device/authorize", json={
            "user_code": user_code,
        }, headers={"Authorization": f"Bearer {token}"})

        # Try to authorize again
        resp = client.post("/api/auth/device/authorize", json={
            "user_code": user_code,
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 400
        assert "already used" in resp.json()["message"]

    def test_authorize_expired_code(self, client, token, setup_db):
        """Expired device_code should return 410."""
        from app.core.database import SessionLocal

        # Generate a device code
        code_resp = client.get("/api/auth/device/code")
        user_code = code_resp.json()["data"]["user_code"]

        # Manually expire it in the database
        db = SessionLocal()
        try:
            auth_req = db.query(DeviceAuthRequest).filter(
                DeviceAuthRequest.user_code == user_code
            ).first()
            auth_req.expires_at = datetime.utcnow() - timedelta(minutes=1)
            db.commit()
        finally:
            db.close()

        # Try to authorize
        resp = client.post("/api/auth/device/authorize", json={
            "user_code": user_code,
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 410
        assert "expired" in resp.json()["message"].lower()

    def test_authorize_no_auth(self, client):
        """Missing Authorization header -> 403."""
        resp = client.post("/api/auth/device/authorize", json={
            "user_code": "XXXX-YYYY",
        })
        assert resp.status_code == 403


class TestDeviceToken:
    """Tests for POST /api/auth/device/token"""

    def test_token_success(self, client, token):
        """Full flow: generate -> authorize -> poll -> get token."""
        # Step 1: Generate device code
        code_resp = client.get("/api/auth/device/code")
        code_data = code_resp.json()["data"]
        device_code = code_data["device_code"]
        user_code = code_data["user_code"]

        # Step 2: Authorize
        client.post("/api/auth/device/authorize", json={
            "user_code": user_code,
        }, headers={"Authorization": f"Bearer {token}"})

        # Step 3: Poll for token
        resp = client.post("/api/auth/device/token", json={
            "device_code": device_code,
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
        })
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == "testuser"

    def test_token_pending(self, client):
        """Polling before authorization -> 428."""
        code_resp = client.get("/api/auth/device/code")
        device_code = code_resp.json()["data"]["device_code"]

        resp = client.post("/api/auth/device/token", json={
            "device_code": device_code,
        })
        assert resp.status_code == 428
        assert "authorization_pending" in resp.json()["message"]

    def test_token_invalid_device_code(self, client):
        resp = client.post("/api/auth/device/token", json={
            "device_code": "nonexistent",
        })
        assert resp.status_code == 400
        assert "invalid_grant" in resp.json()["message"]

    def test_token_expired(self, client, token, setup_db):
        """Expired device_code -> 410."""
        from app.core.database import SessionLocal

        code_resp = client.get("/api/auth/device/code")
        code_data = code_resp.json()["data"]

        # Authorize first
        client.post("/api/auth/device/authorize", json={
            "user_code": code_data["user_code"],
        }, headers={"Authorization": f"Bearer {token}"})

        # Expire it
        db = SessionLocal()
        try:
            auth_req = db.query(DeviceAuthRequest).filter(
                DeviceAuthRequest.device_code == code_data["device_code"]
            ).first()
            auth_req.expires_at = datetime.utcnow() - timedelta(minutes=1)
            db.commit()
        finally:
            db.close()

        # Poll
        resp = client.post("/api/auth/device/token", json={
            "device_code": code_data["device_code"],
        })
        assert resp.status_code == 410
        assert "expired" in resp.json()["message"].lower()

    def test_token_already_used(self, client, token):
        """Using device_code twice -> second call returns 400."""
        # Full flow
        code_resp = client.get("/api/auth/device/code")
        code_data = code_resp.json()["data"]

        client.post("/api/auth/device/authorize", json={
            "user_code": code_data["user_code"],
        }, headers={"Authorization": f"Bearer {token}"})

        # First poll succeeds
        client.post("/api/auth/device/token", json={
            "device_code": code_data["device_code"],
        })

        # Second poll fails
        resp = client.post("/api/auth/device/token", json={
            "device_code": code_data["device_code"],
        })
        assert resp.status_code == 400
        assert "invalid_grant" in resp.json()["message"]


class TestDeviceAuthFlow:
    """End-to-end integration test for the full device auth flow."""

    def test_full_flow(self, client):
        """Simulate the complete desktop OAuth device flow."""
        # 1. Register a user (simulating existing web user)
        client.post("/api/auth/register", json={
            "username": "webuser",
            "email": "web@test.com",
            "password": "123456",
        })
        login_resp = client.post("/api/auth/login", json={
            "email": "web@test.com",
            "password": "123456",
        })
        web_token = login_resp.json()["data"]["token"]

        # 2. Desktop requests device code
        code_resp = client.get("/api/auth/device/code")
        assert code_resp.status_code == 200
        code_data = code_resp.json()["data"]
        device_code = code_data["device_code"]
        user_code = code_data["user_code"]

        # 3. Desktop shows user_code to user, user enters it on web
        # 4. Web authorizes the device
        auth_resp = client.post("/api/auth/device/authorize", json={
            "user_code": user_code,
        }, headers={"Authorization": f"Bearer {web_token}"})
        assert auth_resp.status_code == 200

        # 5. Desktop polls for token
        token_resp = client.post("/api/auth/device/token", json={
            "device_code": device_code,
        })
        assert token_resp.status_code == 200
        token_data = token_resp.json()["data"]

        # 6. Desktop now has a valid JWT
        assert "token" in token_data
        assert token_data["user"]["username"] == "webuser"
        assert token_data["user"]["email"] == "web@test.com"

        # 7. Verify the new token works for protected endpoints
        tasks_resp = client.get("/api/tasks", headers={
            "Authorization": f"Bearer {token_data['token']}",
        })
        assert tasks_resp.status_code == 200
