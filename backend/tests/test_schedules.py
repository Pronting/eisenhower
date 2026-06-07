"""Tests for cron-based push schedules (app/api/schedules.py, app/api/cron.py, app/agent/nl2cron.py)."""
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

from app.models.models import PushSchedule
from app.agent.nl2cron import generate_cron_candidates, preview_cron


# ---------------------------------------------------------------------------
# Cron generation (unit tests for nl2cron)
# ---------------------------------------------------------------------------

class TestGenerateCronCandidates:
    def test_fallback_for_morning(self):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            candidates, reasoning = generate_cron_candidates("每天早上发一下")
        assert reasoning == "AI 不可用，使用规则匹配生成"
        crons = [c["cron"] for c in candidates]
        assert "0 9 * * *" in crons

    def test_fallback_for_weekday(self):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            candidates, _ = generate_cron_candidates("工作日提醒")
        crons = [c["cron"] for c in candidates]
        assert "0 9 * * 1-5" in crons

    def test_fallback_for_evening(self):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            candidates, _ = generate_cron_candidates("晚上 6 点推")
        crons = [c["cron"] for c in candidates]
        assert "0 18 * * *" in crons

    def test_fallback_for_weekend(self):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            candidates, _ = generate_cron_candidates("周末提醒")
        crons = [c["cron"] for c in candidates]
        assert "0 10 * * 0,6" in crons

    def test_fallback_for_noon(self):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            candidates, _ = generate_cron_candidates("中午 12 点")
        crons = [c["cron"] for c in candidates]
        assert "0 12 * * *" in crons

    def test_fallback_for_every_30_minutes(self):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            candidates, _ = generate_cron_candidates("每 30 分钟")
        crons = [c["cron"] for c in candidates]
        assert "*/30 * * * *" in crons

    def test_fallback_for_hourly(self):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            candidates, _ = generate_cron_candidates("每个小时")
        crons = [c["cron"] for c in candidates]
        assert "0 * * * *" in crons

    def test_fallback_default_when_no_match(self):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            candidates, _ = generate_cron_candidates("xyz完全无意义的内容")
        crons = [c["cron"] for c in candidates]
        assert "0 9 * * *" in crons

    def test_llm_success_with_valid_json(self):
        mock_llm = MagicMock()
        mock_resp = MagicMock()
        mock_resp.content = '[{"cron": "0 17 * * 5", "human": "每周五下午 5 点"}]'
        mock_llm.invoke.return_value = mock_resp
        with patch("app.agent.nl2cron.get_llm", return_value=mock_llm):
            candidates, reasoning = generate_cron_candidates("每周五下午 5 点")
        assert reasoning == "由 AI 根据你的描述生成"
        assert candidates == [{"cron": "0 17 * * 5", "human": "每周五下午 5 点"}]

    def test_llm_returns_invalid_cron_filtered_out(self):
        mock_llm = MagicMock()
        mock_resp = MagicMock()
        mock_resp.content = '[{"cron": "invalid", "human": "x"}, {"cron": "0 9 * * *", "human": "y"}]'
        mock_llm.invoke.return_value = mock_resp
        with patch("app.agent.nl2cron.get_llm", return_value=mock_llm):
            candidates, _ = generate_cron_candidates("hi")
        assert len(candidates) == 1
        assert candidates[0]["cron"] == "0 9 * * *"

    def test_llm_returns_non_list_falls_back(self):
        mock_llm = MagicMock()
        mock_resp = MagicMock()
        mock_resp.content = '{"not": "a list"}'
        mock_llm.invoke.return_value = mock_resp
        with patch("app.agent.nl2cron.get_llm", return_value=mock_llm):
            candidates, reasoning = generate_cron_candidates("hi")
        assert reasoning == "AI 不可用，使用规则匹配生成"

    def test_llm_strips_markdown_fences(self):
        mock_llm = MagicMock()
        mock_resp = MagicMock()
        mock_resp.content = '```json\n[{"cron": "0 8 * * *", "human": "每天 8 点"}]\n```'
        mock_llm.invoke.return_value = mock_resp
        with patch("app.agent.nl2cron.get_llm", return_value=mock_llm):
            candidates, _ = generate_cron_candidates("hi")
        assert candidates[0]["cron"] == "0 8 * * *"


class TestPreviewCron:
    def test_returns_5_future_times(self):
        runs = preview_cron("0 9 * * *", n=5)
        assert len(runs) == 5
        for i in range(1, len(runs)):
            assert runs[i] > runs[i - 1]

    def test_respects_n(self):
        for n in (1, 3, 10, 20):
            assert len(preview_cron("*/15 * * * *", n=n)) == n

    def test_n_zero_returns_empty(self):
        runs = preview_cron("0 9 * * *", n=0)
        assert runs == []


# ---------------------------------------------------------------------------
# Schedule CRUD
# ---------------------------------------------------------------------------

class TestSchedulesCRUD:
    def test_create_schedule(self, client, token):
        resp = client.post("/api/schedules", json={
            "cron_expression": "0 9 * * 1-5",
            "push_type": "email",
            "address": "me@test.com",
            "label": "Morning brief",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["cron_expression"] == "0 9 * * 1-5"
        assert data["enabled"] is True
        assert data["next_fire_at"] is not None

    def test_create_invalid_cron(self, client, token):
        resp = client.post("/api/schedules", json={
            "cron_expression": "not-a-cron",
            "push_type": "email",
            "address": "x@y.com",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 400
        assert "cron" in resp.json()["message"].lower()

    def test_create_invalid_push_type(self, client, token):
        resp = client.post("/api/schedules", json={
            "cron_expression": "0 9 * * *",
            "push_type": "sms",
            "address": "x",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_create_too_short_cron(self, client, token):
        resp = client.post("/api/schedules", json={
            "cron_expression": "abc",
            "push_type": "email",
            "address": "x",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_list_schedules(self, client, token):
        client.post("/api/schedules", json={
            "cron_expression": "0 9 * * *", "push_type": "email", "address": "a@b.com",
        }, headers={"Authorization": f"Bearer {token}"})
        client.post("/api/schedules", json={
            "cron_expression": "0 18 * * *", "push_type": "desktop", "address": "self",
        }, headers={"Authorization": f"Bearer {token}"})
        resp = client.get("/api/schedules", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["cron_expression"] == "0 18 * * *"

    def test_list_unauthorized(self, client):
        resp = client.get("/api/schedules")
        assert resp.status_code in (401, 403)

    def test_get_schedule(self, client, token):
        c = client.post("/api/schedules", json={
            "cron_expression": "0 9 * * *", "push_type": "email", "address": "a@b.com",
        }, headers={"Authorization": f"Bearer {token}"}).json()
        resp = client.get(f"/api/schedules/{c['id']}",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["id"] == c["id"]

    def test_get_other_users_schedule_404(self, client, token):
        c = client.post("/api/schedules", json={
            "cron_expression": "0 9 * * *", "push_type": "email", "address": "a@b.com",
        }, headers={"Authorization": f"Bearer {token}"}).json()
        client.post("/api/auth/register", json={
            "username": "other", "email": "other@test.com", "password": "123456",
        })
        other_token = client.post("/api/auth/login", json={
            "email": "other@test.com", "password": "123456",
        }).json()["data"]["token"]
        resp = client.get(f"/api/schedules/{c['id']}",
                          headers={"Authorization": f"Bearer {other_token}"})
        assert resp.status_code == 404

    def test_get_nonexistent_schedule_404(self, client, token):
        resp = client.get("/api/schedules/99999",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 404

    def test_update_schedule(self, client, token):
        c = client.post("/api/schedules", json={
            "cron_expression": "0 9 * * *", "push_type": "email", "address": "a@b.com",
        }, headers={"Authorization": f"Bearer {token}"}).json()
        resp = client.put(f"/api/schedules/{c['id']}", json={
            "cron_expression": "0 10 * * *",
            "enabled": False,
            "label": "Updated",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["cron_expression"] == "0 10 * * *"
        assert data["enabled"] is False
        assert data["label"] == "Updated"

    def test_update_with_invalid_cron(self, client, token):
        c = client.post("/api/schedules", json={
            "cron_expression": "0 9 * * *", "push_type": "email", "address": "a@b.com",
        }, headers={"Authorization": f"Bearer {token}"}).json()
        resp = client.put(f"/api/schedules/{c['id']}", json={
            "cron_expression": "not-a-real-cron-expr",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 400

    def test_update_other_users_schedule_404(self, client, token):
        c = client.post("/api/schedules", json={
            "cron_expression": "0 9 * * *", "push_type": "email", "address": "a@b.com",
        }, headers={"Authorization": f"Bearer {token}"}).json()
        client.post("/api/auth/register", json={
            "username": "u2", "email": "u2@t.com", "password": "123456",
        })
        other = client.post("/api/auth/login", json={
            "email": "u2@t.com", "password": "123456",
        }).json()["data"]["token"]
        resp = client.put(f"/api/schedules/{c['id']}", json={
            "label": "hacked",
        }, headers={"Authorization": f"Bearer {other}"})
        assert resp.status_code == 404

    def test_delete_schedule(self, client, token):
        c = client.post("/api/schedules", json={
            "cron_expression": "0 9 * * *", "push_type": "email", "address": "a@b.com",
        }, headers={"Authorization": f"Bearer {token}"}).json()
        resp = client.delete(f"/api/schedules/{c['id']}",
                             headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        resp = client.get(f"/api/schedules/{c['id']}",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 404

    def test_delete_nonexistent_404(self, client, token):
        resp = client.delete("/api/schedules/99999",
                             headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Cron preview endpoint
# ---------------------------------------------------------------------------

class TestCronPreview:
    def test_preview_returns_5_runs(self, client):
        resp = client.get("/api/schedules/preview", params={"cron": "0 9 * * *"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["next_runs"]) == 5

    def test_preview_invalid_cron(self, client):
        resp = client.get("/api/schedules/preview", params={"cron": "nope"})
        assert resp.status_code == 400

    def test_preview_n_out_of_range(self, client):
        resp = client.get("/api/schedules/preview", params={"cron": "0 9 * * *", "n": 0})
        assert resp.status_code == 400
        resp = client.get("/api/schedules/preview", params={"cron": "0 9 * * *", "n": 100})
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# AI cron generate endpoint
# ---------------------------------------------------------------------------

class TestCronGenerate:
    def test_generate_fallback(self, client, token):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            resp = client.post("/api/cron/generate", json={
                "description": "工作日早上 9 点",
            }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "AI 不可用" in data["reasoning"]
        crons = [c["cron"] for c in data["candidates"]]
        assert "0 9 * * 1-5" in crons

    def test_generate_empty_description(self, client, token):
        resp = client.post("/api/cron/generate", json={
            "description": "",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_generate_too_long_description(self, client, token):
        resp = client.post("/api/cron/generate", json={
            "description": "x" * 501,
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 422

    def test_generate_unauthorized(self, client):
        resp = client.post("/api/cron/generate", json={"description": "hi"})
        assert resp.status_code in (401, 403)

    def test_generate_returns_5_next_runs_per_candidate(self, client, token):
        with patch("app.agent.nl2cron.get_llm", side_effect=Exception("no key")):
            resp = client.post("/api/cron/generate", json={
                "description": "早上",
            }, headers={"Authorization": f"Bearer {token}"})
        data = resp.json()
        for c in data["candidates"]:
            assert len(c["next_runs"]) == 5


# ---------------------------------------------------------------------------
# Background scheduler fire decision
# ---------------------------------------------------------------------------

class TestSchedulerFireDecision:
    def test_fires_when_cron_passed(self):
        from app.services.scheduler import _should_fire
        s = PushSchedule(
            id=1, user_id=1,
            cron_expression="* * * * *",
            push_type="email", address="a@b.com",
            label="x", enabled=1,
            created_at=datetime(2020, 1, 1),
            last_fired_at=datetime(2020, 1, 1),
        )
        assert _should_fire(s, datetime(2026, 1, 1)) is True

    def test_does_not_fire_when_future(self):
        from app.services.scheduler import _should_fire
        s = PushSchedule(
            id=1, user_id=1,
            cron_expression="0 9 * * *",
            push_type="email", address="a@b.com",
            label="x", enabled=1,
            created_at=datetime(2020, 1, 1),
            last_fired_at=datetime.now(),
        )
        assert _should_fire(s, datetime.now()) is False

    def test_invalid_cron_does_not_fire(self):
        from app.services.scheduler import _should_fire
        s = PushSchedule(
            id=1, user_id=1,
            cron_expression="garbage",
            push_type="email", address="a@b.com",
            label="x", enabled=1,
        )
        assert _should_fire(s, datetime.now()) is False

    def test_never_fired_uses_created_at(self):
        from app.services.scheduler import _should_fire
        s = PushSchedule(
            id=1, user_id=1,
            cron_expression="* * * * *",
            push_type="email", address="a@b.com",
            label="x", enabled=1,
            created_at=datetime(2020, 1, 1),
            last_fired_at=None,
        )
        assert _should_fire(s, datetime(2026, 1, 1)) is True
