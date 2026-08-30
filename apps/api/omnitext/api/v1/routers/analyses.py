"""API Router for single/multi-task text analyses with optional persistence."""

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.api.v1.deps import (
    db_session_dependency,
    get_current_user,
    get_optional_user,
    get_user_analysis,
)
from omnitext.api.v1.schemas.analyses import AnalysisRequest, AnalysisResponse
from omnitext.api.v1.schemas.envelope import ResponseEnvelope, ResponseMeta
from omnitext.db.models import Analysis, User
from omnitext.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analyses", tags=["Analyses"])


@router.post("", response_model=ResponseEnvelope[dict[str, Any]])
async def analyze_text(
    request_data: AnalysisRequest,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User | None = Depends(get_optional_user),
) -> ResponseEnvelope[dict[str, Any]]:
    """Synchronously execute multiple NLP tasks on the input text.

    If request is authenticated, automatically persist analysis run in database.
    """
    request_id = getattr(request.state, "request_id", None)

    analysis_res = await AnalysisService.analyze_text(
        text=request_data.text,
        tasks=request_data.tasks,
        options=request_data.options,
    )

    analysis_id: str | None = None

    # Auto-persist analysis if request is authenticated
    if current_user:
        new_analysis = Analysis(
            user_id=current_user.id,
            text=request_data.text,
            tasks=request_data.tasks,
            results=analysis_res["results"],
            meta=analysis_res["meta"],
        )
        db.add(new_analysis)
        await db.commit()
        await db.refresh(new_analysis)
        analysis_id = new_analysis.id

    meta_extra = {
        "model_ids": analysis_res["meta"]["model_ids"],
        "latencies_ms": analysis_res["meta"]["latencies_ms"],
    }
    if analysis_id:
        meta_extra["analysis_id"] = analysis_id

    return ResponseEnvelope[dict[str, Any]](
        data=analysis_res["results"],
        meta=ResponseMeta(
            model_id=None,
            latency_ms=analysis_res["meta"]["total_latency_ms"],
            request_id=request_id,
            extra=meta_extra,
        ),
        error=None,
    )


@router.get("", response_model=ResponseEnvelope[list[AnalysisResponse]])
async def list_saved_analyses(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(db_session_dependency),
) -> ResponseEnvelope[list[AnalysisResponse]]:
    """List authenticated user's paginated saved analyses history."""
    request_id = getattr(request.state, "request_id", None)

    # Calculate pagination offsets
    offset = (page - 1) * size

    # Query items
    query = (
        select(Analysis)
        .where(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    # Query total count for pagination metadata
    count_query = select(func.count(Analysis.id)).where(Analysis.user_id == current_user.id)
    count_result = await db.execute(count_query)
    total_count = count_result.scalar_one()

    resp_list = [AnalysisResponse.model_validate(item) for item in items]

    pagination_extra = {
        "page": page,
        "size": size,
        "total_records": total_count,
        "total_pages": (total_count + size - 1) // size if total_count > 0 else 0,
    }

    return ResponseEnvelope[list[AnalysisResponse]](
        data=resp_list,
        meta=ResponseMeta(
            request_id=request_id,
            extra=pagination_extra,
        ),
        error=None,
    )


@router.get("/{analysis_id}", response_model=ResponseEnvelope[AnalysisResponse])
async def get_saved_analysis(
    request: Request,
    analysis: Analysis = Depends(get_user_analysis),
) -> ResponseEnvelope[AnalysisResponse]:
    """Retrieve details of a specific saved analysis.

    Access is strictly restricted to the owning user.
    """
    request_id = getattr(request.state, "request_id", None)
    resp_data = AnalysisResponse.model_validate(analysis)

    return ResponseEnvelope[AnalysisResponse](
        data=resp_data,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.delete("/{analysis_id}", response_model=ResponseEnvelope[dict[str, Any]])
async def delete_saved_analysis(
    request: Request,
    analysis: Analysis = Depends(get_user_analysis),
    db: AsyncSession = Depends(db_session_dependency),
) -> ResponseEnvelope[dict[str, Any]]:
    """Delete a saved analysis from history.

    Access is strictly restricted to the owning user.
    """
    request_id = getattr(request.state, "request_id", None)

    await db.delete(analysis)
    await db.commit()

    return ResponseEnvelope[dict[str, Any]](
        data={"success": True, "message": "Analysis deleted from history successfully."},
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )
