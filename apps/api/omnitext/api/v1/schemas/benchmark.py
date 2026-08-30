"""Pydantic schemas for model benchmarking and model registry endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class BenchmarkResultResponse(BaseModel):
    """Schema for model benchmark performance and accuracy result responses."""

    id: int
    task: str
    model_id: str
    metric_name: str
    metric_score: float
    latency_ms: float
    memory_mb: float
    created_at: datetime

    class Config:
        from_attributes = True


class ModelRegistryResponse(BaseModel):
    """Schema for model registry database records."""

    id: int
    task: str
    model_id: str
    version: str
    is_active: bool
    is_fine_tuned: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PromoteRequest(BaseModel):
    """Request schema for promoting a specific candidate model to active status for a task."""

    task: str = Field(..., description="Task identifier")
    model_id: str = Field(..., description="Hugging Face model identifier")
