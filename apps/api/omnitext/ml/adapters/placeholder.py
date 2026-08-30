"""Placeholder Task Adapter for Foundation Verification."""

import time

from omnitext.ml.adapters.base import ModelRef, TaskAdapter, TaskInput, TaskOutput


class PlaceholderAdapter(TaskAdapter):
    """Simple baseline implementation verifying TaskAdapter contract."""

    def __init__(self, task_name: str = "placeholder") -> None:
        self.task_name = task_name
        self.model_ref: ModelRef | None = None
        self._is_loaded: bool = False

    def load(self, model_ref: ModelRef) -> None:
        """Store model reference and mark adapter as ready."""
        self.model_ref = model_ref
        self._is_loaded = True

    def predict(self, input_data: TaskInput) -> TaskOutput:
        """Run placeholder prediction returning basic statistics."""
        start_time = time.perf_counter()
        model_id = self.model_ref.model_id if self.model_ref else "placeholder-v0"

        # Trivial deterministic computation for testing
        word_count = len(input_data.text.split())
        char_count = len(input_data.text)
        latency = (time.perf_counter() - start_time) * 1000.0

        return TaskOutput(
            result={
                "message": f"Processed {word_count} words ({char_count} characters)",
                "status": "ready",
            },
            latency_ms=round(latency, 2),
            model_id=model_id,
            metadata={"adapter": "PlaceholderAdapter", "task": self.task_name},
        )

    def batch_predict(self, inputs: list[TaskInput]) -> list[TaskOutput]:
        """Execute prediction sequentially over the batch."""
        return [self.predict(item) for item in inputs]
