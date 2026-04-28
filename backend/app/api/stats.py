"""Statistics API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Task, Quadrant, TaskStatus
from app.schemas.schemas import ApiResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _apply_due_date_filter(query, due_date: Optional[str]):
    """Apply date-range filter to a query if due_date is provided."""
    if due_date:
        try:
            dt = datetime.strptime(due_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid date format: {due_date}. Expected YYYY-MM-DD.")
        return query.filter(
            Task.due_date >= dt,
            Task.due_date < dt + timedelta(days=1),
        )
    return query


@router.get("/quadrant")
def quadrant_stats(
    due_date: Optional[str] = Query(default=None, description="Filter by due date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return task counts per Eisenhower quadrant, optionally filtered by date."""
    query = db.query(Task.quadrant, func.count(Task.id)).filter(Task.user_id == user.id)
    query = _apply_due_date_filter(query, due_date)
    rows = query.group_by(Task.quadrant).all()
    counts = {"q1": 0, "q2": 0, "q3": 0, "q4": 0}
    for quadrant_val, count in rows:
        if quadrant_val and quadrant_val.value in counts:
            counts[quadrant_val.value] = count
    return ApiResponse(data=counts)


@router.get("/completion")
def completion_stats(
    due_date: Optional[str] = Query(default=None, description="Filter by due date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return completion rate statistics, optionally filtered by date."""
    base_q = db.query(Task).filter(Task.user_id == user.id)
    base_q = _apply_due_date_filter(base_q, due_date)
    total = base_q.count()
    completed = base_q.filter(Task.status == TaskStatus.COMPLETED).count()
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
