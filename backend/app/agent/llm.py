"""LangChain LLM setup for DeepSeek V4 Flash.

Provides a process-wide flag for DeepSeek quota exhaustion (HTTP 402 / 429).
Once detected, `get_llm()` short-circuits to `None` so all downstream agents
gracefully fall back to their rule-based paths instead of retrying the
already-exhausted endpoint every request.
"""
import logging
from typing import Optional, Any, Sequence, Tuple

from langchain_core.messages import BaseMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

# Process-wide flag: once DeepSeek returns 402/429, stop trying until restart.
_quota_exhausted: bool = False

# Markers used to detect quota / billing errors in exception messages.
_QUOTA_MARKERS = (
    "insufficient_balance",
    "insufficient quota",
    "payment_required",
    "quota exceeded",
    "rate limit",
    "429",
    "402",
)


def mark_quota_exhausted(reason: str = "DeepSeek API 余额或配额已耗尽") -> None:
    """Mark the DeepSeek quota as exhausted. Future `get_llm()` returns None.

    Idempotent: only logs the warning the first time.
    """
    global _quota_exhausted
    if not _quota_exhausted:
        _quota_exhausted = True
        logger.warning(
            "%s (HTTP 402/429)。已切换到规则降级模式，请充值/调整配额后重启服务恢复 AI 功能。",
            reason,
        )


def is_quota_exhausted() -> bool:
    """True if DeepSeek quota was detected as exhausted in this process."""
    return _quota_exhausted


def _is_quota_error(exc: BaseException) -> bool:
    """Return True if exception looks like a DeepSeek quota / billing error."""
    msg = (str(exc) or "").lower()
    return any(marker in msg for marker in _QUOTA_MARKERS)


def get_llm(temperature: float = 0.1, max_tokens: Optional[int] = None) -> Optional[ChatOpenAI]:
    """Get a LangChain ChatOpenAI instance configured for DeepSeek V4 Flash.

    Returns None if the API key is missing or quota was previously detected as
    exhausted — callers must handle the None case with a rule-based fallback.
    """
    if _quota_exhausted:
        return None
    if not settings.DEEPSEEK_API_KEY:
        return None
    return ChatOpenAI(
        model="deepseek-v4-flash",
        api_key=settings.DEEPSEEK_API_KEY,
        base_url="https://api.deepseek.com/v1",
        temperature=temperature,
        max_tokens=max_tokens,
    )


def safe_invoke(
    llm: ChatOpenAI,
    messages: Sequence[BaseMessage],
) -> Tuple[Optional[Any], Optional[BaseException]]:
    """Invoke an LLM and auto-detect quota exhaustion.

    Returns `(response, None)` on success, or `(None, exception)` on failure.
    Quota-class errors set the global flag so subsequent calls short-circuit.
    """
    try:
        return llm.invoke(list(messages)), None
    except Exception as exc:  # noqa: BLE001 — we want to catch all LLM errors
        if _is_quota_error(exc):
            mark_quota_exhausted()
        return None, exc
