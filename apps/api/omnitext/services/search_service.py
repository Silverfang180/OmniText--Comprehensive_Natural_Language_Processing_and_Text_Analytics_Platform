"""Service layer for semantic search operations."""

import math
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.core.logging import logger
from omnitext.db.models.document import Document, DocumentChunk
from omnitext.ml.embeddings.encoder import encoder
from omnitext.services.document_service import get_dataset_or_404


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot_product = sum(x * y for x, y in zip(v1, v2))
    norm_v1 = math.sqrt(sum(x * x for x in v1))
    norm_v2 = math.sqrt(sum(x * x for x in v2))
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)


async def semantic_search(
    db: AsyncSession,
    user_id: int,
    dataset_id: int,
    query_text: str,
    limit: int = 5,
    document_id: int | None = None,
) -> list[dict[str, Any]]:
    """Generate embedding for search query and execute vector retrieval on the dataset/document."""
    # Enforce ownership check
    await get_dataset_or_404(db, user_id, dataset_id)

    if not query_text.strip():
        return []

    # Generate query embedding
    query_embeddings = encoder.encode([query_text])
    if not query_embeddings:
        return []
    query_embedding = query_embeddings[0]

    dialect_name = db.bind.dialect.name if db.bind else "sqlite"

    results: list[dict[str, Any]] = []

    if dialect_name == "postgresql":
        logger.info(
            "Executing Postgres pgvector search query",
            extra={"user_id": user_id, "dataset_id": dataset_id, "limit": limit, "document_id": document_id},
        )
        dist_col = DocumentChunk.embedding.op("<=>")(query_embedding)
        stmt = (
            select(DocumentChunk, Document.filename, (1.0 - dist_col).label("score"))
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(DocumentChunk.dataset_id == dataset_id)
        )
        if document_id is not None:
            stmt = stmt.where(DocumentChunk.document_id == document_id)
        stmt = stmt.order_by(dist_col).limit(limit)
        db_res = await db.execute(stmt)
        for chunk, filename, score in db_res.all():
            results.append(
                {
                    "text": chunk.text,
                    "score": round(max(0.01, float(score)), 4),
                    "filename": filename,
                    "chunk_index": chunk.chunk_index,
                }
            )
    else:
        # SQLite / In-memory fallback (for local development and testing)
        logger.info(
            "Executing SQLite Python fallback search query",
            extra={"user_id": user_id, "dataset_id": dataset_id, "limit": limit, "document_id": document_id},
        )
        stmt = (
            select(DocumentChunk, Document.filename)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(DocumentChunk.dataset_id == dataset_id)
        )
        if document_id is not None:
            stmt = stmt.where(DocumentChunk.document_id == document_id)
        db_res = await db.execute(stmt)
        all_chunks = db_res.all()

        scored_chunks = []
        for chunk, filename in all_chunks:
            # SafeVector fallback uses a list of float or JSON decoded list
            emb = chunk.embedding
            if isinstance(emb, str):
                import json
                emb = json.loads(emb)
            raw_sim = cosine_similarity(query_embedding, emb)
            score = (raw_sim + 1.0) / 2.0
            scored_chunks.append((chunk, filename, score))

        # Sort descending by similarity score
        scored_chunks.sort(key=lambda x: x[2], reverse=True)

        for chunk, filename, score in scored_chunks[:limit]:
            results.append(
                {
                    "text": chunk.text,
                    "score": round(max(0.01, float(score)), 4),
                    "filename": filename,
                    "chunk_index": chunk.chunk_index,
                }
            )

    return results
