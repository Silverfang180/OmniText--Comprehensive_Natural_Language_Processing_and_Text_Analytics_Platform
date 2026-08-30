"""Pydantic schemas for text analysis endpoints."""

from typing import Any

from pydantic import BaseModel, Field


class AnalysisRequest(BaseModel):
    """Payload to analyze a text with specific NLP tasks."""

    text: str = Field(
        ...,
        description="Text content to be analyzed.",
        examples=["Google was founded in 1998 by Larry Page and Sergey Brin."],
    )
    tasks: list[str] = Field(
        ...,
        description="List of tasks to execute. Available: summarization, sentiment, ner.",
        examples=[["sentiment", "ner"]],
    )
    options: dict[str, Any] | None = Field(
        default=None,
        description="Optional task-specific parameters (e.g. summary length).",
    )


from datetime import datetime


class AnalysisResponse(BaseModel):
    """Schema representing a saved analysis history record."""

    id: str
    text: str
    tasks: list[str]
    results: dict[str, Any]
    meta: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
