"""OmniText FastAPI Application Entrypoint."""

import os
import time
import uuid

os.environ["USE_TORCH"] = "1"
os.environ["USE_TF"] = "0"
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from omnitext.api.v1.routers.analyses import router as analyses_router
from omnitext.api.v1.routers.auth import router as auth_router
from omnitext.api.v1.routers.benchmarks import router as benchmarks_router
from omnitext.api.v1.routers.documents import router as documents_router
from omnitext.api.v1.routers.experiments import router as experiments_router
from omnitext.api.v1.routers.health import router as health_router
from omnitext.api.v1.routers.search import router as search_router
from omnitext.api.v1.schemas.envelope import (
    ResponseEnvelope,
    ResponseError,
    ResponseMeta,
)
from omnitext.core.config import settings
from omnitext.core.logging import logger, setup_logging
from omnitext.db.session import init_db_and_seed


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifecycle events manager for database initialization."""
    await init_db_and_seed()
    yield

def create_app() -> FastAPI:
    """Construct and configure the FastAPI application."""
    setup_logging(debug=settings.API_DEBUG)

    app = FastAPI(
        title="OmniText API",
        version="0.1.0",
        description="Unified NLP and Text Intelligence REST API",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.API_CORS_ORIGINS
        if isinstance(settings.API_CORS_ORIGINS, list)
        else [settings.API_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Middleware: Request ID and structured request logging
    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next: Any) -> Any:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start_time = time.perf_counter()

        response = await call_next(request)

        latency_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        response.headers["X-Request-ID"] = request_id

        # Log non-PII request diagnostic info
        logger.info(
            f"{request.method} {request.url.path} - {response.status_code} ({latency_ms}ms)",
            extra={"request_id": request_id, "latency_ms": latency_ms},
        )
        return response

    # Centralized exception handlers for standard envelope compliance
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        envelope = ResponseEnvelope[dict[str, Any]](
            data=None,
            meta=ResponseMeta(request_id=request_id),
            error=ResponseError(
                code="VALIDATION_ERROR",
                message="Request payload failed validation schema.",
                details={"errors": exc.errors()},
            ),
        )
        return JSONResponse(status_code=422, content=envelope.model_dump())

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        envelope = ResponseEnvelope[dict[str, Any]](
            data=None,
            meta=ResponseMeta(request_id=request_id),
            error=ResponseError(
                code=f"HTTP_{exc.status_code}",
                message=str(exc.detail),
            ),
        )
        return JSONResponse(status_code=exc.status_code, content=envelope.model_dump())

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        logger.error(
            f"Unhandled server exception on {request.url.path}: {exc}",
            exc_info=True,
            extra={"request_id": request_id},
        )
        envelope = ResponseEnvelope[dict[str, Any]](
            data=None,
            meta=ResponseMeta(request_id=request_id),
            error=ResponseError(
                code="INTERNAL_SERVER_ERROR",
                message="An unexpected internal server error occurred.",
            ),
        )
        return JSONResponse(status_code=500, content=envelope.model_dump())

    # Mount API v1 routers
    app.include_router(health_router, prefix=settings.API_V1_PREFIX)
    app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
    app.include_router(analyses_router, prefix=settings.API_V1_PREFIX)
    app.include_router(documents_router, prefix=settings.API_V1_PREFIX)
    app.include_router(search_router, prefix=settings.API_V1_PREFIX)
    app.include_router(benchmarks_router, prefix=settings.API_V1_PREFIX)
    app.include_router(experiments_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()
