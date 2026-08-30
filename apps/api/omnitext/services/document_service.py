"""Service layer for dataset and document management."""

import os
import uuid
from collections.abc import Sequence
from typing import BinaryIO

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.core.logging import logger
from omnitext.db.models.document import Dataset, Document
from omnitext.db.models.job import Job
from omnitext.storage.object_store import object_store

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
SUPPORTED_EXTENSIONS = {".txt", ".pdf", ".docx", ".csv"}
SUPPORTED_MIME_TYPES = {
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/csv",
    "application/csv",
    "text/x-csv",
    "application/vnd.ms-excel",
}


async def get_dataset_or_404(db: AsyncSession, user_id: int, dataset_id: int) -> Dataset:
    """Retrieve dataset and authorize ownership. Raises 404 if not found or unauthorized."""
    query = select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user_id)
    result = await db.execute(query)
    dataset = result.scalars().first()
    if not dataset:
        logger.warning(
            "Dataset access denied or not found",
            extra={"user_id": user_id, "dataset_id": dataset_id},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )
    return dataset


async def create_dataset(db: AsyncSession, user_id: int, name: str) -> Dataset:
    """Create a new dataset collection for the user."""
    dataset = Dataset(name=name, user_id=user_id)
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)
    logger.info("Dataset created successfully", extra={"user_id": user_id, "dataset_id": dataset.id})
    return dataset


async def list_datasets(db: AsyncSession, user_id: int) -> Sequence[Dataset]:
    """Retrieve all datasets belonging to the user."""
    query = select(Dataset).where(Dataset.user_id == user_id).order_by(Dataset.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def delete_dataset(db: AsyncSession, user_id: int, dataset_id: int) -> None:
    """Delete a dataset and clean up all associated documents and physical files."""
    dataset = await get_dataset_or_404(db, user_id, dataset_id)

    # Clean up physical files in object storage for all documents in this dataset
    query = select(Document).where(Document.dataset_id == dataset_id)
    result = await db.execute(query)
    documents = result.scalars().all()
    for doc in documents:
        try:
            object_store.delete_object(doc.storage_path)
        except Exception as e:  # noqa: BLE001
            logger.error(
                f"Failed to delete physical file {doc.storage_path} during dataset deletion: {e}"
            )

    await db.delete(dataset)
    await db.commit()
    logger.info("Dataset deleted successfully", extra={"user_id": user_id, "dataset_id": dataset_id})


async def upload_document(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    filename: str,
    content_type: str,
    file_size: int,
    file_obj: BinaryIO,
) -> Document:
    """Validate document upload, store file physically, create DB record, and enqueue ingestion job."""
    # Enforce ownership check
    await get_dataset_or_404(db, user_id, dataset_id)

    # 1. Validate File Size
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of 25MB (got {file_size / (1024*1024):.1f}MB)",
        )

    # 2. Validate Extension
    ext = os.path.splitext(filename.lower())[1]
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension: '{ext}'. Allowed: {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    # 3. Validate MIME/Content-Type
    clean_mime = content_type.split(";")[0].strip().lower()
    if clean_mime not in SUPPORTED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content type: '{content_type}'",
        )

    # Save to object store with a unique key
    unique_id = uuid.uuid4().hex
    storage_path = f"datasets/{dataset_id}/documents/{unique_id}_{filename}"
    object_store.put_object(storage_path, file_obj)

    # Create Document metadata record
    document = Document(
        dataset_id=dataset_id,
        filename=filename,
        content_type=content_type,
        file_size=file_size,
        storage_path=storage_path,
        status="pending",
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Queue background processing ingestion job
    job = Job(
        type="document_ingestion",
        status="pending",
        payload={"document_id": document.id},
    )
    db.add(job)
    await db.commit()

    logger.info(
        "Document uploaded and ingestion job enqueued",
        extra={
            "user_id": user_id,
            "dataset_id": dataset_id,
            "document_id": document.id,
            "job_id": job.id,
        },
    )

    return document


async def get_document_or_404(
    db: AsyncSession, user_id: int, dataset_id: int, document_id: int
) -> Document:
    """Retrieve document metadata and authorize ownership. Raises 404 if not found or unauthorized."""
    await get_dataset_or_404(db, user_id, dataset_id)

    query = select(Document).where(Document.id == document_id, Document.dataset_id == dataset_id)
    result = await db.execute(query)
    document = result.scalars().first()
    if not document:
        logger.warning(
            "Document access denied or not found",
            extra={"user_id": user_id, "dataset_id": dataset_id, "document_id": document_id},
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return document


async def delete_document(
    db: AsyncSession, user_id: int, dataset_id: int, document_id: int
) -> None:
    """Delete a document record and clean up its physical file."""
    document = await get_document_or_404(db, user_id, dataset_id, document_id)

    # Remove physical file
    try:
        object_store.delete_object(document.storage_path)
    except Exception as e:  # noqa: BLE001
        logger.error(
            f"Failed to delete physical file {document.storage_path} during document deletion: {e}"
        )

    await db.delete(document)
    await db.commit()
    logger.info(
        "Document deleted successfully",
        extra={"user_id": user_id, "dataset_id": dataset_id, "document_id": document_id},
    )
