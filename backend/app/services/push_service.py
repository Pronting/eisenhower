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
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import PushConfig, PushLog, Task, TaskStatus

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

QUADRANT_LABELS = {
    "q1": "重要紧急 (Q1)",
    "q2": "重要不紧急 (Q2)",
    "q3": "紧急不重要 (Q3)",
    "q4": "不紧急不重要 (Q4)",
}

QUADRANT_EMOJI = {"q1": "🔥", "q2": "🎯", "q3": "📤", "q4": "🗑"}


def _greeting() -> str:
    """Time-aware greeting in Chinese."""
    h = datetime.now().hour
    if h < 6:   return "夜深了，注意休息 🌙"
    elif h < 9: return "早上好，新的一天开始了 ☀️"
    elif h < 12: return "上午好，精力最充沛的时段 💪"
    elif h < 14: return "中午好，休息一下再出发 🍜"
    elif h < 18: return "下午好，效率高峰别浪费 ⚡"
    elif h < 22: return "晚上好，回顾今天的收获 🌅"
    else:        return "夜深了，明天再战 🌙"


def _encouragement(pending: int, completed: int) -> str:
    """Warm encouragement footer based on progress."""
    if completed > 0 and pending == 0:
        return "今天所有任务都完成了，做得很棒！明天继续保持 🎉"
    if completed >= pending and pending > 0:
        return f"已完成 {completed} 项任务，胜利在望，再加把劲！"
    if pending > 0:
        return "分清轻重缓急，一件一件来，你可以的 💪"
    return "新的一天，从最重要的事开始。"


def _render_quadrant_section(quadrant_key: str, tasks: list, limit: int = 5) -> str:
    """Render a quadrant section with items."""
    emoji = QUADRANT_EMOJI.get(quadrant_key, "")
    label = QUADRANT_LABELS.get(quadrant_key, quadrant_key)
    header = f"<h4>{emoji} {label}: {len(tasks)} 个</h4>"
    items = ""
    for t in tasks[:limit]:
        items += f"<p style='margin:2px 0 2px 16px;color:#444;'>○ {t.title}</p>"
    return header + items


def build_push_content(user_id: int, db: Session, ai_summary: str = "") -> str:
    """Build push summary HTML from user's pending tasks (today or long-term)."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.status == TaskStatus.PENDING,
        or_(
            and_(Task.due_date >= today_start, Task.due_date < today_end),
            Task.is_long_term == 1,
        ),
    ).all()

    q1 = [t for t in tasks if t.quadrant and t.quadrant.value == "q1"]
    q2 = [t for t in tasks if t.quadrant and t.quadrant.value == "q2"]
    q3 = [t for t in tasks if t.quadrant and t.quadrant.value == "q3"]
    q4 = [t for t in tasks if t.quadrant and t.quadrant.value == "q4"]
    pending = tasks
    completed = []

    greeting = _greeting()
    encourag = _encouragement(len(pending), len(completed))

    lines = [
        "<div style='font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;padding:20px;color:#1a1a2e;'>",
        f"<h2 style='margin-bottom:4px;'>{greeting}</h2>",
    ]

    # AI daily summary
    if ai_summary:
        lines.append(
            f"<div style='background:#f0f4ff;border-left:4px solid #6366f1;padding:10px 14px;margin:12px 0;border-radius:0 8px 8px 0;font-size:14px;color:#333;line-height:1.6;'>"
            f"📋 {ai_summary}"
            f"</div>"
        )

    # Stats line
    lines.append(
        f"<p style='color:#555;font-size:14px;margin:8px 0 16px;'>"
        f"📊 待办任务 <strong>{len(tasks)}</strong> 个"
        f"</p>"
    )

    # Quadrant sections
    for qk in ("q1", "q2", "q3", "q4"):
        qt = {"q1": q1, "q2": q2, "q3": q3, "q4": q4}[qk]
        lines.append(_render_quadrant_section(qk, qt))

    # Encouragement footer
    lines.append(
        f"<div style='margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;color:#888;font-size:13px;'>"
        f"<p>{encourag}</p>"
        f"<p style='margin-top:6px;font-size:11px;'>ishwe · 艾森豪威尔矩阵任务管理</p>"
        f"</div>"
    )
    lines.append("</div>")

    return "".join(lines)


def execute_push(push_config: PushConfig, user_id: int, db: Session) -> PushLog:
    """Execute a single push config and return a PushLog record."""
    # Try to generate AI summary (non-blocking — fall back to empty)
    ai_summary = ""
    try:
        from app.agent.summarize import generate_daily_summary_v2

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        tasks = db.query(Task).filter(
            Task.user_id == user_id,
            Task.status == TaskStatus.PENDING,
            or_(
                and_(Task.due_date >= today_start, Task.due_date < today_end),
                Task.is_long_term == 1,
            ),
        ).all()
        task_dicts = [{
            "title": t.title,
            "quadrant": t.quadrant.value if t.quadrant else "q4",
            "status": t.status.value if t.status else "pending",
            "updated_at": (t.updated_at.isoformat() if t.updated_at else ""),
        } for t in tasks]

        result = generate_daily_summary_v2(task_dicts, user_id)
        ai_summary = result.get("summary", "")
    except Exception:
        pass  # AI summary is a nice-to-have, not critical

    content = build_push_content(user_id, db, ai_summary)

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
