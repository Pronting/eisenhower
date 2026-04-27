"""Statistics API endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Task, Quadrant, TaskStatus
from app.schemas.schemas import ApiResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/quadrant")
def quadrant_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return task counts per Eisenhower quadrant."""
    rows = (
        db.query(Task.quadrant, func.count(Task.id))
        .filter(Task.user_id == user.id)
        .group_by(Task.quadrant)
        .all()
    )
    counts = {"q1": 0, "q2": 0, "q3": 0, "q4": 0}
    for quadrant_val, count in rows:
        if quadrant_val and quadrant_val.value in counts:
            counts[quadrant_val.value] = count
    return ApiResponse(data=counts)


@router.get("/completion")
def completion_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return completion rate statistics."""
    total = db.query(Task).filter(Task.user_id == user.id).count()
    completed = (
        db.query(Task)
        .filter(Task.user_id == user.id, Task.status == TaskStatus.COMPLETED)
        .count()
    )
    pending = total - completed
    rate = round(completed / total * 100, 2) if total > 0 else 0.0
    return ApiResponse(data={
        "total": total,
        "completed": completed,
        "pending": pending,
        "rate": rate,
    })


@router.get("/trends")
def trend_stats(
    days: int = 7,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return daily task creation counts for the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(
            func.date(Task.created_at).label("date"),
            func.count(Task.id).label("count"),
        )
        .filter(Task.user_id == user.id, Task.created_at >= cutoff)
        .group_by(func.date(Task.created_at))
        .order_by(func.date(Task.created_at))
        .all()
    )
    data = [{"date": str(row.date), "count": row.count} for row in rows]
    return ApiResponse(data=data)
