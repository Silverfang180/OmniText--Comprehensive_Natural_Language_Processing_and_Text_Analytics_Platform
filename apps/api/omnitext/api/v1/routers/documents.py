"""API Router for Dataset and Document management."""

from io import BytesIO

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.api.v1.deps import db_session_dependency, get_current_user
from omnitext.api.v1.schemas.document import (
    DatasetCreate,
    DatasetDetailResponse,
    DatasetResponse,
    DocumentResponse,
)
from omnitext.api.v1.schemas.envelope import ResponseEnvelope, ResponseMeta
from omnitext.db.models import User
from omnitext.services import document_service

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/datasets", response_model=ResponseEnvelope[DatasetResponse])
async def create_new_dataset(
    request_data: DatasetCreate,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[DatasetResponse]:
    """Create a new dataset collection."""
    request_id = getattr(request.state, "request_id", None)
    dataset = await document_service.create_dataset(
        db=db, user_id=current_user.id, name=request_data.name
    )
    return ResponseEnvelope[DatasetResponse](
        data=DatasetResponse.model_validate(dataset),
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.get("/datasets", response_model=ResponseEnvelope[list[DatasetResponse]])
async def list_user_datasets(
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[list[DatasetResponse]]:
    """List all datasets owned by the authenticated user."""
    request_id = getattr(request.state, "request_id", None)
    datasets = await document_service.list_datasets(db=db, user_id=current_user.id)
    data = [DatasetResponse.model_validate(ds) for ds in datasets]
    return ResponseEnvelope[list[DatasetResponse]](
        data=data,
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.get("/datasets/{dataset_id}", response_model=ResponseEnvelope[DatasetDetailResponse])
async def get_dataset_details(
    dataset_id: int,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[DatasetDetailResponse]:
    """Retrieve detailed metadata of a dataset including all its documents."""
    request_id = getattr(request.state, "request_id", None)
    dataset = await document_service.get_dataset_or_404(
        db=db, user_id=current_user.id, dataset_id=dataset_id
    )
    return ResponseEnvelope[DatasetDetailResponse](
        data=DatasetDetailResponse.model_validate(dataset),
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.delete("/datasets/{dataset_id}", response_model=ResponseEnvelope[dict[str, bool]])
async def delete_user_dataset(
    dataset_id: int,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[dict[str, bool]]:
    """Delete a dataset and all its associated documents and raw files."""
    request_id = getattr(request.state, "request_id", None)
    await document_service.delete_dataset(db=db, user_id=current_user.id, dataset_id=dataset_id)
    return ResponseEnvelope[dict[str, bool]](
        data={"success": True},
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.post("/datasets/{dataset_id}/upload", response_model=ResponseEnvelope[DocumentResponse])
async def upload_dataset_file(
    dataset_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[DocumentResponse]:
    """Upload a text, PDF, DOCX, or CSV document file into a dataset. Enqueues background ingestion."""
    request_id = getattr(request.state, "request_id", None)

    # Read bytes to validate size and feed stream
    file_bytes = await file.read()
    file_size = len(file_bytes)

    # Use filename if present, fallback to empty string
    filename = file.filename or ""
    content_type = file.content_type or "text/plain"

    document = await document_service.upload_document(
        db=db,
        user_id=current_user.id,
        dataset_id=dataset_id,
        filename=filename,
        content_type=content_type,
        file_size=file_size,
        file_obj=BytesIO(file_bytes),
    )

    return ResponseEnvelope[DocumentResponse](
        data=DocumentResponse.model_validate(document),
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.get(
    "/datasets/{dataset_id}/documents/{document_id}", response_model=ResponseEnvelope[DocumentResponse]
)
async def get_document_details(
    dataset_id: int,
    document_id: int,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[DocumentResponse]:
    """Retrieve metadata and ingestion processing status of a document."""
    request_id = getattr(request.state, "request_id", None)
    document = await document_service.get_document_or_404(
        db=db, user_id=current_user.id, dataset_id=dataset_id, document_id=document_id
    )
    return ResponseEnvelope[DocumentResponse](
        data=DocumentResponse.model_validate(document),
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )


@router.delete(
    "/datasets/{dataset_id}/documents/{document_id}", response_model=ResponseEnvelope[dict[str, bool]]
)
async def delete_dataset_document(
    dataset_id: int,
    document_id: int,
    request: Request,
    db: AsyncSession = Depends(db_session_dependency),
    current_user: User = Depends(get_current_user),
) -> ResponseEnvelope[dict[str, bool]]:
    """Delete a document record and its physical storage file."""
    request_id = getattr(request.state, "request_id", None)
    await document_service.delete_document(
        db=db, user_id=current_user.id, dataset_id=dataset_id, document_id=document_id
    )
    return ResponseEnvelope[dict[str, bool]](
        data={"success": True},
        meta=ResponseMeta(request_id=request_id),
        error=None,
    )
