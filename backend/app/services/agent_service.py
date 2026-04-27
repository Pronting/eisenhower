"""
AI Agent service for task classification.
Uses DeepSeek API if configured, otherwise falls back to rule-based.
"""
import json
import re
import logging
from typing import Optional
import httpx
from app.core.config import settings
from app.services.classification import classify_task

logger = logging.getLogger(__name__)


def ai_classify_task(title: str, description: str = "") -> dict:
    """Classify task using AI (DeepSeek) if available, else rule-based fallback."""
    if not settings.DEEPSEEK_API_KEY:
        return classify_task(title, description)

    try:
        return _call_deepseek(title, description)
    except Exception as e:
        logger.warning(f"DeepSeek API failed, falling back to rule-based: {e}")
        result = classify_task(title, description)
        result["ai_available"] = False
        return result


def _call_deepseek(title: str, description: str) -> dict:
    """Call DeepSeek API for task classification (sync HTTP call)."""
    system_prompt = """You are a task classification assistant using the Eisenhower Matrix.
Classify the task into one of four quadrants:
- q1: Urgent & Important (Do First)
- q2: Not Urgent & Important (Schedule)
- q3: Urgent & Not Important (Delegate)
- q4: Not Urgent & Not Important (Eliminate)

Return JSON: {"quadrant": "q1|q2|q3|q4", "reason": "简短中文理由", "is_long_term": bool}"""

    user_prompt = f"Task: {title}\nDescription: {description}"

    with httpx.Client(timeout=30) as client:
        resp = client.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.1,
            },
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]

        # Handle markdown code block wrapping
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if json_match:
            content = json_match.group(1)

        result = json.loads(content)
        result["method"] = "deepseek"
        return result
