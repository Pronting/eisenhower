"""Quick Note (小记) API — AI-powered note-to-tasks conversion."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Task, Quadrant, TaskStatus
from app.schemas.schemas import (
    NoteProcessRequest,
    NoteProcessResponse,
    NoteConfirmRequest,
    ApiResponse,
)
from app.agent.process_note import process_note_to_tasks

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.post("/process")
def process_note(
    req: NoteProcessRequest,
    user: User = Depends(get_current_user),
):
    """AI analyzes note content and returns structured task items with quadrant classification.

    Does NOT save anything — just returns the AI's analysis for user preview.
    """
    result = process_note_to_tasks(req.content)
    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])
    return ApiResponse(data=result)


@router.post("/confirm")
def confirm_note(
    req: NoteConfirmRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Confirm the AI-processed tasks and save them to the database.

    Creates one Task per confirmed item, all with today's date as default due_date.
    """
    if not req.tasks:
        raise HTTPException(status_code=400, detail="No tasks to create")

    quadrant_map = {
        "q1": Quadrant.Q1,
        "q2": Quadrant.Q2,
        "q3": Quadrant.Q3,
        "q4": Quadrant.Q4,
    }

    today = datetime.now(timezone.utc)
    created = []
    for item in req.tasks:
        quadrant = quadrant_map.get(item.quadrant, Quadrant.Q4)
        task = Task(
            user_id=user.id,
            title=item.title,
            description=item.description or "",
            quadrant=quadrant,
            status=TaskStatus.PENDING,
            due_date=today,
            ai_metadata={
                "source": "note",
                "reason": item.reason,
            },
        )
        db.add(task)
        db.flush()  # get task.id without full commit
        created.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "quadrant": task.quadrant.value,
            "reason": item.reason,
        })

    db.commit()

    return ApiResponse(data={
        "created": len(created),
        "tasks": created,
    })
