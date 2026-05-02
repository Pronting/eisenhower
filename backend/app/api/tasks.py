import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sqla_func
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Task, Quadrant, TaskStatus
from app.schemas.schemas import TaskCreate, TaskUpdate, ApiResponse
from app.agent.classify import ai_classify as ai_classify_task
from app.agent.summarize import invalidate_cache

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# Pattern to strip AI/tech mentions from reason text
_RE_AI_MENTION = re.compile(
    r'\b(AI|人工智能|模型|model|系统判定|system|算法|algorithm|机器|machine)\b[:：]?\s*',
    flags=re.IGNORECASE
)


def _sanitize_reason(text: str) -> str:
    """Remove AI/tech jargon from reason text so it reads like human advice."""
    text = _RE_AI_MENTION.sub('', text).strip()
    # Remove leading separators left after stripping
    text = re.sub(r'^[-—–·,，。、]\s*', '', text)
    return text or "根据任务内容自动分类"


def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description or "",
        "quadrant": task.quadrant.value if task.quadrant else "q4",
        "status": task.status.value if task.status else "pending",
        "is_long_term": bool(task.is_long_term),
        "due_date": task.due_date.strftime("%Y-%m-%d") if task.due_date else None,
        "ai_metadata": task.ai_metadata or {},
        "created_at": task.created_at.isoformat() if task.created_at else "",
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }


@router.get("")
def list_tasks(
    quadrant: Optional[str] = None,
    status: Optional[str] = None,
    due_date: Optional[str] = Query(default=None, description="Filter by due date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Task).filter(Task.user_id == user.id)
    if quadrant:
        query = query.filter(Task.quadrant == quadrant)
    if status:
        if ',' in status:
            statuses = [s.strip() for s in status.split(',')]
            query = query.filter(Task.status.in_(statuses))
        else:
            query = query.filter(Task.status == status)
    if due_date:
        try:
            dt = datetime.strptime(due_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid date format: {due_date}. Expected YYYY-MM-DD.")
        from sqlalchemy import or_, and_
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(or_(
            and_(Task.is_long_term == 1, dt >= today),
            and_(Task.due_date >= dt, Task.due_date < dt + timedelta(days=1)),
        ))
    tasks = query.order_by(Task.created_at.desc()).all()
    return ApiResponse(data=[_task_to_dict(t) for t in tasks])


@router.post("")
def create_task(
    req: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quadrant_map = {"q1": Quadrant.Q1, "q2": Quadrant.Q2, "q3": Quadrant.Q3, "q4": Quadrant.Q4}

    # Always call AI to get classification + description, even when user
    # manually picked a quadrant — the AI result provides a description.
    ai_result = ai_classify_task(req.title, req.description or "")

    # If user explicitly set a quadrant, use it; otherwise use AI classification
    if req.quadrant:
        quadrant = quadrant_map.get(req.quadrant, Quadrant.Q4)
        ai_result["quadrant"] = req.quadrant
    else:
        quadrant = quadrant_map.get(ai_result.get("quadrant", "q4"), Quadrant.Q4)

    # Sanitize AI reason — remove any mention of AI/model/tech names
    if "reason" in ai_result:
        ai_result["reason"] = _sanitize_reason(ai_result["reason"])

    # Auto-generate description from AI summary when user did not provide one
    description = req.description.strip() if req.description else ""
    if not description and ai_result.get("summary"):
        description = ai_result["summary"].strip()

    # Parse due_date if provided
    due_date = None
    if req.due_date:
        try:
            due_date = datetime.strptime(req.due_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid date format: {req.due_date}. Expected YYYY-MM-DD.")

    task = Task(
        user_id=user.id,
        title=req.title,
        description=description,
        quadrant=quadrant,
        due_date=due_date,
        ai_metadata=ai_result,
        is_long_term=1 if ai_result.get("is_long_term") else 0,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    invalidate_cache(user.id)
    return ApiResponse(data=_task_to_dict(task))


@router.put("/{task_id}")
def update_task(
    task_id: int,
    req: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if req.title is not None:
        task.title = req.title
    if req.description is not None:
        task.description = req.description
    if req.quadrant is not None:
        task.quadrant = Quadrant(req.quadrant)
    if req.status is not None:
        new_status = TaskStatus(req.status)
        # Auto-archive when marking as completed
        if new_status == TaskStatus.COMPLETED:
            task.status = TaskStatus.ARCHIVED
        else:
            task.status = new_status
    if req.due_date is not None:
        try:
            task.due_date = datetime.strptime(req.due_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) if req.due_date else None
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid date format: {req.due_date}. Expected YYYY-MM-DD.")

    db.commit()
    db.refresh(task)
    invalidate_cache(user.id)
    return ApiResponse(data=_task_to_dict(task))


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    invalidate_cache(user.id)
    return ApiResponse(message="Task deleted")


@router.post("/batch/reclassify")
def batch_reclassify(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Re-run AI classification on all pending tasks for the current user."""
    tasks = db.query(Task).filter(
        Task.user_id == user.id,
        Task.status == TaskStatus.PENDING,
    ).all()

    if not tasks:
        return ApiResponse(data={"reclassified": 0, "results": []})

    quadrant_map = {
        "q1": Quadrant.Q1,
        "q2": Quadrant.Q2,
        "q3": Quadrant.Q3,
        "q4": Quadrant.Q4,
    }
    results = []

    for task in tasks:
        old_quadrant = task.quadrant.value if task.quadrant else "q4"
        ai_result = ai_classify_task(task.title, task.description or "")
        new_quadrant = ai_result.get("quadrant", "q4")

        old_val = old_quadrant
        new_val = new_quadrant

        task.quadrant = quadrant_map.get(new_val, Quadrant.Q4)
        task.ai_metadata = ai_result
        task.is_long_term = 1 if ai_result.get("is_long_term") else 0

        results.append({
            "id": task.id,
            "title": task.title,
            "old_quadrant": old_val,
            "new_quadrant": new_val,
            "reason": ai_result.get("reason", ""),
        })

    db.commit()
    invalidate_cache(user.id)
    return ApiResponse(data={"reclassified": len(results), "results": results})
