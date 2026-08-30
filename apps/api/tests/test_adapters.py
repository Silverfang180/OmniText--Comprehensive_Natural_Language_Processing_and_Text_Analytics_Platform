"""Unit Tests for TaskAdapter Protocol and Placeholder Implementation."""

from omnitext.ml.adapters.base import ModelRef, TaskAdapter, TaskInput
from omnitext.ml.adapters.placeholder import PlaceholderAdapter


def test_task_adapter_protocol_compliance() -> None:
    """Verify PlaceholderAdapter complies with TaskAdapter protocol."""
    adapter = PlaceholderAdapter(task_name="test_task")
    assert isinstance(adapter, TaskAdapter)
    assert adapter.task_name == "test_task"


def test_placeholder_adapter_lifecycle_and_prediction() -> None:
    """Verify load, predict, and batch_predict behavior."""
    adapter = PlaceholderAdapter(task_name="summarization")
    model_ref = ModelRef(
        model_id="test-model-v1",
        version="1.0.0",
        checkpoint_path="test/path",
    )
    adapter.load(model_ref)

    assert adapter._is_loaded is True
    assert adapter.model_ref is not None
    assert adapter.model_ref.model_id == "test-model-v1"

    # Single prediction
    single_input = TaskInput(text="OmniText provides practical NLP capabilities.")
    output = adapter.predict(single_input)

    assert output.model_id == "test-model-v1"
    assert output.latency_ms >= 0
    assert "Processed 5 words" in output.result["message"]
    assert output.metadata is not None
    assert output.metadata["task"] == "summarization"

    # Batch prediction
    batch_inputs = [
        TaskInput(text="First document for testing."),
        TaskInput(text="Second document for testing."),
    ]
    batch_outputs = adapter.batch_predict(batch_inputs)
    assert len(batch_outputs) == 2
    assert batch_outputs[0].model_id == "test-model-v1"
    assert batch_outputs[1].model_id == "test-model-v1"


from omnitext.ml.adapters.classification import ClassificationAdapter
from omnitext.ml.adapters.keyword_extraction import KeywordExtractionAdapter


def test_classification_adapter_mocked() -> None:
    """Verify ClassificationAdapter load and prediction lifecycle."""
    adapter = ClassificationAdapter()
    adapter.load(ModelRef(model_id="mock-model", version="main"))
    assert adapter._is_loaded is True

    res = adapter.predict(TaskInput(text="FastAPI runs python fast."))
    assert "predictions" in res.result
    predictions = res.result["predictions"]
    assert len(predictions) > 0
    assert predictions[0]["label"] == "technology"
    assert predictions[0]["score"] == 0.8


def test_keyword_extraction_adapter_mocked() -> None:
    """Verify KeywordExtractionAdapter load and KeyBERT prediction lifecycle."""
    adapter = KeywordExtractionAdapter()
    adapter.load(ModelRef(model_id="mock-model", version="main"))
    assert adapter._is_loaded is True

    res = adapter.predict(TaskInput(text="Hugging Face models run locally on CPU."))
    assert "keywords" in res.result
    keywords = res.result["keywords"]
    assert len(keywords) > 0
    assert "keyword" in keywords[0]
    assert "score" in keywords[0]
