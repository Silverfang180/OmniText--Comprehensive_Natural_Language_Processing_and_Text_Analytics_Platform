"""SQLAlchemy database models for Model Registry and Benchmark Results."""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from omnitext.db.models.base import Base


class ModelRegistryEntry(Base):
    """Stores candidate models for each NLP task and which model is currently active."""

    __tablename__ = "model_registry_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    task: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False, default="main")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_fine_tuned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class BenchmarkResult(Base):
    """Stores performance and accuracy scores of candidate models from evaluation runs."""

    __tablename__ = "benchmark_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    task: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    metric_name: Mapped[str] = mapped_column(String(50), nullable=False)
    metric_score: Mapped[float] = mapped_column(Float, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    memory_mb: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
