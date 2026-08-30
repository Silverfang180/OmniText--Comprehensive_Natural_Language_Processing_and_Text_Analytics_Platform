"""Integration and data isolation tests for Datasets, Documents, Background Worker, and Semantic Search."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from omnitext.db.models.document import Document, DocumentChunk
from omnitext.db.models.job import Job
from omnitext.db.session import AsyncSessionLocal
from omnitext.main import app
from omnitext.worker.main import BackgroundWorker


@pytest.mark.asyncio
async def test_dataset_documents_and_search_flow() -> None:
    """Verify entire workflow: Create dataset, upload files, ingest via worker, search, and verify user isolation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register and Login User A
        email_a = f"user_a_{uuid.uuid4().hex[:6]}@example.com"
        reg_a = await client.post(
            "/api/v1/auth/register",
            json={"email": email_a, "password": "password123"}
        )
        assert reg_a.status_code == 200
        
        login_a = await client.post(
            "/api/v1/auth/token",
            data={"username": email_a, "password": "password123"}
        )
        assert login_a.status_code == 200
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 2. Register and Login User B (for isolation checks)
        email_b = f"user_b_{uuid.uuid4().hex[:6]}@example.com"
        reg_b = await client.post(
            "/api/v1/auth/register",
            json={"email": email_b, "password": "password123"}
        )
        assert reg_b.status_code == 200
        
        login_b = await client.post(
            "/api/v1/auth/token",
            data={"username": email_b, "password": "password123"}
        )
        assert login_b.status_code == 200
        token_b = login_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 3. Create Dataset (User A)
        create_ds = await client.post(
            "/api/v1/documents/datasets",
            headers=headers_a,
            json={"name": "User A Corpus"}
        )
        assert create_ds.status_code == 200
        ds_a_id = create_ds.json()["data"]["id"]

        # 4. List Datasets (User A and User B)
        list_ds_a = await client.get("/api/v1/documents/datasets", headers=headers_a)
        assert list_ds_a.status_code == 200
        assert len(list_ds_a.json()["data"]) == 1
        assert list_ds_a.json()["data"][0]["name"] == "User A Corpus"

        list_ds_b = await client.get("/api/v1/documents/datasets", headers=headers_b)
        assert list_ds_b.status_code == 200
        assert len(list_ds_b.json()["data"]) == 0

        # 5. Ownership Isolation: User B trying to view/delete/upload to User A's dataset returns 404
        bad_view = await client.get(f"/api/v1/documents/datasets/{ds_a_id}", headers=headers_b)
        assert bad_view.status_code == 404

        bad_delete = await client.delete(f"/api/v1/documents/datasets/{ds_a_id}", headers=headers_b)
        assert bad_delete.status_code == 404

        bad_upload = await client.post(
            f"/api/v1/documents/datasets/{ds_a_id}/upload",
            headers=headers_b,
            files={"file": ("test.txt", b"Forbidden upload text content.", "text/plain")}
        )
        assert bad_upload.status_code == 404

        # 6. Upload document (User A)
        # Test validation bounds: file size too large (> 25MB)
        large_bytes = b"x" * (25 * 1024 * 1024 + 1)
        large_upload = await client.post(
            f"/api/v1/documents/datasets/{ds_a_id}/upload",
            headers=headers_a,
            files={"file": ("large.txt", large_bytes, "text/plain")}
        )
        assert large_upload.status_code == 400
        assert "exceeds maximum allowed size" in large_upload.json()["error"]["message"]

        # Test validation bounds: unsupported extension/content-type
        bad_ext_upload = await client.post(
            f"/api/v1/documents/datasets/{ds_a_id}/upload",
            headers=headers_a,
            files={"file": ("malicious.exe", b"binary content", "application/octet-stream")}
        )
        assert bad_ext_upload.status_code == 400
        assert "Unsupported file extension" in bad_ext_upload.json()["error"]["message"]

        # Success Upload (User A)
        doc_content = b"OmniText is an NLP monolith. It features summarization, sentiment analysis, NER, classification, and keyphrase extraction. It also supports semantic search over ingested corpora."
        upload_res = await client.post(
            f"/api/v1/documents/datasets/{ds_a_id}/upload",
            headers=headers_a,
            files={"file": ("handbook.txt", doc_content, "text/plain")}
        )
        assert upload_res.status_code == 200
        doc_a_id = upload_res.json()["data"]["id"]
        assert upload_res.json()["data"]["status"] == "pending"

        # Verify job is enqueued in the DB
        async with AsyncSessionLocal() as session:
            job_query = select(Job).where(Job.type == "document_ingestion")
            job_res = await session.execute(job_query)
            job = job_res.scalars().first()
            assert job is not None
            assert job.status == "pending"
            assert job.payload["document_id"] == doc_a_id

        # 7. Execute Background Worker Job (Simulated)
        worker = BackgroundWorker()
        await worker.process_next_job()

        # Check job completion status and chunks created
        async with AsyncSessionLocal() as session:
            # Check Document updated status
            doc_query = select(Document).where(Document.id == doc_a_id)
            doc_res = await session.execute(doc_query)
            document = doc_res.scalars().first()
            assert document is not None
            assert document.status == "completed"

            # Check DocumentChunks created
            chunks_query = select(DocumentChunk).where(DocumentChunk.document_id == doc_a_id)
            chunks_res = await session.execute(chunks_query)
            chunks = chunks_res.scalars().all()
            assert len(chunks) > 0
            assert chunks[0].text == doc_content.decode()

        # 8. Query Semantic Search (User A)
        search_res = await client.post(
            "/api/v1/search",
            headers=headers_a,
            json={
                "dataset_id": ds_a_id,
                "query": "What are the core features of OmniText?",
                "limit": 3
            }
        )
        assert search_res.status_code == 200
        data = search_res.json()["data"]
        assert len(data) == 1
        assert data[0]["filename"] == "handbook.txt"
        assert "monolith" in data[0]["text"]
        assert data[0]["score"] > 0.0  # Cosine similarity score returned

        # 9. Search Isolation: User B trying to search User A's dataset returns 404
        bad_search = await client.post(
            "/api/v1/search",
            headers=headers_b,
            json={
                "dataset_id": ds_a_id,
                "query": "Core features",
                "limit": 3
            }
        )
        assert bad_search.status_code == 404

        # 10. Delete Document (User A)
        del_doc = await client.delete(
            f"/api/v1/documents/datasets/{ds_a_id}/documents/{doc_a_id}",
            headers=headers_a
        )
        assert del_doc.status_code == 200
        assert del_doc.json()["data"]["success"] is True

        # Verify Document and chunks are cascade deleted
        async with AsyncSessionLocal() as session:
            doc_query = select(Document).where(Document.id == doc_a_id)
            doc_res = await session.execute(doc_query)
            assert doc_res.scalars().first() is None

            chunks_query = select(DocumentChunk).where(DocumentChunk.document_id == doc_a_id)
            chunks_res = await session.execute(chunks_query)
            assert len(chunks_res.scalars().all()) == 0
