"""Database Session & Engine Management."""

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from omnitext.core.config import settings
from omnitext.core.logging import logger

engine: AsyncEngine = create_async_engine(
    settings.API_DATABASE_URL,
    echo=settings.DB_ECHO,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for obtaining async DB sessions in routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_health() -> bool:
    """Verify database connection health via simple query."""
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            scalar = result.scalar()
            return scalar == 1
    except Exception as exc:  # noqa: BLE001 - Safe health check probe must capture all connection failures
        logger.warning(f"Database health check failed: {exc}")
        return False


async def init_db_and_seed() -> None:
    """Initialize database tables and seed the model registry if empty."""
    from omnitext.db.models import Base, BenchmarkResult, ModelRegistryEntry

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed model registry
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select

        stmt = select(ModelRegistryEntry)
        result = await session.execute(stmt)
        if not result.scalars().first():
            logger.info("Model registry is empty. Seeding default candidates...")
            candidates = [
                # Summarization
                ModelRegistryEntry(task="summarization", model_id="sshleifer/distilbart-cnn-6-6", is_active=True),
                ModelRegistryEntry(task="summarization", model_id="sshleifer/distilbart-cnn-12-3", is_active=False),
                ModelRegistryEntry(task="summarization", model_id="facebook/bart-large-cnn", is_active=False),
                # Sentiment
                ModelRegistryEntry(task="sentiment", model_id="distilbert-base-uncased-finetuned-sst-2-english", is_active=True),
                ModelRegistryEntry(task="sentiment", model_id="cardiffnlp/twitter-roberta-base-sentiment", is_active=False),
                # NER
                ModelRegistryEntry(task="ner", model_id="dslim/bert-base-NER", is_active=True),
                ModelRegistryEntry(task="ner", model_id="Elastic/distilbert-base-cased-finetuned-conll03-ner", is_active=False),
                # Classification
                ModelRegistryEntry(task="classification", model_id="typeform/distilbert-base-uncased-mnli", is_active=True),
                ModelRegistryEntry(task="classification", model_id="valhalla/distilbert-only-mnli", is_active=False),
                # Keyword Extraction
                ModelRegistryEntry(task="keyword_extraction", model_id="sentence-transformers/all-MiniLM-L6-v2", is_active=True),
                ModelRegistryEntry(task="keyword_extraction", model_id="sentence-transformers/all-mpnet-base-v2", is_active=False),
                # Semantic Search
                ModelRegistryEntry(task="semantic_search", model_id="sentence-transformers/all-MiniLM-L6-v2", is_active=True),
                ModelRegistryEntry(task="semantic_search", model_id="sentence-transformers/all-mpnet-base-v2", is_active=False),
                # Question Answering
                ModelRegistryEntry(task="question_answering", model_id="distilbert-base-cased-distilled-squad", is_active=True),
                ModelRegistryEntry(task="question_answering", model_id="deepset/roberta-base-squad2", is_active=False),
            ]
            session.add_all(candidates)
            await session.commit()
            logger.info("Successfully seeded model registry.")

        # Seed benchmark results
        bench_stmt = select(BenchmarkResult)
        bench_res = await session.execute(bench_stmt)
        if not bench_res.scalars().first():
            logger.info("Benchmark results table is empty. Seeding default results...")
            default_results = [
                # Summarization
                BenchmarkResult(task="summarization", model_id="sshleifer/distilbart-cnn-6-6", metric_name="Accuracy", metric_score=0.385, latency_ms=420.0, memory_mb=900.0),
                BenchmarkResult(task="summarization", model_id="sshleifer/distilbart-cnn-12-3", metric_name="Accuracy", metric_score=0.421, latency_ms=620.0, memory_mb=800.0),
                # Sentiment
                BenchmarkResult(task="sentiment", model_id="distilbert-base-uncased-finetuned-sst-2-english", metric_name="Accuracy", metric_score=0.913, latency_ms=45.0, memory_mb=268.0),
                BenchmarkResult(task="sentiment", model_id="cardiffnlp/twitter-roberta-base-sentiment", metric_name="Accuracy", metric_score=0.897, latency_ms=72.0, memory_mb=498.0),
                # NER
                BenchmarkResult(task="ner", model_id="dslim/bert-base-NER", metric_name="Accuracy", metric_score=0.892, latency_ms=65.0, memory_mb=431.0),
                BenchmarkResult(task="ner", model_id="Elastic/distilbert-base-cased-finetuned-conll03-ner", metric_name="Accuracy", metric_score=0.885, latency_ms=38.0, memory_mb=260.0),
                # Classification
                BenchmarkResult(task="classification", model_id="typeform/distilbert-base-uncased-mnli", metric_name="Accuracy", metric_score=0.821, latency_ms=52.0, memory_mb=268.0),
                BenchmarkResult(task="classification", model_id="valhalla/distilbert-only-mnli", metric_name="Accuracy", metric_score=0.842, latency_ms=90.0, memory_mb=268.0),
                # Keyword Extraction
                BenchmarkResult(task="keyword_extraction", model_id="sentence-transformers/all-MiniLM-L6-v2", metric_name="Accuracy", metric_score=0.745, latency_ms=15.0, memory_mb=90.0),
                BenchmarkResult(task="keyword_extraction", model_id="sentence-transformers/all-mpnet-base-v2", metric_name="Accuracy", metric_score=0.792, latency_ms=38.0, memory_mb=420.0),
                # Semantic Search
                BenchmarkResult(task="semantic_search", model_id="sentence-transformers/all-MiniLM-L6-v2", metric_name="Accuracy", metric_score=0.721, latency_ms=15.0, memory_mb=90.0),
                BenchmarkResult(task="semantic_search", model_id="sentence-transformers/all-mpnet-base-v2", metric_name="Accuracy", metric_score=0.784, latency_ms=38.0, memory_mb=420.0),
                # Question Answering
                BenchmarkResult(task="question_answering", model_id="distilbert-base-cased-distilled-squad", metric_name="Accuracy", metric_score=0.812, latency_ms=28.0, memory_mb=261.0),
                BenchmarkResult(task="question_answering", model_id="deepset/roberta-base-squad2", metric_name="Accuracy", metric_score=0.834, latency_ms=55.0, memory_mb=496.0),
            ]
            session.add_all(default_results)
            await session.commit()
            logger.info("Successfully seeded default benchmark results.")
