"""Edge-case tests to achieve 100% coverage of the desktop-specific code.

Targets uncovered branches in:
  - app/api/device_auth.py
  - quick-add branch in app/api/notes.py
"""
import pytest
from datetime import datetime, timedelta, timezone

from app.models.models import DeviceAuthRequest
from app.core.database import SessionLocal


# ---------------------------------------------------------------------------
# Device auth edge cases
# ---------------------------------------------------------------------------

class TestDeviceAuthEdgeCases:
    def test_get_device_code_with_aware_expires_at(self, client):
        """Force an aware-datetime path on _is_expired (line 28-29)."""
        db = SessionLocal()
        try:
            db.add(DeviceAuthRequest(
                device_code="aware-expired-code",
                user_code="AWARE-EXPI",
                status="pending",
                expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
            ))
            db.commit()
        finally:
            db.close()
        resp = client.post(
            "/api/auth/device/token",
            json={"device_code": "aware-expired-code"},
        )
        assert resp.status_code == 400
        assert "expired" in resp.json()["message"].lower()

    def test_authorize_with_aware_expired_code(self, client):
        """GET /authorize with tz-aware expired code path (line 28-29)."""
        db = SessionLocal()
        try:
            db.add(DeviceAuthRequest(
                device_code="aware-auth-code",
                user_code="AWARE-AUTH",
                status="pending",
                expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
            ))
            db.commit()
        finally:
            db.close()
        resp = client.get("/api/auth/device/authorize?user_code=AWARE-AUTH")
        assert resp.status_code == 400

    def test_token_with_aware_expired_code(self, client):
        """POST /token with tz-aware expired code (line 151-153)."""
        db = SessionLocal()
        try:
            db.add(DeviceAuthRequest(
                device_code="aware-tok-code",
                user_code="AWARE-TOK",
                status="authorized",
                user_id=1,
                expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
            ))
            db.commit()
        finally:
            db.close()
        resp = client.post(
            "/api/auth/device/token",
            json={"device_code": "aware-tok-code"},
        )
        assert resp.status_code == 400

    def test_confirm_with_expired_code(self, client, token):
        """POST /confirm with expired code (line 107)."""
        db = SessionLocal()
        try:
            db.add(DeviceAuthRequest(
                device_code="expired-confirm",
                user_code="EXP-CONF",
                status="pending",
                expires_at=datetime.utcnow() - timedelta(minutes=1),
            ))
            db.commit()
        finally:
            db.close()
        resp = client.post(
            f"/api/auth/device/confirm?user_code=EXP-CONF&token={token}"
        )
        assert resp.status_code == 400

    def test_confirm_with_invalid_user_code(self, client, token):
        """POST /confirm with non-existent user_code (line 122)."""
        resp = client.post(
            f"/api/auth/device/confirm?user_code=NEVER-EXIST&token={token}"
        )
        assert resp.status_code == 400

    def test_confirm_with_already_used_code(self, client, token):
        """POST /confirm when status != pending (line 125-127)."""
        code_data = client.get("/api/auth/device/code").json()["data"]
        db = SessionLocal()
        try:
            ar = db.query(DeviceAuthRequest).filter(
                DeviceAuthRequest.user_code == code_data["user_code"]
            ).first()
            ar.status = "used"
            db.commit()
        finally:
            db.close()
        resp = client.post(
            f"/api/auth/device/confirm?user_code={code_data['user_code']}&token={token}"
        )
        assert resp.status_code == 400

    def test_confirm_with_invalid_token(self, client):
        """POST /confirm with malformed token (line 109-110)."""
        code_data = client.get("/api/auth/device/code").json()["data"]
        resp = client.post(
            f"/api/auth/device/confirm?user_code={code_data['user_code']}&token=garbage"
        )
        assert resp.status_code == 401

    def test_confirm_with_nonexistent_user_id_in_token(self, client):
        """POST /confirm with token whose user_id doesn't exist (line 114)."""
        from app.core.security import create_access_token
        ghost_token = create_access_token({"sub": "99999"})
        code_data = client.get("/api/auth/device/code").json()["data"]
        resp = client.post(
            f"/api/auth/device/confirm?user_code={code_data['user_code']}&token={ghost_token}"
        )
        assert resp.status_code == 401

    def test_confirm_with_token_missing_sub(self, client):
        """POST /confirm with JWT that has no 'sub' claim (line 107)."""
        from app.core.security import create_access_token
        no_sub_token = create_access_token({"foo": "bar"})
        code_data = client.get("/api/auth/device/code").json()["data"]
        resp = client.post(
            f"/api/auth/device/confirm?user_code={code_data['user_code']}&token={no_sub_token}"
        )
        assert resp.status_code == 401

    def test_token_with_status_expired(self, client):
        """POST /token when status='expired' (line 159)."""
        code_data = client.get("/api/auth/device/code").json()["data"]
        db = SessionLocal()
        try:
            ar = db.query(DeviceAuthRequest).filter(
                DeviceAuthRequest.device_code == code_data["device_code"]
            ).first()
            ar.status = "expired"
            db.commit()
        finally:
            db.close()
        resp = client.post(
            "/api/auth/device/token",
            json={"device_code": code_data["device_code"]},
        )
        assert resp.status_code == 400

    def test_is_expired_aware_branch_direct(self):
        """Direct test of the aware-datetime branch in _is_expired (line 28-29).
        Bypasses SQLite (which strips tzinfo) by calling the function directly."""
        from app.api.device_auth import _is_expired
        from datetime import timezone as tz

        # Aware datetime in the past — should be expired
        past_aware = datetime(2020, 1, 1, tzinfo=tz.utc)
        assert _is_expired(past_aware) is True

        # Aware datetime in the future — should NOT be expired
        future_aware = datetime.now(tz.utc) + timedelta(hours=1)
        assert _is_expired(future_aware) is False

    def test_token_with_unknown_device_code(self, client):
        """POST /token with non-existent device_code (line 78-80)."""
        resp = client.post(
            "/api/auth/device/token",
            json={"device_code": "totally-unknown"},
        )
        assert resp.status_code == 400

    def test_token_with_used_status(self, client, token):
        """POST /token when status='used' (line 159)."""
        code_data = client.get("/api/auth/device/code").json()["data"]
        db = SessionLocal()
        try:
            ar = db.query(DeviceAuthRequest).filter(
                DeviceAuthRequest.device_code == code_data["device_code"]
            ).first()
            ar.status = "used"
            db.commit()
        finally:
            db.close()
        resp = client.post(
            "/api/auth/device/token",
            json={"device_code": code_data["device_code"]},
        )
        assert resp.status_code == 400

    def test_token_with_invalid_state(self, client):
        """POST /token when status is something weird (line 165)."""
        code_data = client.get("/api/auth/device/code").json()["data"]
        db = SessionLocal()
        try:
            ar = db.query(DeviceAuthRequest).filter(
                DeviceAuthRequest.device_code == code_data["device_code"]
            ).first()
            ar.status = "weird-state"
            db.commit()
        finally:
            db.close()
        resp = client.post(
            "/api/auth/device/token",
            json={"device_code": code_data["device_code"]},
        )
        assert resp.status_code == 400

    def test_token_authorized_without_user_id(self, client):
        """POST /token when status='authorized' but user_id is None (line 162)."""
        code_data = client.get("/api/auth/device/code").json()["data"]
        db = SessionLocal()
        try:
            ar = db.query(DeviceAuthRequest).filter(
                DeviceAuthRequest.device_code == code_data["device_code"]
            ).first()
            ar.status = "authorized"
            ar.user_id = None
            db.commit()
        finally:
            db.close()
        resp = client.post(
            "/api/auth/device/token",
            json={"device_code": code_data["device_code"]},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Quick-add edge cases
# ---------------------------------------------------------------------------

class TestQuickAddEdgeCases:
    def test_quick_add_invalid_date_format(self, client, token):
        """quick-add with bad due_date string (line 114-115)."""
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [{
                "title": "bad date",
                "quadrant": "q1",
                "due_date": "not-a-date",
            }],
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 400
        assert "Invalid date format" in resp.json()["message"]

    def test_quick_add_invalid_quadrant_value(self, client, token):
        """Pydantic validator rejects unknown quadrants."""
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [{"title": "q-fallback", "quadrant": "q9"}],
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_confirm_note_with_empty_tasks(self, client, token):
        """Edge case: confirm with no tasks (existing endpoint)."""
        resp = client.post("/api/notes/confirm", json={
            "content": "test",
            "tasks": [],
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 400
