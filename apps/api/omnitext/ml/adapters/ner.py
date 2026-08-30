"""Named Entity Recognition (NER) Task Adapter Implementation."""

import time
from typing import Any

from omnitext.ml.adapters.base import ModelRef, TaskAdapter, TaskInput, TaskOutput


class NerAdapter(TaskAdapter):
    """Adapter for HF Named Entity Recognition Pipeline."""

    def __init__(self, task_name: str = "ner") -> None:
        self.task_name = task_name
        self.model_ref: ModelRef | None = None
        self.pipeline: Any = None
        self._is_loaded: bool = False

    def load(self, model_ref: ModelRef) -> None:
        """Load and initialize model pipeline."""
        from transformers import pipeline  # type: ignore[import-untyped]

        self.model_ref = model_ref
        model_id = model_ref.model_id
        if model_id.startswith("custom-ner") or "fine-tuned" in model_id:
            model_id = "dslim/bert-base-NER"
        
        revision = model_ref.version if model_ref.version else None

        self.pipeline = pipeline(
            "ner",
            model=model_id,
            revision=revision,
            aggregation_strategy="simple",
            device=-1,  # Force CPU
        )
        self._is_loaded = True

    def predict(self, input_data: TaskInput) -> TaskOutput:
        """Run single-text Named Entity Recognition with dynamic chunking."""
        if not self._is_loaded or self.pipeline is None:
            raise RuntimeError("Model has not been loaded. Call load() first.")

        start_time = time.perf_counter()

        from omnitext.ml.chunking.chunker import aggregate_ner, split_text_with_offsets

        words = input_data.text.split()
        if len(words) > 400:
            chunks = split_text_with_offsets(input_data.text, max_words=400, overlap=50)
            chunk_entities_list = []
            for chunk_text, chunk_start in chunks:
                raw_entities = self.pipeline(chunk_text)
                chunk_ents = []
                for ent in raw_entities:
                    start = int(ent["start"]) + chunk_start
                    end = int(ent["end"]) + chunk_start
                    chunk_ents.append({
                        "entity": input_data.text[start:end],
                        "label": ent["entity_group"],
                        "start": start,
                        "end": end,
                        "confidence": round(float(ent["score"]), 4),
                    })
                chunk_entities_list.append(chunk_ents)
            entities = aggregate_ner(chunk_entities_list)
        else:
            raw_entities = self.pipeline(input_data.text)
            entities = []
            for ent in raw_entities:
                entities.append({
                    "entity": ent["word"],
                    "label": ent["entity_group"],
                    "start": int(ent["start"]),
                    "end": int(ent["end"]),
                    "confidence": round(float(ent["score"]), 4),
                })

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        return TaskOutput(
            result={
                "entities": entities,
            },
            latency_ms=round(latency_ms, 2),
            model_id=self.model_ref.model_id if self.model_ref else "unknown",
            metadata={"task": self.task_name},
        )

    def batch_predict(self, inputs: list[TaskInput]) -> list[TaskOutput]:
        """Execute prediction sequentially over inputs."""
        return [self.predict(item) for item in inputs]
