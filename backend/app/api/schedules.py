"""CRUD endpoints for user-managed push schedules (cron expressions)."""
from datetime import datetime
from typing import List
from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, PushSchedule
from app.schemas.schemas import (
    PushScheduleCreate,
    PushScheduleUpdate,
    PushScheduleResponse,
    CronPreview,
)

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


def _validate_cron(expr: str) -> None:
    try:
        croniter(expr, datetime.now())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid cron expression: {e}")


def _to_response(s: PushSchedule) -> PushScheduleResponse:
    """Convert ORM model to response, attaching next_fire_at for convenience."""
    try:
        next_fire = croniter(s.cron_expression, datetime.now()).get_next(datetime)
    except Exception:
        next_fire = None
    return PushScheduleResponse(
        id=s.id,
        user_id=s.user_id,
        cron_expression=s.cron_expression,
        push_type=s.push_type,
        address=s.address,
        label=s.label or "",
        enabled=bool(s.enabled),
        created_at=s.created_at,
        last_fired_at=s.last_fired_at,
        next_fire_at=next_fire,
    )


@router.get("", response_model=List[PushScheduleResponse])
def list_schedules(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(PushSchedule)
        .filter(PushSchedule.user_id == user.id)
        .order_by(PushSchedule.id.desc())
        .all()
    )
    return [_to_response(s) for s in rows]


@router.post("", response_model=PushScheduleResponse)
def create_schedule(
    req: PushScheduleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _validate_cron(req.cron_expression)
    s = PushSchedule(
        user_id=user.id,
        cron_expression=req.cron_expression,
        push_type=req.push_type,
        address=req.address,
        label=req.label,
        enabled=1 if req.enabled else 0,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _to_response(s)


@router.get("/preview", response_model=CronPreview)
def preview_schedule(cron: str, n: int = 5):
    """Return the next `n` fire times for a candidate cron expression."""
    if n < 1 or n > 20:
        raise HTTPException(status_code=400, detail="n must be 1..20")
    _validate_cron(cron)
    it = croniter(cron, datetime.now())
    next_runs = [it.get_next(datetime) for _ in range(n)]
    return CronPreview(cron=cron, next_runs=next_runs, human_readable=cron)


@router.get("/{sid}", response_model=PushScheduleResponse)
def get_schedule(
    sid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = (
        db.query(PushSchedule)
        .filter(PushSchedule.id == sid, PushSchedule.user_id == user.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return _to_response(s)


@router.put("/{sid}", response_model=PushScheduleResponse)
def update_schedule(
    sid: int,
    req: PushScheduleUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = (
        db.query(PushSchedule)
        .filter(PushSchedule.id == sid, PushSchedule.user_id == user.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if req.cron_expression is not None:
        _validate_cron(req.cron_expression)
        s.cron_expression = req.cron_expression
    if req.push_type is not None:
        s.push_type = req.push_type
    if req.address is not None:
        s.address = req.address
    if req.label is not None:
        s.label = req.label
    if req.enabled is not None:
        s.enabled = 1 if req.enabled else 0
    db.commit()
    db.refresh(s)
    return _to_response(s)


@router.delete("/{sid}")
def delete_schedule(
    sid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = (
        db.query(PushSchedule)
        .filter(PushSchedule.id == sid, PushSchedule.user_id == user.id)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(s)
    db.commit()
    return {"deleted": sid}
