"""Global pytest configurations and autouse fixtures for mocking ML pipelines and the database."""

import sys
from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

# 1. Create a mock for sentence_transformers to avoid importing it and crashing due to Keras 3 on the host machine.
mock_st_class = MagicMock()
mock_st_model = MagicMock()

def dummy_encode(sentences: list[str], **kwargs: Any) -> np.ndarray:
    num = len(sentences)
    embeddings = np.random.randn(num, 384)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    return embeddings / norms

mock_st_model.encode.side_effect = dummy_encode
mock_st_class.return_value = mock_st_model

mock_sentence_transformers = MagicMock()
mock_sentence_transformers.SentenceTransformer = mock_st_class
sys.modules["sentence_transformers"] = mock_sentence_transformers


# 2. Override the database connection globally to use an in-memory SQLite database with StaticPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=True,
    future=True,
)
test_session_local = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Patch the db session module globally before FastAPI app is initialized
import omnitext.db.session

omnitext.db.session.engine = test_engine
omnitext.db.session.AsyncSessionLocal = test_session_local


# Mock pipelines
mock_summary_pipeline = MagicMock(return_value=[{"summary_text": "Mock summary content."}])
mock_sentiment_pipeline = MagicMock(return_value=[{"label": "POSITIVE", "score": 0.95}])
mock_ner_pipeline = MagicMock(
    return_value=[
        {
            "word": "Larry Page",
            "entity_group": "PER",
            "start": 0,
            "end": 10,
            "score": 0.99,
        }
    ]
)
mock_classification_pipeline = MagicMock(
    return_value={
        "labels": ["technology", "business", "sports", "entertainment", "science", "politics"],
        "scores": [0.8, 0.1, 0.05, 0.03, 0.01, 0.01],
    }
)
mock_qa_pipeline = MagicMock(
    return_value={
        "answer": "Paris",
        "score": 0.99,
        "start": 0,
        "end": 5,
    }
)


def mock_pipeline_factory(task_name: str, *args: Any, **kwargs: Any) -> MagicMock:
    """Mock factory returning task-specific mock pipelines."""
    if task_name == "summarization":
        return mock_summary_pipeline
    if task_name == "sentiment-analysis":
        return mock_sentiment_pipeline
    if task_name == "ner":
        return mock_ner_pipeline
    if task_name == "zero-shot-classification":
        return mock_classification_pipeline
    if task_name == "question-answering":
        return mock_qa_pipeline
    raise ValueError(f"Unsupported pipeline: {task_name}")


@pytest.fixture(autouse=True)
async def init_test_db():
    """Initialize test database tables and seeds before running each test."""
    # Import all models to register them on Base
    from omnitext.db.models import Base
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    from omnitext.db.session import init_db_and_seed
    await init_db_and_seed()
    
    yield
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
def patch_transformers_pipeline():
    """Patch transformers pipeline globally in tests to avoid downloading models."""
    with (
        patch("transformers.pipeline", side_effect=mock_pipeline_factory) as mock_p1,
        patch("transformers.pipelines.pipeline", side_effect=mock_pipeline_factory) as mock_p2,
    ):
        yield (mock_p1, mock_p2)
