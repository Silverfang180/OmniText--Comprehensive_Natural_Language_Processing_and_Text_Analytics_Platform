"""Pydantic schemas for fine-tuning experiment endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ExperimentCreateRequest(BaseModel):
    """Request schema for initiating a new fine-tuning experiment."""

    name: str = Field(..., max_length=100, description="Friendly name of the experiment")
    base_model_id: str = Field(
        "dslim/bert-base-NER", description="Base Hugging Face model to fine-tune"
    )
    hyperparameters: dict[str, Any] = Field(
        default_factory=lambda: {
            "learning_rate": 5e-5,
            "epochs": 3,
            "batch_size": 16,
        },
        description="Training hyperparameters",
    )


class ExperimentResponse(BaseModel):
    """Response schema for experiment information."""

    id: int
    name: str
    status: str
    task: str
    base_model_id: str
    fine_tuned_model_id: str | None = None
    hyperparameters: dict[str, Any]
    metrics: list[dict[str, Any]]
    baseline_metrics: dict[str, Any] | None = None
    final_metrics: dict[str, Any] | None = None
    created_at: datetime
    completed_at: datetime | None = None

    class Config:
        from_attributes = True
