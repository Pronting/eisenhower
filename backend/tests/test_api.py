"""
Integration tests for the FastAPI endpoints (``app.api.auth`` / ``app.api.tasks``).

Uses the :func:`client` and :func:`token` fixtures defined in ``conftest.py``
which provide a :class:`TestClient` bound to an isolated SQLite database.
"""
import sys
import os
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ======================================================================
# Health
# ======================================================================

class TestHealth:
    def test_health_check(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ======================================================================
# Authentication
# ======================================================================

class TestAuth:
    def test_register_success(self, client):
        resp = client.post("/api/auth/register", json={
            "username": "newuser",
            "email": "new@test.com",
            "password": "123456",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 200
        assert "token" in data["data"]
        assert data["data"]["user"]["username"] == "newuser"
        assert data["data"]["user"]["email"] == "new@test.com"

    def test_register_duplicate_email(self, client):
        client.post("/api/auth/register", json={
            "username": "u1", "email": "dup@test.com", "password": "123456",
        })
        resp = client.post("/api/auth/register", json={
            "username": "u2", "email": "dup@test.com", "password": "123456",
        })
        assert resp.status_code == 400
        assert "Email already registered" in resp.json()["message"]

    def test_register_duplicate_username(self, client):
        client.post("/api/auth/register", json={
            "username": "dupuser", "email": "first@test.com", "password": "123456",
        })
        resp = client.post("/api/auth/register", json={
            "username": "dupuser", "email": "second@test.com", "password": "123456",
        })
        assert resp.status_code == 400
        assert "Username already taken" in resp.json()["message"]

    def test_register_validation_error(self, client):
        """Empty/invalid fields should return a 422 validation error."""
        resp = client.post("/api/auth/register", json={
            "username": "", "email": "invalid", "password": "12",
        })
        assert resp.status_code == 422

    def test_login_success(self, client):
        client.post("/api/auth/register", json={
            "username": "user", "email": "user@test.com", "password": "123456",
        })
        resp = client.post("/api/auth/login", json={
            "email": "user@test.com", "password": "123456",
        })
        assert resp.status_code == 200
        assert "token" in resp.json()["data"]

    def test_login_wrong_password(self, client):
        client.post("/api/auth/register", json={
            "username": "user", "email": "user@test.com", "password": "123456",
        })
        resp = client.post("/api/auth/login", json={
            "email": "user@test.com", "password": "wrongpass",
        })
        assert resp.status_code == 401
        assert "Invalid email or password" in resp.json()["message"]

    def test_login_nonexistent_user(self, client):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@test.com", "password": "123456",
        })
        assert resp.status_code == 401

    def test_response_format(self, client):
        """Auth endpoints should return the standard ApiResponse shape."""
        resp = client.post("/api/auth/register", json={
            "username": "fmtuser", "email": "fmt@test.com", "password": "123456",
        })
        body = resp.json()
        assert "code" in body
        assert "data" in body
        assert "message" in body
        assert body["code"] == 200
        assert body["message"] == "ok"


# ======================================================================
# Tasks – CRUD & Classification
# ======================================================================

class TestTasks:
    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def test_create_task(self, client, token):
        resp = client.post("/api/tasks", json={"title": "测试任务"},
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["title"] == "测试任务"
        assert data["quadrant"] in ("q1", "q2", "q3", "q4")
        assert "ai_metadata" in data
        assert "created_at" in data

    def test_create_task_classified_q1(self, client, token):
        """Urgent + important keywords -> Q1."""
        resp = client.post("/api/tasks", json={"title": "老板的明天汇报"},
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["data"]["quadrant"] == "q1"

    def test_create_task_classified_q2(self, client, token):
        """Important-only keywords -> Q2."""
        resp = client.post("/api/tasks", json={"title": "学习机器学习课程"},
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["data"]["quadrant"] == "q2"
        assert resp.json()["data"]["is_long_term"] is True

    def test_create_task_classified_q3(self, client, token):
        """Urgent-only keywords -> Q3."""
        resp = client.post("/api/tasks", json={"title": "今天取快递"},
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["data"]["quadrant"] == "q3"

    def test_create_task_classified_q4(self, client, token):
        """No keywords -> Q4."""
        resp = client.post("/api/tasks", json={"title": "买零食"},
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["data"]["quadrant"] == "q4"

    def test_create_task_with_description(self, client, token):
        resp = client.post("/api/tasks", json={
            "title": "随便",
            "description": "关于一个重要项目",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        # Description contains "重要" -> Q2
        assert resp.json()["data"]["quadrant"] == "q2"

    def test_create_task_auto_description(self, client, token):
        """Task without description should get AI-generated description."""
        resp = client.post("/api/tasks", json={
            "title": "完成季度绩效报告",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        # Should have a non-empty description auto-generated
        assert data["description"], "description should not be empty"
        assert len(data["description"]) > 2, "description should be meaningful"

    def test_create_task_manual_quadrant_auto_description(self, client, token):
        """Manual quadrant + no description → AI still generates description."""
        resp = client.post("/api/tasks", json={
            "title": "阅读行业分析报告",
            "quadrant": "q2",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["quadrant"] == "q2"
        assert data["description"], "should auto-generate description even with manual quadrant"
        assert len(data["description"]) > 2

    def test_create_task_explicit_description_preserved(self, client, token):
        """Explicitly provided description should not be overwritten."""
        resp = client.post("/api/tasks", json={
            "title": "随便",
            "description": "这是我手写的描述内容",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["description"] == "这是我手写的描述内容"

    def test_create_task_no_ai_manual_text(self, client, token):
        """Metadata should not contain 'AI: 用户手动指定' style text."""
        resp = client.post("/api/tasks", json={
            "title": "整理桌面文件",
            "quadrant": "q3",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        reason = data.get("ai_metadata", {}).get("reason", "")
        assert "用户手动指定" not in reason
        assert "AI:" not in reason

    # ------------------------------------------------------------------
    # List
    # ------------------------------------------------------------------

    def test_list_tasks_empty(self, client, token):
        resp = client.get("/api/tasks",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_list_tasks_all(self, client, token):
        client.post("/api/tasks", json={"title": "Task 1"},
                    headers={"Authorization": f"Bearer {token}"})
        client.post("/api/tasks", json={"title": "Task 2"},
                    headers={"Authorization": f"Bearer {token}"})
        resp = client.get("/api/tasks",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 2

    def test_list_tasks_by_quadrant(self, client, token):
        """Filter tasks by quadrant query parameter."""
        client.post("/api/tasks", json={"title": "老板的明天汇报"},
                    headers={"Authorization": f"Bearer {token}"})   # -> Q1
        client.post("/api/tasks", json={"title": "买零食"},
                    headers={"Authorization": f"Bearer {token}"})   # -> Q4

        q1 = client.get("/api/tasks?quadrant=q1",
                        headers={"Authorization": f"Bearer {token}"})
        q4 = client.get("/api/tasks?quadrant=q4",
                        headers={"Authorization": f"Bearer {token}"})
        assert len(q1.json()["data"]) == 1
        assert q1.json()["data"][0]["quadrant"] == "q1"
        assert len(q4.json()["data"]) == 1
        assert q4.json()["data"][0]["quadrant"] == "q4"

    def test_list_tasks_by_status(self, client, token):
        """Filter tasks by status query parameter."""
        create = client.post("/api/tasks", json={"title": "My task"},
                             headers={"Authorization": f"Bearer {token}"})
        task_id = create.json()["data"]["id"]

        # Complete the task
        client.put(f"/api/tasks/{task_id}", json={"status": "completed"},
                   headers={"Authorization": f"Bearer {token}"})

        completed = client.get("/api/tasks?status=completed",
                               headers={"Authorization": f"Bearer {token}"})
        pending = client.get("/api/tasks?status=pending",
                             headers={"Authorization": f"Bearer {token}"})
        assert len(completed.json()["data"]) == 1
        assert len(pending.json()["data"]) == 0

    def test_list_tasks_filter_no_match(self, client, token):
        client.post("/api/tasks", json={"title": "Task"},
                    headers={"Authorization": f"Bearer {token}"})
        resp = client.get("/api/tasks?quadrant=q1&status=completed",
                          headers={"Authorization": f"Bearer {token}"})
        assert len(resp.json()["data"]) == 0

    # ------------------------------------------------------------------
    # Date filter
    # ------------------------------------------------------------------

    def test_list_tasks_by_due_date(self, client, token):
        """Filter tasks by due_date query parameter."""
        today = "2026-04-28"
        tomorrow = "2026-04-29"

        client.post("/api/tasks", json={
            "title": "Today Task", "due_date": today,
        }, headers={"Authorization": f"Bearer {token}"})
        client.post("/api/tasks", json={
            "title": "Tomorrow Task", "due_date": tomorrow,
        }, headers={"Authorization": f"Bearer {token}"})

        # Filter for today — should only return today's task
        resp_today = client.get(f"/api/tasks?due_date={today}",
                                headers={"Authorization": f"Bearer {token}"})
        assert resp_today.status_code == 200
        assert len(resp_today.json()["data"]) == 1
        assert resp_today.json()["data"][0]["title"] == "Today Task"

        # Filter for tomorrow — should only return tomorrow's task
        resp_tomorrow = client.get(f"/api/tasks?due_date={tomorrow}",
                                   headers={"Authorization": f"Bearer {token}"})
        assert resp_tomorrow.status_code == 200
        assert len(resp_tomorrow.json()["data"]) == 1
        assert resp_tomorrow.json()["data"][0]["title"] == "Tomorrow Task"

    def test_list_tasks_by_due_date_no_match(self, client, token):
        """Filtering by a due_date with no tasks returns empty list."""
        client.post("/api/tasks", json={
            "title": "Today Task", "due_date": "2026-04-28",
        }, headers={"Authorization": f"Bearer {token}"})

        resp = client.get("/api/tasks?due_date=2026-05-01",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 0

    def test_list_tasks_invalid_due_date(self, client, token):
        """Malformed due_date should return 422, not silently ignore."""
        resp = client.get("/api/tasks?due_date=not-a-date",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_create_task_with_due_date(self, client, token):
        """Creating a task with a valid due_date stores and returns it."""
        resp = client.post("/api/tasks", json={
            "title": "Dated Task", "due_date": "2026-05-15",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["due_date"] == "2026-05-15"

        # Verify it's filterable
        listed = client.get("/api/tasks?due_date=2026-05-15",
                           headers={"Authorization": f"Bearer {token}"})
        assert len(listed.json()["data"]) == 1

    def test_update_task_due_date(self, client, token):
        """Updating a task's due_date persists and is filterable."""
        create = client.post("/api/tasks", json={
            "title": "Date Update Test", "due_date": "2026-04-28",
        }, headers={"Authorization": f"Bearer {token}"})
        task_id = create.json()["data"]["id"]

        # Update to a new date
        client.put(f"/api/tasks/{task_id}", json={"due_date": "2026-05-01"},
                   headers={"Authorization": f"Bearer {token}"})

        # Old date filter: empty
        old = client.get("/api/tasks?due_date=2026-04-28",
                        headers={"Authorization": f"Bearer {token}"})
        assert len(old.json()["data"]) == 0

        # New date filter: found
        new = client.get("/api/tasks?due_date=2026-05-01",
                        headers={"Authorization": f"Bearer {token}"})
        assert len(new.json()["data"]) == 1
        assert new.json()["data"][0]["due_date"] == "2026-05-01"

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    def test_update_task_title(self, client, token):
        create = client.post("/api/tasks", json={"title": "旧标题"},
                             headers={"Authorization": f"Bearer {token}"})
        task_id = create.json()["data"]["id"]

        resp = client.put(f"/api/tasks/{task_id}", json={"title": "新标题"},
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "新标题"

    def test_update_task_status(self, client, token):
        create = client.post("/api/tasks", json={"title": "可更新任务"},
                             headers={"Authorization": f"Bearer {token}"})
        task_id = create.json()["data"]["id"]

        resp = client.put(f"/api/tasks/{task_id}", json={"status": "completed"},
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "completed"

    def test_update_task_quadrant(self, client, token):
        create = client.post("/api/tasks", json={"title": "买零食"},
                             headers={"Authorization": f"Bearer {token}"})
        task_id = create.json()["data"]["id"]
        assert create.json()["data"]["quadrant"] == "q4"

        resp = client.put(f"/api/tasks/{task_id}", json={"quadrant": "q1"},
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["data"]["quadrant"] == "q1"

    def test_update_task_not_found(self, client, token):
        resp = client.put("/api/tasks/99999", json={"title": "nope"},
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 404

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def test_delete_task(self, client, token):
        create = client.post("/api/tasks", json={"title": "可删除任务"},
                             headers={"Authorization": f"Bearer {token}"})
        task_id = create.json()["data"]["id"]

        resp = client.delete(f"/api/tasks/{task_id}",
                             headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["message"] == "Task deleted"

        # Verify it is gone
        remaining = client.get("/api/tasks",
                               headers={"Authorization": f"Bearer {token}"})
        assert len(remaining.json()["data"]) == 0

    def test_delete_task_not_found(self, client, token):
        resp = client.delete("/api/tasks/99999",
                             headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 404

    # ------------------------------------------------------------------
    # Authorization
    # ------------------------------------------------------------------

    def test_unauthorized_no_token(self, client):
        """Missing Authorization header -> 403 (HTTPBearer)."""
        resp = client.get("/api/tasks")
        assert resp.status_code == 403

    def test_unauthorized_invalid_token(self, client):
        """Present but invalid token -> 401 (JWT decode failure)."""
        resp = client.get("/api/tasks",
                          headers={"Authorization": "Bearer invalid"})
        assert resp.status_code == 401

    def test_unauthorized_create_no_token(self, client):
        resp = client.post("/api/tasks", json={"title": "x"})
        assert resp.status_code in (401, 403)

    def test_unauthorized_update_no_token(self, client):
        resp = client.put("/api/tasks/1", json={"title": "x"})
        assert resp.status_code in (401, 403)

    def test_unauthorized_delete_no_token(self, client):
        resp = client.delete("/api/tasks/1")
        assert resp.status_code in (401, 403)


# ======================================================================
# Statistics
# ======================================================================

class TestStats:
    def test_quadrant_stats_empty(self, client, token):
        resp = client.get("/api/stats/quadrant",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data == {"q1": 0, "q2": 0, "q3": 0, "q4": 0}

    def test_quadrant_stats_with_tasks(self, client, token):
        """Quadrant stats reflect all tasks across quadrants."""
        client.post("/api/tasks", json={"title": "老板的明天汇报"},
                    headers={"Authorization": f"Bearer {token}"})  # -> Q1
        client.post("/api/tasks", json={"title": "买零食"},
                    headers={"Authorization": f"Bearer {token}"})  # -> Q4
        resp = client.get("/api/stats/quadrant",
                          headers={"Authorization": f"Bearer {token}"})
        data = resp.json()["data"]
        assert data["q1"] == 1
        assert data["q4"] == 1

    def test_quadrant_stats_by_due_date(self, client, token):
        """Filter quadrant stats by a specific due_date."""
        today = "2026-04-28"
        tomorrow = "2026-04-29"

        client.post("/api/tasks", json={
            "title": "Today Q1", "quadrant": "q1", "due_date": today,
        }, headers={"Authorization": f"Bearer {token}"})
        client.post("/api/tasks", json={
            "title": "Tomorrow Q4", "quadrant": "q4", "due_date": tomorrow,
        }, headers={"Authorization": f"Bearer {token}"})

        # Filter by today
        resp_today = client.get(f"/api/stats/quadrant?due_date={today}",
                                headers={"Authorization": f"Bearer {token}"})
        today_data = resp_today.json()["data"]
        assert today_data["q1"] == 1
        assert today_data["q4"] == 0

        # Filter by tomorrow
        resp_tom = client.get(f"/api/stats/quadrant?due_date={tomorrow}",
                              headers={"Authorization": f"Bearer {token}"})
        tom_data = resp_tom.json()["data"]
        assert tom_data["q4"] == 1
        assert tom_data["q1"] == 0

    def test_completion_stats(self, client, token):
        client.post("/api/tasks", json={"title": "Task 1"},
                    headers={"Authorization": f"Bearer {token}"})
        client.post("/api/tasks", json={"title": "Task 2"},
                    headers={"Authorization": f"Bearer {token}"})

        resp = client.get("/api/stats/completion",
                          headers={"Authorization": f"Bearer {token}"})
        data = resp.json()["data"]
        assert data["total"] == 2
        assert data["completed"] == 0
        assert data["pending"] == 2
        assert data["rate"] == 0.0

    def test_completion_stats_by_due_date(self, client, token):
        """Completion stats filtered by due_date."""
        today = "2026-04-28"
        tomorrow = "2026-04-29"

        client.post("/api/tasks", json={
            "title": "Today Task", "due_date": today,
        }, headers={"Authorization": f"Bearer {token}"})
        client.post("/api/tasks", json={
            "title": "Tomorrow Task", "due_date": tomorrow,
        }, headers={"Authorization": f"Bearer {token}"})

        resp = client.get(f"/api/stats/completion?due_date={today}",
                          headers={"Authorization": f"Bearer {token}"})
        data = resp.json()["data"]
        assert data["total"] == 1

    def test_stats_unauthorized(self, client):
        resp = client.get("/api/stats/quadrant")
        assert resp.status_code == 403


# ======================================================================
# Quick Add (快速入库)
# ======================================================================

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
        data = resp.json()["data"]
        assert data["created"] == 1

    def test_quick_add_invalid_quadrant(self, client, token):
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [{"title": "坏象限", "quadrant": "q5"}]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_quick_add_empty_tasks(self, client, token):
        resp = client.post("/api/notes/quick-add", json={
            "tasks": []
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_quick_add_no_ai_classification(self, client, token):
        """快速入库不应经过 AI 分类，象限应与请求一致。"""
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [
                {"title": "买零食", "quadrant": "q2"},
                {"title": "老板汇报", "quadrant": "q3"},
            ]
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        tasks = resp.json()["data"]["tasks"]
        assert tasks[0]["quadrant"] == "q2"
        assert tasks[1]["quadrant"] == "q3"

    def test_quick_add_metadata_source(self, client, token):
        """ai_metadata.source 应为 'quick_note'。"""
        client.post("/api/notes/quick-add", json={
            "tasks": [{"title": "测试元数据", "quadrant": "q1", "priority": "high"}]
        }, headers={"Authorization": f"Bearer {token}"})
        resp = client.get("/api/tasks",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        task = resp.json()["data"][0]
        assert task["ai_metadata"]["source"] == "quick_note"
        assert task["ai_metadata"]["priority"] == "high"

    def test_quick_add_unauthorized(self, client):
        resp = client.post("/api/notes/quick-add", json={
            "tasks": [{"title": "x", "quadrant": "q1"}]
        })
        assert resp.status_code in (401, 403)


# ======================================================================
# OAuth Device Flow
# ======================================================================

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

    def test_device_code_unique(self, client):
        r1 = client.get("/api/auth/device/code")
        r2 = client.get("/api/auth/device/code")
        assert r1.json()["data"]["device_code"] != r2.json()["data"]["device_code"]
        assert r1.json()["data"]["user_code"] != r2.json()["data"]["user_code"]

    def test_authorize_valid_user_code(self, client):
        code_resp = client.get("/api/auth/device/code")
        user_code = code_resp.json()["data"]["user_code"]
        resp = client.get(f"/api/auth/device/authorize?user_code={user_code}")
        assert resp.status_code == 200
        assert resp.json()["data"]["user_code"] == user_code

    def test_authorize_invalid_user_code(self, client):
        resp = client.get("/api/auth/device/authorize?user_code=XXXX-YYYY")
        assert resp.status_code == 400

    def test_confirm_and_exchange_token(self, client, token):
        """完整流程：获取 device_code → 确认授权 → 换取 token。"""
        # Step 1: Get device code
        code_resp = client.get("/api/auth/device/code")
        data = code_resp.json()["data"]
        device_code = data["device_code"]
        user_code = data["user_code"]

        # Step 2: Confirm authorization
        confirm_resp = client.post(
            f"/api/auth/device/confirm?user_code={user_code}&token={token}"
        )
        assert confirm_resp.status_code == 200
        assert confirm_resp.json()["data"]["message"] == "Authorization successful"

        # Step 3: Exchange device_code for token
        token_resp = client.post("/api/auth/device/token", json={
            "device_code": device_code,
        })
        assert token_resp.status_code == 200
        token_data = token_resp.json()["data"]
        assert "access_token" in token_data
        assert token_data["token_type"] == "bearer"

        # Verify the new token works
        tasks_resp = client.get("/api/tasks",
                                headers={"Authorization": f"Bearer {token_data['access_token']}"})
        assert tasks_resp.status_code == 200

    def test_token_exchange_pending(self, client):
        """未确认授权时轮询应返回 428。"""
        code_resp = client.get("/api/auth/device/code")
        device_code = code_resp.json()["data"]["device_code"]

        resp = client.post("/api/auth/device/token", json={
            "device_code": device_code,
        })
        assert resp.status_code == 428

    def test_token_exchange_invalid_device_code(self, client):
        resp = client.post("/api/auth/device/token", json={
            "device_code": "invalid-code",
        })
        assert resp.status_code == 400

    def test_token_exchange_reuse(self, client, token):
        """device_code 使用后应失效。"""
        code_resp = client.get("/api/auth/device/code")
        data = code_resp.json()["data"]

        client.post(
            f"/api/auth/device/confirm?user_code={data['user_code']}&token={token}"
        )
        client.post("/api/auth/device/token", json={"device_code": data["device_code"]})

        # Second attempt should fail
        resp = client.post("/api/auth/device/token", json={
            "device_code": data["device_code"],
        })
        assert resp.status_code == 400

    def test_confirm_invalid_user_code(self, client, token):
        resp = client.post(
            f"/api/auth/device/confirm?user_code=XXXX-YYYY&token={token}"
        )
        assert resp.status_code == 400

    def test_confirm_invalid_token(self, client):
        code_resp = client.get("/api/auth/device/code")
        user_code = code_resp.json()["data"]["user_code"]

        resp = client.post(
            f"/api/auth/device/confirm?user_code={user_code}&token=invalid"
        )
        assert resp.status_code == 401


# ======================================================================
# Note Process (AI 拆分) — 端到端流程
# ======================================================================

class TestNoteProcess:
    """测试 AI 拆分 → 快速入库完整流程（SEL-21）。"""

    MOCK_AI_RESULT = {
        "tasks": [
            {"title": "买菜", "description": "上午去超市买菜", "quadrant": "q3", "reason": "日常琐事，紧急但不重要"},
            {"title": "阅读", "description": "下午阅读专业书籍", "quadrant": "q2", "reason": "自我提升，重要不紧急"},
            {"title": "锻炼", "description": "晚上跑步锻炼身体", "quadrant": "q2", "reason": "健康投资，重要不紧急"},
        ]
    }

    def test_process_returns_tasks(self, client, token):
        """AI 拆分应返回任务列表。"""
        with patch("app.api.notes.process_note_to_tasks", return_value=self.MOCK_AI_RESULT):
            resp = client.post("/api/notes/process", json={
                "content": "上午买菜，下午阅读，晚上锻炼",
            }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "tasks" in data
        assert len(data["tasks"]) == 3
        assert data["tasks"][0]["title"] == "买菜"
        assert data["tasks"][1]["title"] == "阅读"

    def test_process_classifies_quadrants(self, client, token):
        """AI 拆分应正确分类象限。"""
        with patch("app.api.notes.process_note_to_tasks", return_value=self.MOCK_AI_RESULT):
            resp = client.post("/api/notes/process", json={
                "content": "上午买菜，下午阅读，晚上锻炼",
            }, headers={"Authorization": f"Bearer {token}"})
        tasks = resp.json()["data"]["tasks"]
        quadrants = {t["title"]: t["quadrant"] for t in tasks}
        assert quadrants["买菜"] == "q3"
        assert quadrants["阅读"] == "q2"
        assert quadrants["锻炼"] == "q2"

    def test_process_then_quick_add(self, client, token):
        """端到端：AI 拆分 → 用户选象限 → 批量入库。"""
        # Step 1: AI 拆分
        with patch("app.api.notes.process_note_to_tasks", return_value=self.MOCK_AI_RESULT):
            process_resp = client.post("/api/notes/process", json={
                "content": "上午买菜，下午阅读，晚上锻炼",
            }, headers={"Authorization": f"Bearer {token}"})
        assert process_resp.status_code == 200
        ai_tasks = process_resp.json()["data"]["tasks"]
        assert len(ai_tasks) == 3

        # Step 2: 用户编辑象限后批量入库（全部改为 q1）
        quick_add_payload = {
            "tasks": [
                {"title": t["title"], "quadrant": "q1", "description": t.get("description", "")}
                for t in ai_tasks
            ]
        }
        add_resp = client.post("/api/notes/quick-add", json=quick_add_payload,
                               headers={"Authorization": f"Bearer {token}"})
        assert add_resp.status_code == 200
        assert add_resp.json()["data"]["created"] == 3

        # Step 3: 验证数据库中任务存在
        list_resp = client.get("/api/tasks",
                               headers={"Authorization": f"Bearer {token}"})
        assert list_resp.status_code == 200
        saved_tasks = list_resp.json()["data"]
        assert len(saved_tasks) == 3
        for t in saved_tasks:
            assert t["quadrant"] == "q1"
            assert t["ai_metadata"]["source"] == "quick_note"

    def test_process_then_quick_add_preserves_ai_quadrant(self, client, token):
        """用户不修改象限时，应保留 AI 建议的象限。"""
        with patch("app.api.notes.process_note_to_tasks", return_value=self.MOCK_AI_RESULT):
            process_resp = client.post("/api/notes/process", json={
                "content": "上午买菜，下午阅读",
            }, headers={"Authorization": f"Bearer {token}"})
        ai_tasks = process_resp.json()["data"]["tasks"]

        # 用户不做修改，直接用 AI 建议的象限入库
        quick_add_payload = {
            "tasks": [
                {"title": t["title"], "quadrant": t["quadrant"]}
                for t in ai_tasks
            ]
        }
        add_resp = client.post("/api/notes/quick-add", json=quick_add_payload,
                               headers={"Authorization": f"Bearer {token}"})
        assert add_resp.status_code == 200

        list_resp = client.get("/api/tasks",
                               headers={"Authorization": f"Bearer {token}"})
        saved = list_resp.json()["data"]
        quadrants = {t["title"]: t["quadrant"] for t in saved}
        assert quadrants["买菜"] == "q3"
        assert quadrants["阅读"] == "q2"

    def test_process_empty_content(self, client, token):
        """空内容应返回 422。"""
        resp = client.post("/api/notes/process", json={
            "content": "",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_process_unauthorized(self, client):
        """未授权应返回 401/403。"""
        resp = client.post("/api/notes/process", json={
            "content": "买菜",
        })
        assert resp.status_code in (401, 403)

    def test_process_ai_error_returns_500(self, client, token):
        """AI 返回错误时应返回 500。"""
        with patch("app.api.notes.process_note_to_tasks", return_value={"tasks": [], "error": "AI 服务未配置"}):
            resp = client.post("/api/notes/process", json={
                "content": "买菜",
            }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 500

    def test_process_single_task(self, client, token):
        """单任务输入也应正确处理。"""
        mock_single = {
            "tasks": [
                {"title": "准备明天会议PPT", "description": "收集数据制作汇报材料", "quadrant": "q1", "reason": "明天截止，紧急重要"}
            ]
        }
        with patch("app.api.notes.process_note_to_tasks", return_value=mock_single):
            resp = client.post("/api/notes/process", json={
                "content": "准备明天会议PPT",
            }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()["data"]["tasks"]) == 1
        assert resp.json()["data"]["tasks"][0]["quadrant"] == "q1"
