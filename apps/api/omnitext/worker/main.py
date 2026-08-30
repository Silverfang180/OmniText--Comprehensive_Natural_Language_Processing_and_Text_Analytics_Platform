"""OmniText Background Worker Process."""

import os
import sys

os.environ["USE_TORCH"] = "1"
os.environ["USE_TF"] = "0"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import asyncio
import csv
import signal
import sys
from io import BytesIO, StringIO
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from omnitext.core.config import settings
from omnitext.core.logging import logger, setup_logging
from omnitext.db.models.document import Document, DocumentChunk
from omnitext.db.models.job import Job
from omnitext.db.session import AsyncSessionLocal
from omnitext.ml.chunking.chunker import split_text_with_offsets
from omnitext.ml.embeddings.encoder import encoder
from omnitext.storage.object_store import object_store


def extract_text(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Extract text content from file bytes based on type."""
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext == "txt" or "text/plain" in content_type:
        return file_bytes.decode("utf-8", errors="ignore")

    elif ext == "csv" or "csv" in content_type:
        text_stream = StringIO(file_bytes.decode("utf-8", errors="ignore"))
        reader = csv.reader(text_stream)
        rows = []
        for row in reader:
            rows.append(" ".join(row))
        return "\n".join(rows)

    elif ext == "pdf" or "pdf" in content_type:
        try:
            from pypdf import PdfReader
            pdf_reader: Any = PdfReader(BytesIO(file_bytes))
            text = ""
            for page in pdf_reader.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
            return text
        except ImportError:
            logger.error("pypdf is not installed; unable to parse PDF")
            raise ValueError("PDF parsing library (pypdf) is missing")

    elif ext == "docx" or "wordprocessingml" in content_type:
        try:
            import docx
            doc: Any = docx.Document(BytesIO(file_bytes))
            return "\n".join([p.text for p in doc.paragraphs])
        except ImportError:
            logger.error("python-docx is not installed; unable to parse DOCX")
            raise ValueError("DOCX parsing library (python-docx) is missing")

    else:
        raise ValueError(f"Unsupported file type: {ext} ({content_type})")


class BackgroundWorker:
    """Worker process for executing asynchronous database-queued jobs."""

    def __init__(self) -> None:
        self.is_running: bool = False
        self.poll_interval: float = settings.WORKER_POLL_INTERVAL_SECONDS

    async def start(self) -> None:
        """Start worker loop and register shutdown handlers."""
        setup_logging(debug=settings.API_DEBUG)

        # Initialize database tables and seed registry
        from omnitext.db.session import init_db_and_seed
        await init_db_and_seed()

        self.is_running = True
        logger.info(
            "OmniText Background Worker started successfully",
            extra={"poll_interval_s": self.poll_interval},
        )

        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, self.stop)
            except NotImplementedError:
                # Windows event loop may not support add_signal_handler
                pass

        try:
            while self.is_running:
                await self.process_next_job()
                await asyncio.sleep(self.poll_interval)
        except asyncio.CancelledError:
            logger.info("Worker cancelled; shutting down.")
        finally:
            logger.info("OmniText Background Worker stopped.")

    def stop(self, *args: Any) -> None:
        """Signal worker to stop processing new jobs."""
        logger.info("Shutdown signal received. Stopping worker...")
        self.is_running = False

    async def process_next_job(self) -> None:
        """Poll and execute pending jobs from the queue."""
        async with AsyncSessionLocal() as session:
            try:
                # Query next pending job
                query = (
                    select(Job)
                    .where(Job.status == "pending")
                    .order_by(Job.created_at.asc())
                    .limit(1)
                )
                result = await session.execute(query)
                job = result.scalars().first()

                if not job:
                    return

                # Lock and update status to processing
                job.status = "processing"
                await session.commit()
                await session.refresh(job)

                logger.info(f"Processing job {job.id} of type: {job.type}")

                # Execute job
                try:
                    if job.type == "document_ingestion":
                        job_result = await self.handle_document_ingestion(job, session)
                    elif job.type == "run_benchmark":
                        job_result = await self.handle_run_benchmark(job, session)
                    elif job.type == "ner_finetune":
                        job_result = await self.handle_ner_finetune(job, session)
                    else:
                        raise ValueError(f"Unknown job type: {job.type}")

                    job.status = "completed"
                    job.result = job_result
                    logger.info(f"Job {job.id} completed successfully")

                except Exception as e:  # noqa: BLE001
                    logger.exception(f"Job {job.id} failed with error: {e}")
                    job.status = "failed"
                    job.result = {"error": str(e)}

                await session.commit()

            except Exception as e:  # noqa: BLE001
                logger.error(f"Error checking/processing background jobs: {e}")
                await session.rollback()

    async def handle_document_ingestion(self, job: Job, session: AsyncSession) -> dict[str, Any]:
        """Perform document ingestion: text extraction, chunking, and embedding generation."""
        doc_id = job.payload.get("document_id")
        if not doc_id:
            raise ValueError("Missing document_id in job payload")

        # Load Document metadata
        query = select(Document).where(Document.id == doc_id)
        result = await session.execute(query)
        document = result.scalars().first()
        if not document:
            raise ValueError(f"Document with ID {doc_id} not found in database")

        document.status = "processing"
        await session.commit()

        # Download raw file from object storage
        file_stream = object_store.get_object(document.storage_path)
        file_bytes = file_stream.read()
        file_stream.close()

        # Extract text content
        text_content = extract_text(file_bytes, document.filename, document.content_type)
        if not text_content.strip():
            raise ValueError("Document is empty or text could not be extracted")

        # Chunk text content
        # Set max_words to 200 and overlap to 30 for optimal embedding granularity
        chunks = split_text_with_offsets(text_content, max_words=200, overlap=30)
        chunk_texts = [c[0] for c in chunks]

        # Generate embeddings in batch
        embeddings = encoder.encode(chunk_texts)

        # Save document chunks
        for idx, (chunk_text, _) in enumerate(chunks):
            db_chunk = DocumentChunk(
                document_id=document.id,
                dataset_id=document.dataset_id,
                chunk_index=idx,
                text=chunk_text,
                embedding=embeddings[idx],
            )
            session.add(db_chunk)

        document.status = "completed"
        await session.commit()

        return {
            "chunks_count": len(chunks),
            "characters_count": len(text_content),
        }

    async def handle_run_benchmark(self, job: Job, session: AsyncSession) -> dict[str, Any]:
        """Execute benchmarking suite over all candidate models and tasks."""
        from omnitext.ml.benchmark import runner
        await runner.run_all_benchmarks(session)
        return {"success": True, "message": "Benchmarking completed and active registry updated."}

    async def handle_ner_finetune(self, job: Job, session: AsyncSession) -> dict[str, Any]:
        """Execute NER fine-tuning training simulation pipeline."""
        experiment_id = job.payload.get("experiment_id")
        if not experiment_id:
            raise ValueError("Missing experiment_id in job payload")

        from omnitext.ml.training import ner_finetune
        await ner_finetune.run_ner_finetune_simulation(session, experiment_id)
        return {"success": True, "message": "NER fine-tuning simulation completed."}


def main() -> None:
    """CLI entrypoint for background worker."""
    worker = BackgroundWorker()
    try:
        asyncio.run(worker.start())
    except KeyboardInterrupt:
        logger.info("Worker stopped by keyboard interrupt.")
        sys.exit(0)


if __name__ == "__main__":
    main()
