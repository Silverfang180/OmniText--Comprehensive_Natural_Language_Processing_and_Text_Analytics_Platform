"""Base Task Adapter Protocol and Schemas."""

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field


def _empty_dict() -> dict[str, Any]:
    """Helper factory for empty dictionaries in Pydantic fields."""
    return {}


class ModelRef(BaseModel):
    """Reference to a registered model checkpoint or repository."""

    model_id: str = Field(..., description="Unique model identifier")
    version: str = Field(..., description="Pinned version tag or commit hash")
    checkpoint_path: str | None = Field(
        default=None, description="Local or remote checkpoint URI"
    )
    parameters: dict[str, Any] | None = Field(
        default_factory=_empty_dict, description="Model hyperparameters"
    )


class TaskInput(BaseModel):
    """Base input container for task execution."""

    text: str = Field(..., description="Primary input text")
    context: str | None = Field(
        default=None, description="Optional document or passage context"
    )
    options: dict[str, Any] | None = Field(
        default_factory=_empty_dict, description="Task execution parameters"
    )


class TaskOutput(BaseModel):
    """Base output container from task execution."""

    result: Any = Field(..., description="Primary computed output")
    latency_ms: float = Field(..., description="Execution latency in milliseconds")
    model_id: str = Field(..., description="Model identifier used for inference")
    metadata: dict[str, Any] | None = Field(
        default_factory=_empty_dict, description="Additional task-specific signals"
    )


@runtime_checkable
class TaskAdapter(Protocol):
    """Protocol that all NLP task adapters must implement."""

    task_name: str

    def load(self, model_ref: ModelRef) -> None:
        """Load and initialize model weights into process memory."""
        ...

    def predict(self, input_data: TaskInput) -> TaskOutput:
        """Execute single-input synchronous inference."""
        ...

    def batch_predict(self, inputs: list[TaskInput]) -> list[TaskOutput]:
        """Execute batched inference over multiple inputs."""
        ...
