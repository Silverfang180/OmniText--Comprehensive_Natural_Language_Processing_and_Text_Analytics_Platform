"""Integration and security isolation tests for Extractive Question Answering."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from omnitext.main import app
from omnitext.ml.adapters.base import TaskInput
from omnitext.services.analysis_service import AnalysisService
from omnitext.worker.main import BackgroundWorker


@pytest.mark.asyncio
async def test_qa_adapter_lifecycle_and_prediction() -> None:
    """Verify that the QaAdapter loads and predicts correct extractive answers."""
    adapter = await AnalysisService.get_adapter("question_answering")
    assert adapter is not None
    assert adapter._is_loaded is True

    question = "Who founded Google?"
    context = "Google was founded in September 1998 by Larry Page and Sergey Brin."
    task_input = TaskInput(text=question, context=context)

    output = adapter.predict(task_input)
    assert output.result is not None
    assert "Larry Page" in output.result["answer"] or "Sergey Brin" in output.result["answer"]
    assert output.result["score"] >= 0.0
    assert output.result["start"] >= 0
    assert output.result["end"] > 0


@pytest.mark.asyncio
async def test_extractive_qa_api_flow() -> None:
    """Verify direct passage QA, context length validations, search-based QA, and resource isolation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Direct QA (Anonymous / Ungated access)
        direct_res = await client.post(
            "/api/v1/search/qa",
            json={
                "question": "What is the capital of France?",
                "context": "Paris is the capital and most populous city of France.",
            }
        )
        assert direct_res.status_code == 200
        data = direct_res.json()["data"]
        assert "Paris" in data["answer"]
        assert data["score"] > 0.0
        assert "Paris is the capital" in data["source_passage"]

        # 2. Context word count validation (> 400 words rejection)
        long_context = "word " * 401
        validation_res = await client.post(
            "/api/v1/search/qa",
            json={
                "question": "Does it reject?",
                "context": long_context,
            }
        )
        assert validation_res.status_code == 400
        assert "Context is too long" in validation_res.json()["error"]["message"]

        # 3. Direct QA request parameter validation (missing either context or dataset)
        missing_res = await client.post(
            "/api/v1/search/qa",
            json={
                "question": "What is missing?",
            }
        )
        assert missing_res.status_code == 400
        assert "Either 'context' or 'dataset_id'" in missing_res.json()["error"]["message"]

        # 4. Auth setup for User A and User B
        # Register/Login User A
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

        # Register/Login User B
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

        # 5. Create Dataset & Upload Document (User A)
        create_ds = await client.post(
            "/api/v1/documents/datasets",
            headers=headers_a,
            json={"name": "User A Physics Dataset"}
        )
        assert create_ds.status_code == 200
        ds_a_id = create_ds.json()["data"]["id"]

        doc_content = b"Albert Einstein developed the theory of relativity, one of the two pillars of modern physics (alongside quantum mechanics). He was born in Germany."
        upload_res = await client.post(
            f"/api/v1/documents/datasets/{ds_a_id}/upload",
            headers=headers_a,
            files={"file": ("physics.txt", doc_content, "text/plain")}
        )
        assert upload_res.status_code == 200
        _doc_a_id = upload_res.json()["data"]["id"]

        # Run background worker to parse, chunk, and embed
        worker = BackgroundWorker()
        await worker.process_next_job()

        # 6. Execute Dataset-based Search QA (User A)
        search_qa_res = await client.post(
            "/api/v1/search/qa",
            headers=headers_a,
            json={
                "question": "What theory did Albert Einstein develop?",
                "dataset_id": ds_a_id,
            }
        )
        assert search_qa_res.status_code == 200
        qa_data = search_qa_res.json()["data"]
        assert "relativity" in qa_data["answer"].lower()
        assert qa_data["document_title"] == "physics.txt"
        assert qa_data["match_score"] > 0.0
        assert "Albert Einstein developed" in qa_data["source_passage"]

        # 7. Unauthenticated User trying to run dataset QA returns 401
        anon_ds_qa = await client.post(
            "/api/v1/search/qa",
            json={
                "question": "What theory did Albert Einstein develop?",
                "dataset_id": ds_a_id,
            }
        )
        assert anon_ds_qa.status_code == 401

        # 8. Security Isolation: User B trying to run search QA on User A's dataset returns 404
        bad_ds_qa = await client.post(
            "/api/v1/search/qa",
            headers=headers_b,
            json={
                "question": "What theory did Albert Einstein develop?",
                "dataset_id": ds_a_id,
            }
        )
        assert bad_ds_qa.status_code == 404
