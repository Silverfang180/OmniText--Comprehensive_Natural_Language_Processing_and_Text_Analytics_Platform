"""Health Check API Router."""

import time
from typing import Any

from fastapi import APIRouter

from omnitext.api.v1.schemas.envelope import ResponseEnvelope, ResponseMeta
from omnitext.services.health_service import HealthService

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=ResponseEnvelope[dict[str, Any]])
async def health_check() -> ResponseEnvelope[dict[str, Any]]:
    """Return application health status wrapped in standard envelope."""
    start_time = time.perf_counter()
    health_data = await HealthService.get_system_health()
    latency = (time.perf_counter() - start_time) * 1000.0

    return ResponseEnvelope[dict[str, Any]](
        data=health_data,
        meta=ResponseMeta(
            model_id=None,
            latency_ms=round(latency, 2),
            request_id=None,
        ),
        error=None,
    )


@router.get("/db", response_model=ResponseEnvelope[dict[str, Any]])
async def db_health_check() -> ResponseEnvelope[dict[str, Any]]:
    """Return database health status wrapped in standard envelope."""
    start_time = time.perf_counter()
    db_health = await HealthService.get_db_health()
    latency = (time.perf_counter() - start_time) * 1000.0

    return ResponseEnvelope[dict[str, Any]](
        data=db_health,
        meta=ResponseMeta(
            model_id=None,
            latency_ms=round(latency, 2),
            request_id=None,
        ),
        error=None,
    )
