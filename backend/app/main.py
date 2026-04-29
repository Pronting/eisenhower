import logging
import threading
import time
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.database import engine, Base, SessionLocal
from app.core.config import settings
from app.api import auth, tasks, agent, push, stats, notes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.APP_NAME, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(agent.router)
app.include_router(push.router)
app.include_router(stats.router)
app.include_router(notes.router)


# ======================================================================
# Background Push Scheduler
# ======================================================================


def _push_scheduler_loop():
    """Background thread: check every 30s and send pushes due at current time."""
    from app.models.models import PushConfig
    from app.services.push_service import execute_push

    # Track which configs were already sent this minute to prevent duplicates
    _sent_this_minute: set[tuple[int, str]] = set()  # {(config_id, "HH:MM"), ...}
    _last_minute: str = ""

    while True:
        try:
            now = datetime.now().strftime("%H:%M")

            # Reset tracking when the minute changes
            if now != _last_minute:
                _sent_this_minute.clear()
                _last_minute = now

            db = SessionLocal()
            try:
                configs = (
                    db.query(PushConfig)
                    .filter(PushConfig.enabled == 1, PushConfig.push_time == now)
                    .all()
                )
                for cfg in configs:
                    key = (cfg.id, now)
                    if key in _sent_this_minute:
                        continue  # Already sent this minute — skip
                    _sent_this_minute.add(key)
                    logger.info(f"Sending scheduled push: user={cfg.user_id} type={cfg.push_type}")
                    execute_push(cfg, cfg.user_id, db)
            finally:
                db.close()
        except Exception:
            logger.exception("Push scheduler error")
        time.sleep(30)


_scheduler_thread = threading.Thread(target=_push_scheduler_loop, daemon=True)
_scheduler_thread.start()


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "data": None, "message": exc.detail},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"code": 500, "data": None, "message": "Internal Server Error"},
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}
