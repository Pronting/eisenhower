"""LangChain LLM setup for DeepSeek V4 Flash."""
from typing import Optional
from langchain_openai import ChatOpenAI
from app.core.config import settings


def get_llm(temperature: float = 0.1, max_tokens: Optional[int] = None) -> Optional[ChatOpenAI]:
    """Get a LangChain ChatOpenAI instance configured for DeepSeek V4 Flash."""
    if not settings.DEEPSEEK_API_KEY:
        return None
    return ChatOpenAI(
        model="deepseek-v4-flash",
        api_key=settings.DEEPSEEK_API_KEY,
        base_url="https://api.deepseek.com/v1",
        temperature=temperature,
        max_tokens=max_tokens,
    )
