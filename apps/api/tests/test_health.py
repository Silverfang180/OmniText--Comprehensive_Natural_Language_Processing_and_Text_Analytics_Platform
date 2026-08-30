"""Unit and Integration Tests for Health Endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from omnitext.main import app


@pytest.mark.asyncio
async def test_api_health_endpoint() -> None:
    """Verify /api/v1/health returns 200 with standard envelope."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200

        payload = response.json()
        assert "data" in payload
        assert "meta" in payload
        assert "error" in payload
        assert payload["error"] is None

        data = payload["data"]
        assert data["status"] == "ok"
        assert data["service"] == "omnitext-api"
        assert "latency_ms" in payload["meta"]
        assert payload["meta"]["latency_ms"] is not None


@pytest.mark.asyncio
async def test_db_health_endpoint() -> None:
    """Verify /api/v1/health/db returns 200 with standard envelope."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health/db")
        assert response.status_code == 200

        payload = response.json()
        assert "data" in payload
        assert "meta" in payload
        assert payload["error"] is None

        data = payload["data"]
        assert "database" in data
        assert data["database"] == "postgresql"


@pytest.mark.asyncio
async def test_openapi_docs_endpoint() -> None:
    """Verify /docs and openapi.json are accessible."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        docs_res = await client.get("/docs")
        assert docs_res.status_code == 200

        openapi_res = await client.get("/api/v1/openapi.json")
        assert openapi_res.status_code == 200
        spec = openapi_res.json()
        assert spec["info"]["title"] == "OmniText API"


@pytest.mark.asyncio
async def test_404_error_envelope() -> None:
    """Verify non-existent routes return 404 in standard envelope."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/nonexistent")
        assert response.status_code == 404

        payload = response.json()
        assert payload["data"] is None
        assert payload["error"] is not None
        assert payload["error"]["code"] == "HTTP_404"
