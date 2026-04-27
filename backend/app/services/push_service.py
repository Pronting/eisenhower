"""
Push service: email delivery via Resend API (primary) or SMTP (fallback).

Resend: sign up at https://resend.com → get API key → done. No auth codes, no domain setup.
Free tier: 100 emails/day. Sends from onboarding@resend.dev in test mode.
"""
import json
import logging
import smtplib
from email.header import Header
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import PushConfig, PushLog, Task

logger = logging.getLogger(__name__)


# ======================================================================
# Resend API (primary — just needs API key, no auth code, no domain)
# ======================================================================

def _send_via_resend(to_address: str, subject: str, html_body: str) -> tuple[bool, str]:
    """Send email via Resend REST API."""
    resp = httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": f"ishwe <onboarding@resend.dev>",
            "to": [to_address],
            "subject": subject,
            "html": html_body,
        },
        timeout=15,
    )
    if resp.is_success:
        return True, ""
    detail = resp.json().get("message", resp.text[:200])
    return False, f"Resend API error: {detail}"


# ======================================================================
# SMTP (fallback)
# ======================================================================

def _send_via_smtp(to_address: str, subject: str, html_body: str) -> tuple[bool, str]:
    """Send email via SMTP (SMTP_SSL on 465 first, then STARTTLS on 587)."""
    if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASSWORD]):
        return False, "SMTP 未配置 (SMTP_HOST/USER/PASSWORD 缺失)"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8").encode()
    msg["From"] = Header(settings.SMTP_FROM or settings.SMTP_USER, "utf-8").encode()
    msg["To"] = to_address
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    errors = []
    configs = [
        ("SSL/465", lambda: smtplib.SMTP_SSL(settings.SMTP_HOST, 465, timeout=15)),
        ("STARTTLS/587", lambda: _connect_starttls()),
    ]

    for method, connect_fn in configs:
        try:
            server = connect_fn()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], to_address, msg.as_string())
            server.quit()
            return True, ""
        except smtplib.SMTPAuthenticationError:
            return False, "SMTP 认证失败，请检查邮箱账号和授权码"
        except (smtplib.SMTPConnectError, ConnectionRefusedError, OSError):
            errors.append(f"{method}连接失败")
            continue
        except Exception as e:
            errors.append(f"{method}: {e}")
            continue

    return False, "; ".join(errors) if errors else "SMTP 不可达"


def _connect_starttls():
    server = smtplib.SMTP(settings.SMTP_HOST, 587, timeout=15)
    server.starttls()
    return server


# ======================================================================
# Unified send entrypoint
# ======================================================================

def send_email(to_address: str, subject: str, html_body: str) -> tuple[bool, str]:
    """
    Send email. Prefers Resend API if configured, otherwise falls back to SMTP.

    Recommended setup (30 seconds):
      1. Sign up at https://resend.com
      2. Copy your API key from the dashboard
      3. Add to .env: RESEND_API_KEY=re_xxxxxxxx
    """
    # Resend first (simplest setup)
    if settings.RESEND_API_KEY:
        return _send_via_resend(to_address, subject, html_body)

    # SMTP fallback
    if settings.SMTP_HOST:
        return _send_via_smtp(to_address, subject, html_body)

    return False, "未配置邮件发送方式。请在 .env 中设置 RESEND_API_KEY（推荐）或 SMTP 配置。注册 Resend：https://resend.com"


# ======================================================================
# Push content & execution
# ======================================================================

def build_push_content(user_id: int, db: Session) -> str:
    """Build push summary HTML from user's tasks."""
    tasks = db.query(Task).filter(Task.user_id == user_id).all()

    q1 = [t for t in tasks if t.quadrant and t.quadrant.value == "q1"]
    q2 = [t for t in tasks if t.quadrant and t.quadrant.value == "q2"]
    q3 = [t for t in tasks if t.quadrant and t.quadrant.value == "q3"]
    q4 = [t for t in tasks if t.quadrant and t.quadrant.value == "q4"]
    pending = [t for t in tasks if t.status and t.status.value == "pending"]
    completed = [t for t in tasks if t.status and t.status.value == "completed"]

    lines = [
        "<h3>今日任务概览</h3>",
        f"<p>总计 {len(tasks)} 个任务 | 待完成 {len(pending)} 个 | 已完成 {len(completed)} 个</p>",
        f"<h4>重要紧急 (Q1): {len(q1)} 个</h4>",
    ]
    for t in q1[:5]:
        lines.append(f"<p>&nbsp;&nbsp;&#8226; {t.title}</p>")

    lines.append(f"<h4>重要不紧急 (Q2): {len(q2)} 个</h4>")
    for t in q2[:5]:
        lines.append(f"<p>&nbsp;&nbsp;&#8226; {t.title}</p>")

    lines.append(f"<h4>紧急不重要 (Q3): {len(q3)} 个</h4>")
    lines.append(f"<h4>不紧急不重要 (Q4): {len(q4)} 个</h4>")

    return "".join(lines)


def execute_push(push_config: PushConfig, user_id: int, db: Session) -> PushLog:
    """Execute a single push config and return a PushLog record."""
    content = build_push_content(user_id, db)

    if push_config.push_type == "email":
        success, error = send_email(
            to_address=push_config.address,
            subject="ishwe — 今日任务推送",
            html_body=content,
        )
    elif push_config.push_type == "webhook":
        payload = {
            "summary_content": content,
            "user_id": user_id,
            "push_time": datetime.now().isoformat(),
        }
        success, error = send_webhook(push_config.address, payload)
    else:
        success, error = False, f"Unknown push_type: {push_config.push_type}"

    log = PushLog(
        user_id=user_id,
        push_config_id=push_config.id,
        summary_content=content,
        status="success" if success else "failed",
        error_message=error,
    )
    db.add(log)
    db.commit()
    return log


def send_webhook(webhook_url: str, payload: dict) -> tuple[bool, str]:
    """Send webhook POST request. Returns (success, error_message)."""
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(webhook_url, json=payload)
            if resp.is_success:
                return True, ""
            return False, f"Webhook returned {resp.status_code}: {resp.text[:200]}"
    except httpx.ConnectTimeout:
        return False, "Webhook 连接超时"
    except Exception as e:
        logger.exception("Webhook send failed")
        return False, str(e)


def trigger_push_for_user(user_id: int, db: Session) -> list[dict]:
    """Trigger push for all enabled configs of a user. Returns list of result dicts."""
    configs = db.query(PushConfig).filter(
        PushConfig.user_id == user_id,
        PushConfig.enabled == 1,
    ).all()

    results = []
    for cfg in configs:
        log = execute_push(cfg, user_id, db)
        results.append({
            "push_config_id": cfg.id,
            "push_type": cfg.push_type,
            "address": cfg.address,
            "status": log.status,
            "error_message": log.error_message,
        })
    return results
