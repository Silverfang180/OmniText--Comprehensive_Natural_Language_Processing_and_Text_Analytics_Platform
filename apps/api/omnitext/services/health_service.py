"""System and Application Health Service."""

from typing import Any

from omnitext.core.config import settings
from omnitext.db.session import check_db_health


class HealthService:
    """Service layer handling system health and diagnostics."""

    @staticmethod
    async def get_system_health() -> dict[str, Any]:
        """Check API service health status."""
        return {
            "status": "ok",
            "environment": settings.API_ENV,
            "version": "0.1.0",
            "service": "omnitext-api",
        }

    @staticmethod
    async def get_db_health() -> dict[str, Any]:
        """Check PostgreSQL database connectivity."""
        is_healthy = await check_db_health()
        return {
            "status": "connected" if is_healthy else "disconnected",
            "database": "postgresql",
            "healthy": is_healthy,
        }
