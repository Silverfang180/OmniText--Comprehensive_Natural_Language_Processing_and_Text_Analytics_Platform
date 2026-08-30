"""Analysis Service Layer for orchestrating NLP tasks."""

import time
from typing import Any, ClassVar

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.core.logging import logger
from omnitext.ml.adapters.base import ModelRef, TaskAdapter, TaskInput
from omnitext.ml.adapters.classification import ClassificationAdapter
from omnitext.ml.adapters.keyword_extraction import KeywordExtractionAdapter
from omnitext.ml.adapters.ner import NerAdapter
from omnitext.ml.adapters.qa import QaAdapter
from omnitext.ml.adapters.sentiment import SentimentAdapter
from omnitext.ml.adapters.summarization import SummarizationAdapter


class AnalysisService:
    """Service layer orchestrating the lazy-loading and execution of task adapters."""

    # Thread-safe in-memory cache for instantiated and loaded task adapters
    _loaded_adapters: ClassVar[dict[str, TaskAdapter]] = {}

    # Define interim default models (pending Phase 6 benchmarking)
    INTERIM_DEFAULTS: ClassVar[dict[str, dict[str, str]]] = {
        "summarization": {
            "model_id": "sshleifer/distilbart-cnn-6-6",
            "version": "main",
        },
        "sentiment": {
            "model_id": "distilbert-base-uncased-finetuned-sst-2-english",
            "version": "main",
        },
        "ner": {
            "model_id": "dslim/bert-base-NER",
            "version": "main",
        },
        "classification": {
            "model_id": "typeform/distilbert-base-uncased-mnli",
            "version": "main",
        },
        "keyword_extraction": {
            "model_id": "sentence-transformers/all-MiniLM-L6-v2",
            "version": "main",
        },
        "question_answering": {
            "model_id": "distilbert-base-cased-distilled-squad",
            "version": "main",
        },
    }

    MAX_CHARACTER_LIMIT = 10000

    @classmethod
    async def _fetch_active_model(cls, db: AsyncSession, task_name: str) -> dict[str, str] | None:
        """Fetch active model config from DB."""
        from sqlalchemy import select

        from omnitext.db.models import ModelRegistryEntry
        try:
            stmt = select(ModelRegistryEntry).where(
                ModelRegistryEntry.task == task_name,
                ModelRegistryEntry.is_active == True,
            )
            res = await db.execute(stmt)
            entry = res.scalar_one_or_none()
            if entry:
                return {"model_id": entry.model_id, "version": entry.version}
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"Failed to query model registry for task '{task_name}': {exc}")
        return None

    @classmethod
    async def get_adapter(cls, task_name: str, db: AsyncSession | None = None) -> TaskAdapter:
        """Instantiate, load, and cache the requested task adapter."""
        if task_name not in cls._loaded_adapters:
            logger.info(f"Lazy-loading adapter for task: {task_name}")

            adapter: TaskAdapter
            if task_name == "summarization":
                adapter = SummarizationAdapter()
            elif task_name == "sentiment":
                adapter = SentimentAdapter()
            elif task_name == "ner":
                adapter = NerAdapter()
            elif task_name == "classification":
                adapter = ClassificationAdapter()
            elif task_name == "keyword_extraction":
                adapter = KeywordExtractionAdapter()
            elif task_name == "question_answering":
                adapter = QaAdapter()
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Task '{task_name}' is not supported or not implemented in this phase.",
                )

            # Try to fetch active model from registry
            model_info = None
            if db:
                model_info = await cls._fetch_active_model(db, task_name)
            else:
                from omnitext.db.session import AsyncSessionLocal
                async with AsyncSessionLocal() as session:
                    model_info = await cls._fetch_active_model(session, task_name)

            if not model_info:
                # Retrieve default interim model info as fallback
                model_info = cls.INTERIM_DEFAULTS.get(task_name)
                if not model_info:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Configuration for task '{task_name}' is missing.",
                    )

            model_ref = ModelRef(
                model_id=model_info["model_id"],
                version=model_info["version"],
            )

            # Load model weights
            adapter.load(model_ref)
            cls._loaded_adapters[task_name] = adapter
            logger.info(f"Successfully loaded and cached adapter for task: {task_name}")

        return cls._loaded_adapters[task_name]

    @classmethod
    async def analyze_text(
        cls, text: str, tasks: list[str], options: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Validate input length, run selected tasks sequentially, and aggregate results."""
        if not text.strip():
            raise HTTPException(status_code=400, detail="Input text cannot be empty.")

        if len(text) > cls.MAX_CHARACTER_LIMIT:
            raise HTTPException(
                status_code=400,
                detail=f"Input text exceeds maximum length of {cls.MAX_CHARACTER_LIMIT} characters.",
            )

        run_options = options or {}
        results: dict[str, Any] = {}
        model_ids: dict[str, str] = {}
        latencies: dict[str, float] = {}

        total_start = time.perf_counter()

        for task in tasks:
            task_clean = task.strip().lower()
            try:
                adapter = await cls.get_adapter(task_clean)

                # Forward task options if provided
                task_options = run_options.get(task_clean) or {}
                task_input = TaskInput(text=text, options=task_options)

                # Execute inference
                output = adapter.predict(task_input)

                results[task_clean] = output.result
                model_ids[task_clean] = output.model_id
                latencies[task_clean] = output.latency_ms

                # Log structured inference metadata per Rules.md §9
                logger.info(
                    f"Task {task_clean} executed successfully",
                    extra={
                        "task": task_clean,
                        "model_id": output.model_id,
                        "latency_ms": output.latency_ms,
                        "input_size": len(text),
                        "outcome": "success",
                    },
                )
            except HTTPException:
                raise
            except Exception as exc:
                logger.error(
                    f"Error running task '{task_clean}': {exc}",
                    exc_info=True,
                    extra={
                        "task": task_clean,
                        "input_size": len(text),
                        "outcome": "failure",
                    },
                )
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to execute task '{task_clean}': {exc!s}",
                ) from exc

        total_latency = (time.perf_counter() - total_start) * 1000.0

        return {
            "results": results,
            "meta": {
                "model_ids": model_ids,
                "latencies_ms": latencies,
                "total_latency_ms": round(total_latency, 2),
            },
        }
