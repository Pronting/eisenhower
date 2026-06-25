"""Tests for desktop client endpoints (Device Flow + Quick Add).

Covers the desktop-specific backend pieces restored in feat/quick-note-desktop-v2.
"""
import pytest


class TestQuickAdd:
    def test_quick_add_single_task(self, client, token):
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [{"title": "快速任务", "quadrant": "q1"}]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["created"] == 1
        assert data["tasks"][0]["title"] == "快速任务"
        assert data["tasks"][0]["quadrant"] == "q1"

    def test_quick_add_batch(self, client, token):
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [
                {"title": "任务A", "quadrant": "q1"},
                {"title": "任务B", "quadrant": "q2", "description": "描述B"},
                {"title": "任务C", "quadrant": "q3", "priority": "high"},
            ]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["created"] == 3

    def test_quick_add_with_due_date(self, client, token):
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [{"title": "有期限", "quadrant": "q1", "due_date": "2026-06-01"}]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

    def test_quick_add_invalid_quadrant(self, client, token):
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [{"title": "坏象限", "quadrant": "q5"}]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_quick_add_empty_tasks(self, client, token):
        resp = client.post(
            "/api/notes/quick-add",
            json={"tasks": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_quick_add_unauthorized(self, client):
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [{"title": "x", "quadrant": "q1"}]
        })
        assert resp.status_code in (401, 403)

    def test_quick_add_source_metadata(self, client, token):
        """ai_metadata.source 应为 'quick_note'。"""
        client.post("/api/notes/quick-add", json={
            "tasks": [{"title": "元数据测试", "quadrant": "q1"}]
        }, headers={"Authorization": f"Bearer {token}"})
        resp = client.get("/api/tasks", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        tasks = resp.json()["data"]
        assert any(t.get("ai_metadata", {}).get("source") == "quick_note" for t in tasks)


class TestDeviceAuth:
    def test_get_device_code(self, client):
        resp = client.get("/api/auth/device/code")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "device_code" in data
        assert "user_code" in data
        assert "verification_uri" in data
        assert data["expires_in"] == 300
        assert data["interval"] == 5

    def test_device_codes_unique(self, client):
        r1 = client.get("/api/auth/device/code").json()["data"]
        r2 = client.get("/api/auth/device/code").json()["data"]
        assert r1["device_code"] != r2["device_code"]
        assert r1["user_code"] != r2["user_code"]

    def test_authorize_valid_user_code(self, client):
        code_resp = client.get("/api/auth/device/code")
        user_code = code_resp.json()["data"]["user_code"]
        resp = client.get(f"/api/auth/device/authorize?user_code={user_code}")
        assert resp.status_code == 200
        assert resp.json()["data"]["user_code"] == user_code

    def test_authorize_invalid_user_code(self, client):
        resp = client.get("/api/auth/device/authorize?user_code=XXXX-YYYY")
        assert resp.status_code == 400

    def test_full_device_flow(self, client, token):
        """完整流程：获取 device_code → 确认授权 → 换取 token。"""
        # Step 1: Get device code
        code_data = client.get("/api/auth/device/code").json()["data"]
        device_code = code_data["device_code"]
        user_code = code_data["user_code"]

        # Step 2: Confirm authorization with user JWT
        confirm_resp = client.post(
            f"/api/auth/device/confirm?user_code={user_code}&token={token}"
        )
        assert confirm_resp.status_code == 200

        # Step 3: Exchange device_code for token
        token_resp = client.post(
            "/api/auth/device/token",
            json={"device_code": device_code},
        )
        assert token_resp.status_code == 200
        assert "access_token" in token_resp.json()["data"]
        assert token_resp.json()["data"]["token_type"] == "bearer"

    def test_token_polling_pending(self, client):
        """未授权时轮询应返回 428。"""
        code_data = client.get("/api/auth/device/code").json()["data"]
        resp = client.post(
            "/api/auth/device/token",
            json={"device_code": code_data["device_code"]},
        )
        assert resp.status_code == 428

    def test_token_invalid_device_code(self, client):
        resp = client.post(
            "/api/auth/device/token",
            json={"device_code": "nonexistent-code"},
        )
        assert resp.status_code == 400
