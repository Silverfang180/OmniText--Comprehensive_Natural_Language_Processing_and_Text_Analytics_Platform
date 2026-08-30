"""Unit and Integration Tests for Text Analyses Endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient

from omnitext.main import app
from omnitext.ml.adapters.base import ModelRef, TaskInput
from omnitext.ml.adapters.ner import NerAdapter
from omnitext.ml.adapters.sentiment import SentimentAdapter
from omnitext.ml.adapters.summarization import SummarizationAdapter
from omnitext.services.analysis_service import AnalysisService


def test_summarization_adapter_mocked() -> None:
    """Test summarization adapter uses mock pipeline correctly."""
    adapter = SummarizationAdapter()
    adapter.load(ModelRef(model_id="mock-model", version="main"))
    res = adapter.predict(TaskInput(text="This is a test document to summarize."))

    assert res.result["summary_text"] == "Mock summary content."
    assert res.result["word_count"] == 3
    assert res.model_id == "mock-model"
    assert res.metadata["max_length"] == 130


def test_sentiment_adapter_mocked() -> None:
    """Test sentiment adapter uses mock pipeline correctly."""
    adapter = SentimentAdapter()
    adapter.load(ModelRef(model_id="mock-model", version="main"))
    res = adapter.predict(TaskInput(text="Excellent product!"))

    assert res.result["label"] == "POSITIVE"
    assert res.result["score"] == 0.95
    assert res.model_id == "mock-model"


def test_ner_adapter_mocked() -> None:
    """Test NER adapter parses entity tags correctly."""
    adapter = NerAdapter()
    adapter.load(ModelRef(model_id="mock-model", version="main"))
    res = adapter.predict(TaskInput(text="Larry Page co-founded Google."))

    entities = res.result["entities"]
    assert len(entities) == 1
    assert entities[0]["entity"] == "Larry Page"
    assert entities[0]["label"] == "PER"
    assert entities[0]["start"] == 0
    assert entities[0]["end"] == 10
    assert entities[0]["confidence"] == 0.99


@pytest.mark.asyncio
async def test_analyses_endpoint_all_tasks() -> None:
    """Verify endpoint executes multiple tasks and wraps in standard envelope."""
    # Reset lazy-loaded cache to force load using mock pipeline
    AnalysisService._loaded_adapters.clear()

    payload = {
        "text": "Larry Page co-founded Google in 1998.",
        "tasks": ["summarization", "sentiment", "ner"],
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/analyses", json=payload)
        assert response.status_code == 200

        res_json = response.json()
        assert res_json["data"] is not None
        assert "summarization" in res_json["data"]
        assert "sentiment" in res_json["data"]
        assert "ner" in res_json["data"]
        assert res_json["error"] is None

        # Verify envelope structure
        meta = res_json["meta"]
        assert meta["latency_ms"] is not None
        assert "model_ids" in meta["extra"]
        assert "latencies_ms" in meta["extra"]
        assert (
            meta["extra"]["model_ids"]["summarization"]
            == "sshleifer/distilbart-cnn-6-6"
        )


@pytest.mark.asyncio
async def test_analyses_oversized_input_rejection() -> None:
    """Verify text exceeding MAX_CHARACTER_LIMIT is rejected with 400."""
    oversized_text = "a" * (AnalysisService.MAX_CHARACTER_LIMIT + 1)
    payload = {
        "text": oversized_text,
        "tasks": ["sentiment"],
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/analyses", json=payload)
        assert response.status_code == 400

        res_json = response.json()
        assert res_json["data"] is None
        assert res_json["error"] is not None
        assert res_json["error"]["code"] == "HTTP_400"
        assert "exceeds maximum length" in res_json["error"]["message"]


@pytest.mark.asyncio
async def test_analyses_unsupported_task_rejection() -> None:
    """Verify requesting an unsupported task returns 400 error."""
    payload = {
        "text": "Valid text length.",
        "tasks": ["invalid_task_name"],
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/analyses", json=payload)
        assert response.status_code == 400

        res_json = response.json()
        assert res_json["error"]["code"] == "HTTP_400"
        assert "is not supported" in res_json["error"]["message"]
