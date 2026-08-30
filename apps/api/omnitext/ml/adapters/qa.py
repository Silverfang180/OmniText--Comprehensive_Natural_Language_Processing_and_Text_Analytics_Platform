"""Question Answering Task Adapter Implementation."""

import time
from typing import Any

from omnitext.ml.adapters.base import ModelRef, TaskAdapter, TaskInput, TaskOutput


class QaAdapter(TaskAdapter):
    """Adapter for HF Question Answering Pipeline."""

    def __init__(self, task_name: str = "question_answering") -> None:
        self.task_name = task_name
        self.model_ref: ModelRef | None = None
        self.pipeline: Any = None
        self._is_loaded: bool = False

    def load(self, model_ref: ModelRef) -> None:
        """Load and initialize model pipeline."""
        from transformers import pipeline  # type: ignore[import-untyped]

        self.model_ref = model_ref
        model_id = model_ref.model_id
        revision = model_ref.version if model_ref.version else None

        self.pipeline = pipeline(
            "question-answering",
            model=model_id,
            revision=revision,
            device=-1,  # Force CPU
            truncation=True,  # Prevent overflow crashes globally
        )
        self._is_loaded = True

    def predict(self, input_data: TaskInput) -> TaskOutput:
        """Run extractive question answering on the input query and context passage."""
        if not self._is_loaded or self.pipeline is None:
            raise RuntimeError("Model has not been loaded. Call load() first.")

        start_time = time.perf_counter()

        context = input_data.context
        if not context or not context.strip():
            raise ValueError("Context cannot be empty for question answering.")

        outputs = self.pipeline(
            question=input_data.text,
            context=context,
        )

        result = {
            "answer": str(outputs.get("answer", "")),
            "score": round(float(outputs.get("score", 0.0)), 4),
            "start": int(outputs.get("start", 0)),
            "end": int(outputs.get("end", 0)),
        }

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return TaskOutput(
            result=result,
            latency_ms=round(latency_ms, 2),
            model_id=self.model_ref.model_id if self.model_ref else "unknown",
            metadata={"task": self.task_name},
        )

    def batch_predict(self, inputs: list[TaskInput]) -> list[TaskOutput]:
        """Execute prediction sequentially over inputs."""
        return [self.predict(item) for item in inputs]
