"""API Router for model registry benchmarking and active model promotion."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.api.v1.deps import db_session_dependency, get_current_user
from omnitext.api.v1.schemas.benchmark import (
    BenchmarkResultResponse,
    ModelRegistryResponse,
    PromoteRequest,
)
from omnitext.api.v1.schemas.envelope import ResponseEnvelope, ResponseMeta
from omnitext.db.models import Job, User
from omnitext.db.models.benchmark import BenchmarkResult, ModelRegistryEntry
from omnitext.services.analysis_service import AnalysisService

router = APIRouter(prefix="/benchmarks", tags=["Benchmarks"])


@router.get("")
async def list_benchmarks(
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
) -> ResponseEnvelope[dict[str, Any]]:
    """Retrieve all model registry entries and evaluation benchmark results."""
    request_id = getattr(request.state, "request_id", None)

    # Query registry
    reg_stmt = select(ModelRegistryEntry).order_by(ModelRegistryEntry.task.asc())
    reg_res = await db.execute(reg_stmt)
    registry = reg_res.scalars().all()

    # Query benchmark results
    bench_stmt = select(BenchmarkResult).order_by(BenchmarkResult.created_at.desc())
    bench_res = await db.execute(bench_stmt)
    results = bench_res.scalars().all()

    data = {
        "registry": [ModelRegistryResponse.model_validate(r) for r in registry],
        "results": [BenchmarkResultResponse.model_validate(r) for r in results],
    }

    return ResponseEnvelope[dict[str, Any]](
        data=data,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.post("/run")
async def trigger_benchmarks_run(
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[dict[str, Any]]:
    """Queue a new asynchronous model registry evaluation run."""
    request_id = getattr(request.state, "request_id", None)

    # Check if a benchmark run is already pending or processing
    pending_stmt = select(Job).where(
        Job.type == "run_benchmark",
        Job.status.in_(["pending", "processing"]),
    )
    pending_res = await db.execute(pending_stmt)
    if pending_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A benchmarking run is already in progress.",
        )

    # Queue new job
    job = Job(
        type="run_benchmark",
        status="pending",
        payload={},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    data = {
        "job_id": job.id,
        "status": job.status,
    }

    return ResponseEnvelope[dict[str, Any]](
        data=data,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.post("/promote")
async def promote_registry_model(
    request_data: PromoteRequest,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[dict[str, Any]]:
    """Promote a specific candidate model to active status for a given task."""
    request_id = getattr(request.state, "request_id", None)

    # Validate that model candidate exists for the task in registry
    stmt = select(ModelRegistryEntry).where(
        ModelRegistryEntry.task == request_data.task,
        ModelRegistryEntry.model_id == request_data.model_id,
    )
    res = await db.execute(stmt)
    entry = res.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate model '{request_data.model_id}' not found for task '{request_data.task}'.",
        )

    # Deactivate all models for this task
    deact_stmt = (
        update(ModelRegistryEntry)
        .where(ModelRegistryEntry.task == request_data.task)
        .values(is_active=False)
    )
    await db.execute(deact_stmt)

    # Activate chosen model
    entry.is_active = True
    await db.commit()

    # Clear cached adapter for the task to force reload
    AnalysisService._loaded_adapters.pop(request_data.task, None)

    data = {
        "success": True,
        "message": f"Successfully promoted '{request_data.model_id}' to active model for task '{request_data.task}'.",
    }

    return ResponseEnvelope[dict[str, Any]](
        data=data,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )
