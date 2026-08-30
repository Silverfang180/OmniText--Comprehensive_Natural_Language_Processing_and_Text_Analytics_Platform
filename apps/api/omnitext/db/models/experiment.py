from __future__ import annotations

"""SQLAlchemy database model for fine-tuning Experiments."""

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from omnitext.db.models.base import Base

if TYPE_CHECKING:
    from omnitext.db.models.user import User


class Experiment(Base):
    """Stores information about a user's fine-tuning experiments, metrics, and configurations."""

    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)
    task: Mapped[str] = mapped_column(String(50), nullable=False, default="ner")
    base_model_id: Mapped[str] = mapped_column(String(255), nullable=False)
    fine_tuned_model_id: Mapped[str] = mapped_column(String(255), nullable=True)
    hyperparameters: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    metrics: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    baseline_metrics: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=True)
    final_metrics: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="experiments")
