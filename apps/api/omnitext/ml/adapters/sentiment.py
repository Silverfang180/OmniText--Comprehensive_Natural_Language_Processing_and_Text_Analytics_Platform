"""Sentiment Analysis Task Adapter Implementation."""

import time
from typing import Any

from omnitext.ml.adapters.base import ModelRef, TaskAdapter, TaskInput, TaskOutput


class SentimentAdapter(TaskAdapter):
    """Adapter for HF Sentiment Analysis Pipeline."""

    def __init__(self, task_name: str = "sentiment") -> None:
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
            "sentiment-analysis",
            model=model_id,
            revision=revision,
            device=-1,  # Force CPU
        )
        self._is_loaded = True

    def predict(self, input_data: TaskInput) -> TaskOutput:
        """Run single-text sentiment analysis with dynamic chunking."""
        if not self._is_loaded or self.pipeline is None:
            raise RuntimeError("Model has not been loaded. Call load() first.")

        start_time = time.perf_counter()

        from omnitext.ml.chunking.chunker import (
            aggregate_sentiment,
            split_text_with_offsets,
        )

        words = input_data.text.split()
        if len(words) > 400:
            chunks = split_text_with_offsets(input_data.text, max_words=400, overlap=0)
            predictions = []
            for chunk_text, _ in chunks:
                outputs = self.pipeline(chunk_text, truncation=True, max_length=512)
                predictions.append({
                    "label": outputs[0]["label"],
                    "score": float(outputs[0]["score"]),
                })
            result = aggregate_sentiment(predictions)
        else:
            outputs = self.pipeline(input_data.text, truncation=True, max_length=512)
            result = {
                "label": outputs[0]["label"],
                "score": round(float(outputs[0]["score"]), 4),
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
