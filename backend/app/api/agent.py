"""AI Agent API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Task, TaskStatus
from app.schemas.schemas import ApiResponse
from app.agent.classify import ai_classify
from app.agent.summarize import (
    generate_daily_summary_v2,
    generate_todo_summary,
    generate_both_summaries,
    invalidate_cache,
)
from app.agent.analyze import analyze_workload
from app.agent.weekly import weekly_review
from app.agent.schedule import suggest_schedule
from app.agent.decompose import decompose_task
from app.agent.advice import generate_advice
from app.core.config import settings

router = APIRouter(prefix="/api/agent", tags=["agent"])


def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description or "",
        "quadrant": task.quadrant.value if task.quadrant else "q4",
        "status": task.status.value if task.status else "pending",
        "is_long_term": bool(task.is_long_term),
        "ai_metadata": task.ai_metadata or {},
        "updated_at": task.updated_at.isoformat() if task.updated_at else "",
    }


def get_user_tasks(user: User, db: Session, today_only: bool = False) -> list[dict]:
    query = db.query(Task).filter(Task.user_id == user.id)
    if today_only:
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        query = query.filter(
            Task.status == TaskStatus.PENDING,
            or_(
                and_(Task.due_date >= today, Task.due_date < tomorrow),
                Task.is_long_term == 1,
            ),
        )
    tasks = query.all()
    return [_task_to_dict(t) for t in tasks]


class ClassifyRequest(BaseModel):
    title: str = Field(max_length=200)
    description: Optional[str] = ""


class DecomposeRequest(BaseModel):
    title: str = Field(max_length=200)
    description: Optional[str] = ""


@router.post("/classify")
def classify(req: ClassifyRequest, user: User = Depends(get_current_user)):
    """Classify a task into Eisenhower quadrant using AI."""
    if not settings.DEEPSEEK_API_KEY:
        raise HTTPException(status_code=400, detail="DeepSeek API key not configured")
    result = ai_classify(req.title, req.description)
    return ApiResponse(data=result)


@router.post("/daily-summary")
def daily_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """[Deprecated] Use /summary-v2 instead. Generate daily summary of user's tasks."""
    tasks = get_user_tasks(user, db)
    result = generate_daily_summary_v2(tasks, user.id)
    return ApiResponse(data=result)


@router.post("/summary-v2")
def summary_v2(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Generate both summaries with caching:
    - daily: today's summary (all tasks, ≤50 Chinese chars)
    - todo: pending tasks summary (pending only, ≤50 Chinese chars)
    Cache invalidates when task list changes.
    """
    tasks = get_user_tasks(user, db)
    result = generate_both_summaries(tasks, user.id)
    return ApiResponse(data=result)


@router.post("/summary-v2/daily")
def summary_v2_daily(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate today's summary only (today's pending tasks, ≤50 Chinese chars, cached)."""
    tasks = get_user_tasks(user, db, today_only=True)
    result = generate_daily_summary_v2(tasks, user.id)
    return ApiResponse(data=result)


@router.post("/summary-v2/todo")
def summary_v2_todo(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate todo summary only (pending tasks, ≤50 Chinese chars, cached)."""
    tasks = get_user_tasks(user, db)
    result = generate_todo_summary(tasks, user.id)
    return ApiResponse(data=result)


@router.post("/advice")
def mascot_advice(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate quick AI advice for the dashboard mascot (v4 flash, <2s)."""
    tasks = get_user_tasks(user, db, today_only=True)
    result = generate_advice(tasks)
    return ApiResponse(data=result)


@router.post("/analyze")
def workload_analysis(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Analyze task workload distribution."""
    tasks = get_user_tasks(user, db)
    if not tasks:
        raise HTTPException(status_code=400, detail="No tasks to analyze")
    result = analyze_workload(tasks)
    return ApiResponse(data=result)


@router.post("/weekly-review")
def weekly_review_endpoint(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate weekly review report."""
    tasks = get_user_tasks(user, db)
    result = weekly_review(tasks)
    return ApiResponse(data=result)


@router.post("/schedule")
def schedule(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get smart scheduling suggestions."""
    tasks = get_user_tasks(user, db)
    result = suggest_schedule(tasks)
    return ApiResponse(data=result)


@router.post("/decompose")
def decompose(req: DecomposeRequest, user: User = Depends(get_current_user)):
    """Decompose a vague task into actionable subtasks."""
    if not settings.DEEPSEEK_API_KEY:
        raise HTTPException(status_code=400, detail="DeepSeek API key not configured")
    result = decompose_task(req.title, req.description)
    return ApiResponse(data=result)
