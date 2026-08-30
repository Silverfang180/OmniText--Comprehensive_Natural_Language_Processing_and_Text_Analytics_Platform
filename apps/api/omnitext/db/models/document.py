"""SQLAlchemy database models for Datasets, Documents, and Document Chunks."""

import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from omnitext.db.models.base import Base

if TYPE_CHECKING:
    from omnitext.db.models.user import User

try:
    from pgvector.sqlalchemy import Vector as PGVector  # type: ignore
    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False


class SafeVector(TypeDecorator[list[float]]):
    """SQLAlchemy TypeDecorator that falls back to JSON when pgvector is unavailable (e.g. SQLite in tests)."""
    impl = JSON
    cache_ok = True

    def __init__(self, dim: int) -> None:
        self.dim = dim
        super().__init__()

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql" and HAS_PGVECTOR:
            return dialect.type_descriptor(PGVector(self.dim))
        return dialect.type_descriptor(JSON)

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if dialect.name == "postgresql" and HAS_PGVECTOR:
            return value
        return json.dumps(value) if isinstance(value, (list, tuple)) else value

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if dialect.name == "postgresql" and HAS_PGVECTOR:
            return value
        if isinstance(value, str):
            return json.loads(value)
        return value


class Dataset(Base):
    """SQLAlchemy model representing a collection of ingested documents."""

    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="datasets")
    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="dataset", cascade="all, delete-orphan"
    )


class Document(Base):
    """SQLAlchemy model representing an uploaded document file."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # pending, processing, completed, failed
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    dataset: Mapped[Dataset] = relationship(Dataset, back_populates="documents")
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    """SQLAlchemy model representing a split chunk of text with its vector embedding representation."""

    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dataset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(SafeVector(384), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    document: Mapped[Document] = relationship(Document, back_populates="chunks")


# Import late to avoid circular imports during relation mapping
from omnitext.db.models.user import User
