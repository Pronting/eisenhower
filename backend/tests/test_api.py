"""
Integration tests for the FastAPI endpoints (``app.api.auth`` / ``app.api.tasks``).

Uses the :func:`client` and :func:`token` fixtures defined in ``conftest.py``
which provide a :class:`TestClient` bound to an isolated SQLite database.
"""
import sys
import os

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
