"""End-to-end test of the full Device Flow + quick-add via real HTTP.

Exercises:
  1. User registration + login (web app auth)
  2. Desktop simulation: get device_code
  3. Web authorize page reachable
  4. Confirm authorization with user's JWT
  5. Exchange device_code for desktop JWT
  6. Use desktop JWT to call quick-add
  7. Verify the new task shows up in user's task list

All requests go to the real running backend at http://localhost:8000.
"""
import requests
import sys
import random

API = "http://localhost:8000"


def main() -> int:
    print("=== E2E Test: Full Device Flow + quick-add ===\n")

    # ----- 1. Register + login -----
    print("[1] Register & login e2e user")
    suffix = random.randint(10000, 99999)
    user = {
        "username": f"e2e{suffix}",
        "email": f"e2e{suffix}@test.com",
        "password": "test123456",
    }
    r = requests.post(f"{API}/api/auth/register", json=user, timeout=5)
    assert r.status_code == 200, f"register failed: {r.text}"
    user_id = r.json()["data"]["user"]["id"]
    web_token = r.json()["data"]["token"]
    print(f"    user_id={user_id}, web_token={web_token[:20]}...")

    # ----- 2. Desktop: get device code -----
    print("\n[2] Desktop: request device code")
    r = requests.get(f"{API}/api/auth/device/code", timeout=5)
    assert r.status_code == 200, f"device code failed: {r.text}"
    device = r.json()["data"]
    print(f"    device_code:  {device['device_code'][:30]}...")
    print(f"    user_code:    {device['user_code']}")
    print(f"    expires_in:   {device['expires_in']}s")

    # ----- 3. Authorize page is reachable -----
    print("\n[3] Web authorize page is reachable")
    r = requests.get(
        f"{API}/api/auth/device/authorize",
        params={"user_code": device["user_code"]},
        timeout=5,
    )
    assert r.status_code == 200, f"authorize page failed: {r.text}"
    print(f"    GET /authorize?user_code={device['user_code']} -> 200 OK")

    # ----- 4. Confirm authorization with web JWT -----
    print("\n[4] Web user confirms authorization")
    r = requests.post(
        f"{API}/api/auth/device/confirm",
        params={"user_code": device["user_code"], "token": web_token},
        timeout=5,
    )
    assert r.status_code == 200, f"confirm failed: {r.text}"
    assert r.json()["data"]["message"] == "Authorization successful"
    print("    authorization confirmed")

    # ----- 5. Desktop: exchange for JWT -----
    print("\n[5] Desktop: exchange device_code for desktop JWT")
    r = requests.post(
        f"{API}/api/auth/device/token",
        json={"device_code": device["device_code"]},
        timeout=5,
    )
    assert r.status_code == 200, f"token exchange failed: {r.text}"
    desktop_token = r.json()["data"]["access_token"]
    print(f"    desktop_token acquired: {desktop_token[:20]}...")

    # Validate token by calling any protected endpoint
    r = requests.get(
        f"{API}/api/tasks",
        headers={"Authorization": f"Bearer {desktop_token}"},
        timeout=5,
    )
    assert r.status_code == 200, f"token validation failed: {r.text}"
    # Decode JWT payload to verify ownership matches the registered user
    import base64, json
    payload_b64 = desktop_token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    assert int(payload["sub"]) == user_id, \
        f"desktop_token sub={payload['sub']} != registered user_id={user_id}"
    print(f"    desktop_token validated, sub={payload['sub']} == user_id={user_id}")

    # ----- 6. Desktop: quick-add 3 tasks -----
    print("\n[6] Desktop: quick-add 3 tasks via /api/notes/quick-add")
    quick_add_payload = {
        "tasks": [
            {"title": "晨跑 30 分钟", "quadrant": "q2", "priority": "high"},
            {"title": "回复客户邮件", "quadrant": "q1", "due_date": "2026-06-08"},
            {"title": "整理 GitHub PRs", "quadrant": "q3", "description": "处理积压的 review"},
        ]
    }
    r = requests.post(
        f"{API}/api/notes/quick-add",
        json=quick_add_payload,
        headers={"Authorization": f"Bearer {desktop_token}"},
        timeout=5,
    )
    assert r.status_code == 200, f"quick-add failed: {r.text}"
    created = r.json()["data"]
    assert created["created"] == 3
    print(f"    created {created['created']} tasks:")
    for t in created["tasks"]:
        print(f"      - [{t['quadrant']}] {t['title']}")

    # ----- 7. Verify tasks show up in user's dashboard -----
    print("\n[7] Verify tasks show up in user's task list (same as dashboard)")
    r = requests.get(
        f"{API}/api/tasks",
        headers={"Authorization": f"Bearer {web_token}"},
        timeout=5,
    )
    assert r.status_code == 200, f"task list failed: {r.text}"
    all_tasks = r.json()["data"]
    quick_note_titles = {t["title"] for t in all_tasks
                        if t.get("ai_metadata", {}).get("source") == "quick_note"}
    expected = {"晨跑 30 分钟", "回复客户邮件", "整理 GitHub PRs"}
    missing = expected - quick_note_titles
    assert not missing, f"missing tasks: {missing}"
    print(f"    {len(quick_note_titles)} quick_note tasks visible in dashboard")

    qmap = {t["title"]: t["quadrant"] for t in all_tasks
            if t.get("ai_metadata", {}).get("source") == "quick_note"}
    assert qmap["晨跑 30 分钟"] == "q2"
    assert qmap["回复客户邮件"] == "q1"
    assert qmap["整理 GitHub PRs"] == "q3"
    print("    all quadrants correct (Q1/Q2/Q3)")

    # ----- 8. Verify the device code is now 'used' and can't be reused -----
    print("\n[8] Verify device code is single-use")
    r = requests.post(
        f"{API}/api/auth/device/token",
        json={"device_code": device["device_code"]},
        timeout=5,
    )
    assert r.status_code == 400, f"second token exchange should fail, got {r.status_code}"
    print(f"    second exchange rejected: {r.json()['message']}")

    # ----- 9. Verify the web authorize page now shows code as consumed -----
    print("\n[9] Verify expired device code via web authorize")
    r = requests.get(
        f"{API}/api/auth/device/authorize",
        params={"user_code": device["user_code"]},
        timeout=5,
    )
    assert r.status_code == 400
    print(f"    GET /authorize on consumed code -> 400 ({r.json()['message']})")

    print("\n=== ALL 9 STEPS PASSED ===")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AssertionError as e:
        print(f"\n*** E2E FAILED: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n*** E2E ERROR: {e}", file=sys.stderr)
        sys.exit(1)
