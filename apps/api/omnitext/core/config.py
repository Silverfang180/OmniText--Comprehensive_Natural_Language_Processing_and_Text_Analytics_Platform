"""Application Configuration Module."""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core application settings loaded from environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_ENV: str = "development"
    API_DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    API_CORS_ORIGINS: str | list[str] = [
        "*",
    ]


    # Database
    API_DATABASE_URL: str = "sqlite+aiosqlite:///omnitext.db"
    DATABASE_URL_SYNC: str = "sqlite:///omnitext.db"
    DB_ECHO: bool = False
    API_STORAGE_DIR: str = "storage_data"


    # Worker
    WORKER_POLL_INTERVAL_SECONDS: float = 2.0

    # Auth Security
    JWT_SECRET_KEY: str = "omnitext-super-secret-key-32-chars-at-least-must-be-changed-in-prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @field_validator("API_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        """Convert string comma-separated origins to list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
