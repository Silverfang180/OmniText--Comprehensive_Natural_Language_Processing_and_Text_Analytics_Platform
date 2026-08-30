"""API Standard Response Envelope Schemas."""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ResponseMeta(BaseModel):
    """Metadata block included in all API responses."""

    model_id: str | None = Field(
        default=None, description="Identifier of the executing model"
    )
    latency_ms: float | None = Field(
        default=None, description="Inference/processing latency in milliseconds"
    )
    request_id: str | None = Field(
        default=None, description="Unique trace identifier for the request"
    )
    extra: dict[str, Any] | None = Field(
        default=None, description="Additional non-sensitive metadata"
    )


class ResponseError(BaseModel):
    """Standard error detail object."""

    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable safe error message")
    details: dict[str, Any] | None = Field(
        default=None, description="Structured error context"
    )


class ResponseEnvelope(BaseModel, Generic[T]):
    """Standard top-level envelope for all API responses."""

    data: T | None = Field(default=None, description="Response payload")
    meta: ResponseMeta | None = Field(default=None, description="Execution metadata")
    error: ResponseError | None = Field(
        default=None, description="Error details if unsuccessful"
    )
