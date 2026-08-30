"""Service layer for Extractive Question Answering operations."""

from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.core.logging import logger
from omnitext.ml.adapters.base import TaskInput
from omnitext.services import search_service
from omnitext.services.analysis_service import AnalysisService


async def qa_direct(question: str, context: str) -> dict[str, Any]:
    """Execute extractive QA against a directly provided context passage (ungated)."""
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if not context.strip():
        raise HTTPException(status_code=400, detail="Context cannot be empty.")

    # Prevent silent truncation: validate context is under 400 words
    word_count = len(context.split())
    if word_count > 400:
        raise HTTPException(
            status_code=400,
            detail="Context is too long for direct Question Answering (maximum 400 words). "
            "Please upload the document to a dataset to run search-based QA.",
        )

    logger.info("Executing direct passage QA", extra={"input_words": word_count})

    adapter = await AnalysisService.get_adapter("question_answering")
    task_input = TaskInput(text=question, context=context)
    output = adapter.predict(task_input)

    return {
        "answer": output.result["answer"],
        "score": output.result["score"],
        "start": output.result["start"],
        "end": output.result["end"],
        "source_passage": context,
    }


async def qa_search(
    db: AsyncSession,
    user_id: int,
    question: str,
    dataset_id: int,
    document_id: int | None = None,
) -> dict[str, Any]:
    """Search for the most relevant context chunk in the dataset, and execute QA over it."""
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Retrieve top 1 relevant chunk using semantic search
    search_results = await search_service.semantic_search(
        db=db,
        user_id=user_id,
        dataset_id=dataset_id,
        query_text=question,
        limit=1,
        document_id=document_id,
    )

    if not search_results:
        raise HTTPException(
            status_code=404,
            detail="No relevant passages found in the document/dataset to answer the question.",
        )

    top_chunk = search_results[0]
    context = top_chunk["text"]

    logger.info(
        "Executing search-integrated QA",
        extra={
            "dataset_id": dataset_id,
            "document_id": document_id,
            "doc_filename": top_chunk["filename"],
            "match_score": top_chunk["score"],
        },
    )

    adapter = await AnalysisService.get_adapter("question_answering", db=db)
    task_input = TaskInput(text=question, context=context)
    output = adapter.predict(task_input)

    return {
        "answer": output.result["answer"],
        "score": output.result["score"],
        "start": output.result["start"],
        "end": output.result["end"],
        "source_passage": context,
        "document_title": top_chunk["filename"],
        "match_score": top_chunk["score"],
    }
