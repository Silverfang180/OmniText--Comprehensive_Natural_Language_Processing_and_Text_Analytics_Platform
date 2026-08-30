from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.api.v1.deps import db_session_dependency, get_current_user, get_optional_user
from omnitext.api.v1.schemas.document import QARequest, QAResponse, SearchRequest, SearchResultItem
from omnitext.api.v1.schemas.envelope import ResponseEnvelope, ResponseMeta
from omnitext.db.models import User
from omnitext.services import qa_service, search_service

router = APIRouter(prefix="/search", tags=["Search"])


@router.post("", response_model=ResponseEnvelope[list[SearchResultItem]])
async def query_semantic_search(
    request_data: SearchRequest,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[list[SearchResultItem]]:
    """Execute natural-language semantic search query on the specified dataset."""
    request_id = getattr(request.state, "request_id", None)

    limit = request_data.limit if request_data.limit is not None else 5
    results = await search_service.semantic_search(
        db=db,
        user_id=current_user.id,
        dataset_id=request_data.dataset_id,
        query_text=request_data.query,
        limit=limit,
    )

    data = [SearchResultItem(**res) for res in results]

    return ResponseEnvelope[list[SearchResultItem]](
        data=data,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.post("/qa", response_model=ResponseEnvelope[QAResponse])
async def query_extractive_qa(
    request_data: QARequest,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User | None = Depends(get_optional_user),
) -> ResponseEnvelope[QAResponse]:
    """Execute extractive QA against raw context or indexed datasets/documents."""
    request_id = getattr(request.state, "request_id", None)

    if request_data.dataset_id is not None:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for dataset-based Question Answering.",
            )
        result = await qa_service.qa_search(
            db=db,
            user_id=current_user.id,
            question=request_data.question,
            dataset_id=request_data.dataset_id,
            document_id=request_data.document_id,
        )
    elif request_data.context is not None:
        result = await qa_service.qa_direct(
            question=request_data.question,
            context=request_data.context,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'context' or 'dataset_id' must be provided to run Question Answering.",
        )

    data = QAResponse(**result)

    return ResponseEnvelope[QAResponse](
        data=data,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )
