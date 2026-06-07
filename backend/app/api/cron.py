"""AI natural-language -> cron expression endpoint."""
from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.models import User
from app.schemas.schemas import (
    CronGenerateRequest,
    CronGenerateResponse,
    CronPreview,
)
from app.agent.nl2cron import generate_cron_candidates, preview_cron

router = APIRouter(prefix="/api/cron", tags=["cron"])


@router.post("/generate", response_model=CronGenerateResponse)
def generate(req: CronGenerateRequest, user: User = Depends(get_current_user)):
    """Convert a natural-language push description into cron candidates.

    Returns 1-3 candidate cron expressions with human-readable explanations
    and the next 5 fire times for each. The user can then confirm or
    regenerate from the desktop client.
    """
    candidates_raw, reasoning = generate_cron_candidates(req.description)
    candidates = []
    for c in candidates_raw:
        try:
            next_runs = preview_cron(c["cron"], n=5)
        except Exception:
            next_runs = []
        candidates.append(
            CronPreview(
                cron=c["cron"],
                next_runs=next_runs,
                human_readable=c.get("human", c["cron"]),
            )
        )
    return CronGenerateResponse(candidates=candidates, reasoning=reasoning)
