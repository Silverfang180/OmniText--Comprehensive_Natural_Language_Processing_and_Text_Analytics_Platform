"""Pydantic schemas for Datasets, Documents, and Search endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class DatasetCreate(BaseModel):
    """Schema for dataset creation requests."""

    name: str = Field(..., min_length=1, max_length=255, description="Name of the dataset")


class DocumentResponse(BaseModel):
    """Schema for document metadata responses."""

    id: int
    dataset_id: int
    filename: str
    content_type: str
    file_size: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetResponse(BaseModel):
    """Schema for high-level dataset responses."""

    id: int
    name: str
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetDetailResponse(BaseModel):
    """Schema for detailed dataset responses including its uploaded documents."""

    id: int
    name: str
    user_id: int
    created_at: datetime
    documents: list[DocumentResponse]

    class Config:
        from_attributes = True


class SearchRequest(BaseModel):
    """Schema for semantic search query requests."""

    dataset_id: int = Field(..., description="ID of the dataset to search within")
    query: str = Field(..., min_length=1, description="Natural language search query")
    limit: int | None = Field(5, ge=1, le=50, description="Max number of search results to retrieve")


class SearchResultItem(BaseModel):
    """Schema for individual semantic search match items."""

    text: str
    score: float
    filename: str
    chunk_index: int


class QARequest(BaseModel):
    """Schema for Extractive Question Answering requests."""

    question: str = Field(..., min_length=1, description="Question query text")
    context: str | None = Field(default=None, description="Direct text passage context")
    dataset_id: int | None = Field(default=None, description="Optional dataset ID to run search QA over")
    document_id: int | None = Field(default=None, description="Optional document ID to run search QA over")


class QAResponse(BaseModel):
    """Schema for Question Answering results."""

    answer: str
    score: float
    start: int
    end: int
    source_passage: str
    document_title: str | None = None
    match_score: float | None = None
