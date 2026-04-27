"""
Eisenhower Matrix task summarization with simple cache.

Two summary types:
1. daily-summary-v2: summarize ALL tasks (completed + pending) across 4 quadrants, ≤50 chars
2. todo-summary: summarize only pending tasks across 4 quadrants, ≤50 chars

Cache: keyed by user_id, invalidated when task count or max(updated_at) changes.
"""
import json
import time
import logging
from datetime import datetime
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.llm import get_llm

logger = logging.getLogger(__name__)

# Simple in-memory cache: {user_id: {"hash": str, "daily": dict, "todo": dict, "ts": float}}
_cache: dict = {}

CACHE_TTL = 300  # 5 min max cache lifetime even if no change detected

QUADRANT_NAMES = {
    "q1": "重要紧急",
    "q2": "重要不紧急",
    "q3": "紧急不重要",
    "q4": "不紧急不重要",
}

EISENHOWER_PROMPT_HEADER = """你是一个艾森豪威尔矩阵任务管理助手。用户的任务分布在四个象限：

- Q1 重要紧急（立即执行）：危机、截止日期临近的关键任务
- Q2 重要不紧急（计划安排）：成长、规划、长期价值
- Q3 紧急不重要（委派他人）：打断、杂事、可委托
- Q4 不紧急不重要（直接消除）：琐事、消磨时间

根据用户在四个象限的任务分布，生成精炼总结。严格要求：总结不超过50个中文字。"""


def _task_hash(tasks: list[dict]) -> str:
    """Compute a lightweight hash of task list to detect changes."""
    total = len(tasks)
    pending = sum(1 for t in tasks if t.get("status") == "pending")
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    q1 = sum(1 for t in tasks if t.get("quadrant") == "q1")
    q2 = sum(1 for t in tasks if t.get("quadrant") == "q2")
    q3 = sum(1 for t in tasks if t.get("quadrant") == "q3")
    q4 = sum(1 for t in tasks if t.get("quadrant") == "q4")
    max_updated = max((t.get("updated_at", "") or "" for t in tasks), default="")
    return f"{total}:{pending}:{completed}:{q1}:{q2}:{q3}:{q4}:{max_updated}"


def _cache_get(user_id: int, tasks: list[dict]) -> Optional[dict]:
    """Check cache for user. Returns cached result dict if valid, None otherwise."""
    entry = _cache.get(user_id)
    if not entry:
        return None
    if time.time() - entry["ts"] > CACHE_TTL:
        del _cache[user_id]
        return None
    if entry["hash"] != _task_hash(tasks):
        del _cache[user_id]
        return None
    return entry


def _cache_set(user_id: int, tasks: list[dict], daily: dict, todo: dict):
    """Store results in cache."""
    _cache[user_id] = {
        "hash": _task_hash(tasks),
        "daily": daily,
        "todo": todo,
        "ts": time.time(),
    }


def _build_task_text(tasks: list[dict], status_filter: Optional[str] = None) -> str:
    """Build a text representation of tasks grouped by quadrant."""
    by_quadrant = {"q1": [], "q2": [], "q3": [], "q4": []}
    for t in tasks:
        q = t.get("quadrant", "q4")
        if q not in by_quadrant:
            q = "q4"
        if status_filter and t.get("status") != status_filter:
            continue
        status_mark = "✓" if t.get("status") == "completed" else "○"
        by_quadrant[q].append(f"  [{status_mark}] {t.get('title', '')}")

    lines = []
    for q in ["q1", "q2", "q3", "q4"]:
        label = QUADRANT_NAMES[q]
        count = len(by_quadrant[q])
        lines.append(f"{label}（{count}个）：")
        lines.extend(by_quadrant[q][:8])  # limit to 8 per quadrant
    return "\n".join(lines)


def _rule_summary(tasks: list[dict], summary_type: str) -> str:
    """Rule-based fallback summary when AI is unavailable."""
    q1 = sum(1 for t in tasks if t.get("quadrant") == "q1")
    q2 = sum(1 for t in tasks if t.get("quadrant") == "q2")
    q3 = sum(1 for t in tasks if t.get("quadrant") == "q3")
    pending = sum(1 for t in tasks if t.get("status") == "pending")
    completed = sum(1 for t in tasks if t.get("status") == "completed")

    if summary_type == "daily":
        parts = []
        if q1:
            parts.append(f"有{q1}项紧急任务需处理")
        if q2:
            parts.append(f"{q2}项重要任务在规划中")
        if not q1 and not q2:
            parts.append("当前无紧急重要任务")
        if pending:
            parts.append(f"共{pending}项待办")
        if completed:
            parts.append(f"已完成{completed}项")
        return "，".join(parts)[:50]
    else:
        if not pending:
            return "所有任务已完成，继续保持。"
        parts = []
        if q1:
            parts.append(f"优先处理{q1}项紧急任务")
        if q2:
            parts.append(f"安排{q2}项重要规划")
        if q3:
            parts.append(f"委派{q3}项杂务")
        return "，".join(parts)[:50]


def generate_daily_summary_v2(tasks: list[dict], user_id: int = 0) -> dict:
    """
    Generate today's summary: ALL tasks (completed + pending).
    Summarize what was done and what remains, ≤50 Chinese chars.
    """
    if not tasks:
        return {"summary": "今日暂无任务记录。", "stats": {"total": 0}}

    # Check cache
    cached = _cache_get(user_id, tasks)
    if cached:
        return cached["daily"]

    llm = get_llm(temperature=0.3, max_tokens=80)
    if not llm:
        summary = _rule_summary(tasks, "daily")
        result = {"summary": summary, "stats": _basic_stats(tasks)}
        # Don't cache rule-based since it's fast
        return result

    task_text = _build_task_text(tasks)
    total = len(tasks)
    pending = sum(1 for t in tasks if t.get("status") == "pending")
    completed = total - pending

    system_prompt = f"""{EISENHOWER_PROMPT_HEADER}

用户需要"今日总结"：总结今天所有任务（已完成+未完成）的整体情况。

返回JSON：{{"summary": "≤50字中文总结"}}

要求：覆盖四个象限的关键动态，点出最重要的1-2件事。先交代完成情况，再说待办重点。"""

    try:
        resp = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"总计{total}个任务，已完成{completed}个，待完成{pending}个：\n\n{task_text}"),
        ])
        content = resp.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(content)
        result["stats"] = _basic_stats(tasks)
        result["method"] = "deepseek-v4"
        return result
    except Exception as e:
        logger.warning(f"Daily summary AI failed: {e}")
        return {"summary": _rule_summary(tasks, "daily"), "stats": _basic_stats(tasks)}


def generate_todo_summary(tasks: list[dict], user_id: int = 0) -> dict:
    """
    Generate todo summary: only PENDING tasks.
    Focus on what still needs action, ≤50 Chinese chars.
    """
    pending_tasks = [t for t in tasks if t.get("status") == "pending"]
    if not pending_tasks:
        return {"summary": "所有任务已完成，今日无待办。", "stats": {"pending": 0}}

    # Check cache
    cached = _cache_get(user_id, tasks)
    if cached:
        return cached["todo"]

    llm = get_llm(temperature=0.3, max_tokens=80)
    if not llm:
        summary = _rule_summary(pending_tasks, "todo")
        return {"summary": summary, "stats": {"pending": len(pending_tasks)}}

    task_text = _build_task_text(pending_tasks, status_filter="pending")

    system_prompt = f"""{EISENHOWER_PROMPT_HEADER}

用户需要"待办总结"：仅总结所有未完成的任务，给出行动指引。

返回JSON：{{"summary": "≤50字中文总结"}}

要求：按象限优先级概括待办核心，Q1优先，Q2次之。语气简洁有行动感。"""

    try:
        resp = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"待完成{len(pending_tasks)}个任务：\n\n{task_text}"),
        ])
        content = resp.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(content)
        result["stats"] = {"pending": len(pending_tasks)}
        result["method"] = "deepseek-v4"
        return result
    except Exception as e:
        logger.warning(f"Todo summary AI failed: {e}")
        return {"summary": _rule_summary(pending_tasks, "todo"), "stats": {"pending": len(pending_tasks)}}


def generate_both_summaries(tasks: list[dict], user_id: int = 0) -> dict:
    """Generate both summaries with caching. Returns {'daily': ..., 'todo': ...}."""
    daily = generate_daily_summary_v2(tasks, user_id)
    todo = generate_todo_summary(tasks, user_id)
    _cache_set(user_id, tasks, daily, todo)
    return {"daily": daily, "todo": todo}


def invalidate_cache(user_id: int):
    """Invalidate cache for a user (called when tasks change)."""
    _cache.pop(user_id, None)


def _basic_stats(tasks: list[dict]) -> dict:
    pending = sum(1 for t in tasks if t.get("status") == "pending")
    completed = sum(1 for t in tasks if t.get("status") == "completed")
    return {
        "total": len(tasks),
        "pending": pending,
        "completed": completed,
        "q1": sum(1 for t in tasks if t.get("quadrant") == "q1"),
        "q2": sum(1 for t in tasks if t.get("quadrant") == "q2"),
        "q3": sum(1 for t in tasks if t.get("quadrant") == "q3"),
        "q4": sum(1 for t in tasks if t.get("quadrant") == "q4"),
    }
