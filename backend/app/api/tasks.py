from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Task, Quadrant, TaskStatus
from app.schemas.schemas import TaskCreate, TaskUpdate, ApiResponse
from app.agent.classify import ai_classify as ai_classify_task
from app.agent.summarize import invalidate_cache

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description or "",
        "quadrant": task.quadrant.value if task.quadrant else "q4",
        "status": task.status.value if task.status else "pending",
        "is_long_term": bool(task.is_long_term),
        "ai_metadata": task.ai_metadata or {},
        "created_at": task.created_at.isoformat() if task.created_at else "",
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }


@router.get("")
def list_tasks(
    quadrant: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Task).filter(Task.user_id == user.id)
    if quadrant:
        query = query.filter(Task.quadrant == quadrant)
    if status:
        query = query.filter(Task.status == status)
    tasks = query.order_by(Task.created_at.desc()).all()
    return ApiResponse(data=[_task_to_dict(t) for t in tasks])


@router.post("")
def create_task(
    req: TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quadrant_map = {"q1": Quadrant.Q1, "q2": Quadrant.Q2, "q3": Quadrant.Q3, "q4": Quadrant.Q4}

    # If user explicitly set a quadrant in the UI, use it directly (skip AI)
    if req.quadrant:
        quadrant = quadrant_map.get(req.quadrant, Quadrant.Q4)
        ai_result = {"quadrant": req.quadrant, "reason": "用户手动指定优先级", "method": "manual"}
    else:
        ai_result = ai_classify_task(req.title, req.description or "")
        quadrant = quadrant_map.get(ai_result.get("quadrant", "q4"), Quadrant.Q4)

    task = Task(
        user_id=user.id,
        title=req.title,
        description=req.description or "",
        quadrant=quadrant,
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
        task.status = TaskStatus(req.status)

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
