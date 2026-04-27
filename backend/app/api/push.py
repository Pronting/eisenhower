"""Push Configuration & Push Log API endpoints."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, PushConfig, PushLog
from app.schemas.schemas import ApiResponse, PushConfigCreate, PushConfigUpdate
from app.services.push_service import trigger_push_for_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/push-configs", tags=["push"])


def _push_config_to_dict(cfg: PushConfig) -> dict:
    return {
        "id": cfg.id,
        "user_id": cfg.user_id,
        "push_type": cfg.push_type,
        "address": cfg.address,
        "push_time": cfg.push_time or "09:00",
        "enabled": bool(cfg.enabled),
        "created_at": cfg.created_at.isoformat() if cfg.created_at else "",
    }


# ======================================================================
# Push Config CRUD
# ======================================================================


@router.get("")
def list_push_configs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all push configs for the current user."""
    configs = db.query(PushConfig).filter(PushConfig.user_id == user.id).all()
    return ApiResponse(data=[_push_config_to_dict(c) for c in configs])


@router.post("")
def create_push_config(
    req: PushConfigCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new push config."""
    config = PushConfig(
        user_id=user.id,
        push_type=req.push_type,
        address=req.address,
        push_time=req.push_time or "09:00",
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return ApiResponse(data=_push_config_to_dict(config))


@router.put("/{config_id}")
def update_push_config(
    config_id: int,
    req: PushConfigUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a push config."""
    config = db.query(PushConfig).filter(
        PushConfig.id == config_id, PushConfig.user_id == user.id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Push config not found")

    if req.push_type is not None:
        config.push_type = req.push_type
    if req.address is not None:
        config.address = req.address
    if req.push_time is not None:
        config.push_time = req.push_time
    if req.enabled is not None:
        config.enabled = 1 if req.enabled else 0

    db.commit()
    db.refresh(config)
    return ApiResponse(data=_push_config_to_dict(config))


@router.delete("/{config_id}")
def delete_push_config(
    config_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a push config."""
    config = db.query(PushConfig).filter(
        PushConfig.id == config_id, PushConfig.user_id == user.id
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Push config not found")
    db.delete(config)
    db.commit()
    return ApiResponse(message="Push config deleted")


# ======================================================================
# Push Trigger
# ======================================================================


@router.post("/send-now")
def send_now(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually trigger push for all enabled configs of current user."""
    results = trigger_push_for_user(user.id, db)
    if not results:
        raise HTTPException(status_code=400, detail="No enabled push configs found")
    return ApiResponse(data=results)


@router.get("/logs")
def list_push_logs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List recent push logs for the current user."""
    logs = (
        db.query(PushLog)
        .filter(PushLog.user_id == user.id)
        .order_by(PushLog.created_at.desc())
        .limit(20)
        .all()
    )
    return ApiResponse(data=[
        {
            "id": l.id,
            "push_config_id": l.push_config_id,
            "summary_content": l.summary_content,
            "status": l.status,
            "error_message": l.error_message,
            "created_at": l.created_at.isoformat() if l.created_at else "",
        }
        for l in logs
    ])
