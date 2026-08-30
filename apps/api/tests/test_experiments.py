"""Integration and security validation tests for fine-tuning Experiments."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from omnitext.db.models.benchmark import ModelRegistryEntry
from omnitext.db.models.experiment import Experiment
from omnitext.db.models.job import Job
from omnitext.db.session import AsyncSessionLocal
from omnitext.main import app
from omnitext.services.analysis_service import AnalysisService
from omnitext.worker.main import BackgroundWorker


@pytest.mark.asyncio
async def test_experiments_end_to_end_flow() -> None:
    """Verify experiments triggering, simulation run, validation, promotion, and security isolation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create two separate users for security isolation tests
        email_a = f"user_a_{uuid.uuid4().hex[:6]}@example.com"
        email_b = f"user_b_{uuid.uuid4().hex[:6]}@example.com"

        # Register User A
        reg_a = await client.post(
            "/api/v1/auth/register",
            json={"email": email_a, "password": "password123"}
        )
        assert reg_a.status_code == 200
        token_a = (
            await client.post(
                "/api/v1/auth/token",
                data={"username": email_a, "password": "password123"}
            )
        ).json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Register User B
        reg_b = await client.post(
            "/api/v1/auth/register",
            json={"email": email_b, "password": "password123"}
        )
        assert reg_b.status_code == 200
        token_b = (
            await client.post(
                "/api/v1/auth/token",
                data={"username": email_b, "password": "password123"}
            )
        ).json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 2. Trigger fine-tuning experiment (Unauthenticated gets 401)
        anon_res = await client.post("/api/v1/experiments", json={"name": "NER BERT Run"})
        assert anon_res.status_code == 401

        # Trigger for User A
        create_res = await client.post(
            "/api/v1/experiments",
            headers=headers_a,
            json={"name": "User A NER Experiment"}
        )
        assert create_res.status_code == 200
        exp_data = create_res.json()["data"]
        exp_id = exp_data["id"]
        assert exp_data["status"] == "pending"
        assert exp_data["name"] == "User A NER Experiment"

        # Check job enqueued
        async with AsyncSessionLocal() as session:
            job_stmt = select(Job).where(Job.type == "ner_finetune")
            job_res = await session.execute(job_stmt)
            jobs = job_res.scalars().all()
            assert len(jobs) > 0
            assert jobs[-1].payload["experiment_id"] == exp_id

        # 3. Run background worker simulation job
        worker = BackgroundWorker()
        await worker.process_next_job()

        # Check experiment results inside DB
        async with AsyncSessionLocal() as session:
            exp_stmt = select(Experiment).where(Experiment.id == exp_id)
            exp_res = await session.execute(exp_stmt)
            exp = exp_res.scalar_one_or_none()
            assert exp is not None
            assert exp.status == "completed"
            assert exp.fine_tuned_model_id is not None
            assert exp.baseline_metrics is not None
            assert exp.final_metrics is not None
            assert len(exp.metrics) == 3

        # 4. Fetch list and details
        # User A list
        list_res = await client.get("/api/v1/experiments", headers=headers_a)
        assert list_res.status_code == 200
        assert len(list_res.json()["data"]) == 1
        assert list_res.json()["data"][0]["id"] == exp_id

        # User B list (empty)
        list_res_b = await client.get("/api/v1/experiments", headers=headers_b)
        assert list_res_b.status_code == 200
        assert len(list_res_b.json()["data"]) == 0

        # User A detail
        det_res = await client.get(f"/api/v1/experiments/{exp_id}", headers=headers_a)
        assert det_res.status_code == 200
        assert det_res.json()["data"]["status"] == "completed"

        # 5. Security isolation checks: User B tries to read, promote, or reject User A's experiment
        # User B read -> 403
        det_res_b = await client.get(f"/api/v1/experiments/{exp_id}", headers=headers_b)
        assert det_res_b.status_code == 403

        # User B promote -> 403
        promo_res_b = await client.post(f"/api/v1/experiments/{exp_id}/promote", headers=headers_b)
        assert promo_res_b.status_code == 403

        # User B reject -> 403
        reject_res_b = await client.post(f"/api/v1/experiments/{exp_id}/reject", headers=headers_b)
        assert reject_res_b.status_code == 403

        # 6. User A promotes the model
        promote_res = await client.post(f"/api/v1/experiments/{exp_id}/promote", headers=headers_a)
        assert promote_res.status_code == 200
        assert promote_res.json()["data"]["success"] is True

        # Check registry update
        async with AsyncSessionLocal() as session:
            stmt = select(ModelRegistryEntry).where(
                ModelRegistryEntry.task == "ner",
                ModelRegistryEntry.is_active == True
            )
            res = await session.execute(stmt)
            active_model = res.scalar_one_or_none()
            assert active_model is not None
            assert active_model.model_id == f"custom-ner-fine-tuned-{exp_id}"
            assert active_model.is_fine_tuned is True

        # Check cache popped
        assert "ner" not in AnalysisService._loaded_adapters

        # 7. Create another experiment for User A and reject it
        create_res_2 = await client.post(
            "/api/v1/experiments",
            headers=headers_a,
            json={"name": "User A Experiment 2"}
        )
        exp_id_2 = create_res_2.json()["data"]["id"]

        # Run worker simulation for second experiment
        await worker.process_next_job()

        # Reject experiment
        reject_res = await client.post(f"/api/v1/experiments/{exp_id_2}/reject", headers=headers_a)
        assert reject_res.status_code == 200
        assert reject_res.json()["data"]["success"] is True

        async with AsyncSessionLocal() as session:
            exp_stmt = select(Experiment).where(Experiment.id == exp_id_2)
            exp_res = await session.execute(exp_stmt)
            exp_2 = exp_res.scalar_one_or_none()
            assert exp_2.status == "rejected"
