"""Text Classification Task Adapter Implementation."""

import time
from typing import Any

from omnitext.ml.adapters.base import ModelRef, TaskAdapter, TaskInput, TaskOutput


class ClassificationAdapter(TaskAdapter):
    """Adapter for HF Zero-Shot Classification Pipeline."""

    def __init__(self, task_name: str = "classification") -> None:
        self.task_name = task_name
        self.model_ref: ModelRef | None = None
        self.pipeline: Any = None
        self._is_loaded: bool = False

    def load(self, model_ref: ModelRef) -> None:
        """Load and initialize model pipeline."""
        from transformers import pipeline

        self.model_ref = model_ref
        model_id = model_ref.model_id
        revision = model_ref.version if model_ref.version else None

        self.pipeline = pipeline(
            "zero-shot-classification",
            model=model_id,
            revision=revision,
            device=-1,  # Force CPU
        )
        self._is_loaded = True

    def predict(self, input_data: TaskInput) -> TaskOutput:
        """Run text classification (zero-shot with candidate labels) with dynamic chunking."""
        if not self._is_loaded or self.pipeline is None:
            raise RuntimeError("Model has not been loaded. Call load() first.")

        start_time = time.perf_counter()

        options = input_data.options or {}
        # Support zero-shot candidate labels, default to standard classification topics
        candidate_labels = options.get(
            "candidate_labels",
            ["technology", "business", "sports", "entertainment", "science", "politics"],
        )

        from omnitext.ml.chunking.chunker import (
            aggregate_classification,
            split_text_with_offsets,
        )

        words = input_data.text.split()
        if len(words) > 400:
            chunks = split_text_with_offsets(input_data.text, max_words=400, overlap=0)
            predictions_list = []
            for chunk_text, _ in chunks:
                outputs = self.pipeline(chunk_text, candidate_labels=candidate_labels, truncation=True, max_length=512)
                labels = outputs["labels"]
                scores = outputs["scores"]
                chunk_preds = [
                    {"label": label, "score": float(score)}
                    for label, score in zip(labels, scores)
                ]
                predictions_list.append(chunk_preds)
            predictions = aggregate_classification(predictions_list)
        else:
            outputs = self.pipeline(input_data.text, candidate_labels=candidate_labels, truncation=True, max_length=512)
            labels = outputs["labels"]
            scores = outputs["scores"]
            predictions = [
                {"label": label, "score": round(float(score), 4)}
                for label, score in zip(labels, scores)
            ]

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return TaskOutput(
            result={
                "predictions": predictions,
            },
            latency_ms=round(latency_ms, 2),
            model_id=self.model_ref.model_id if self.model_ref else "unknown",
            metadata={
                "task": self.task_name,
                "candidate_labels": candidate_labels,
            },
        )

    def batch_predict(self, inputs: list[TaskInput]) -> list[TaskOutput]:
        """Execute prediction sequentially over inputs."""
        return [self.predict(item) for item in inputs]
