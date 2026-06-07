"""Background scheduler for PushSchedule rows (cron expressions)."""
import logging
import threading
import time
from datetime import datetime

from croniter import croniter

from app.core.database import SessionLocal
from app.models.models import PushSchedule, PushConfig
from app.services.push_service import execute_push

logger = logging.getLogger(__name__)


def _should_fire(schedule: PushSchedule, now: datetime) -> bool:
    """Return True if the schedule should fire right now."""
    base = schedule.last_fired_at or schedule.created_at or now
    try:
        itr = croniter(schedule.cron_expression, base)
        nxt = itr.get_next(datetime)
    except Exception as e:
        logger.warning(f"Bad cron {schedule.cron_expression}: {e}")
        return False
    return nxt <= now


def _dispatch(schedule: PushSchedule) -> None:
    """Send the actual push for a single schedule."""
    db = SessionLocal()
    try:
        schedule.last_fired_at = datetime.now()
        db.add(schedule)
        db.commit()
        if schedule.push_type == "desktop":
            logger.info(
                f"Would fire desktop notification: user={schedule.user_id} "
                f"label={schedule.label}"
            )
            return
        pc = PushConfig(
            id=0,
            user_id=schedule.user_id,
            push_type=schedule.push_type,
            address=schedule.address,
            push_time=None,
            enabled=1,
        )
        execute_push(pc, schedule.user_id, db)
    except Exception:
        logger.exception("Schedule dispatch failed")
    finally:
        db.close()


def scheduler_loop() -> None:
    while True:
        try:
            now = datetime.now()
            db = SessionLocal()
            try:
                schedules = (
                    db.query(PushSchedule)
                    .filter(PushSchedule.enabled == 1)
                    .all()
                )
                for s in schedules:
                    if _should_fire(s, now):
                        _dispatch(s)
            finally:
                db.close()
        except Exception:
            logger.exception("Scheduler loop error")
        time.sleep(30)


_thread: threading.Thread | None = None


def start_scheduler_thread() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _thread = threading.Thread(target=scheduler_loop, daemon=True)
    _thread.start()
    logger.info("PushSchedule scheduler thread started")
