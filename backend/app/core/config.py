from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "ishwe"
    DATABASE_URL: str = "sqlite:///./ishwe.db"
    JWT_SECRET: str = "ishwe-dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DEEPSEEK_API_KEY: Optional[str] = None
    CORS_ORIGINS: str = "http://localhost:3000"

    # Email — Resend (recommended, zero setup beyond API key)
    RESEND_API_KEY: str = ""

    # Email — SMTP fallback
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
