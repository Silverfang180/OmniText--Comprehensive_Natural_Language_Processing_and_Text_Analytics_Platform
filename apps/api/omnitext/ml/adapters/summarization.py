"""Summarization Task Adapter Implementation."""

import time
from typing import Any

from omnitext.ml.adapters.base import ModelRef, TaskAdapter, TaskInput, TaskOutput


class SummarizationAdapter(TaskAdapter):
    """Adapter for HF Summarization Pipeline."""

    def __init__(self, task_name: str = "summarization") -> None:
        self.task_name = task_name
        self.model_ref: ModelRef | None = None
        self.pipeline: Any = None
        self._is_loaded: bool = False

    def load(self, model_ref: ModelRef) -> None:
        """Load and initialize model pipeline."""
        from transformers import pipeline  # type: ignore[import-untyped]

        self.model_ref = model_ref
        model_id = model_ref.model_id
        # Use pinned revision / tag if provided in parameter config, fallback to default
        revision = model_ref.version if model_ref.version else None

        try:
            self.pipeline = pipeline(
                "summarization",
                model=model_id,
                revision=revision,
                device=-1,  # Force CPU
            )
        except Exception:
            try:
                self.pipeline = pipeline(
                    "text2text-generation",
                    model=model_id,
                    revision=revision,
                    device=-1,
                )
            except Exception:
                self.pipeline = pipeline(
                    model=model_id,
                    revision=revision,
                    device=-1,
                )
        self._is_loaded = True

    def predict(self, input_data: TaskInput) -> TaskOutput:
        """Run single-text summarization with dynamic chunking."""
        if not self._is_loaded or self.pipeline is None:
            raise RuntimeError("Model has not been loaded. Call load() first.")

        start_time = time.perf_counter()

        options = input_data.options or {}
        max_length = options.get("max_length", 130)
        min_length = options.get("min_length", 30)

        # Chunking integration: split text if it exceeds 800 words
        from omnitext.ml.chunking.chunker import (
            aggregate_summaries,
            split_text_with_offsets,
        )

        words = input_data.text.split()
        if len(words) > 800:
            chunks = split_text_with_offsets(input_data.text, max_words=800, overlap=0)
            summaries = []
            for chunk_text, _ in chunks:
                outputs = self.pipeline(
                    chunk_text,
                    max_length=max_length,
                    min_length=min_length,
                    do_sample=False,
                    truncation=True,
                )
                text = outputs[0].get("summary_text") or outputs[0].get("generated_text", "")
                summaries.append(text)
            summary_text = aggregate_summaries(summaries)
        else:
            outputs = self.pipeline(
                input_data.text,
                max_length=max_length,
                min_length=min_length,
                do_sample=False,
                truncation=True,
            )
            summary_text = outputs[0].get("summary_text") or outputs[0].get("generated_text", "")


        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return TaskOutput(
            result={
                "summary_text": summary_text,
                "word_count": len(summary_text.split()),
            },
            latency_ms=round(latency_ms, 2),
            model_id=self.model_ref.model_id if self.model_ref else "unknown",
            metadata={
                "task": self.task_name,
                "max_length": max_length,
                "min_length": min_length,
            },
        )

    def batch_predict(self, inputs: list[TaskInput]) -> list[TaskOutput]:
        """Execute prediction sequentially over inputs."""
        return [self.predict(item) for item in inputs]
