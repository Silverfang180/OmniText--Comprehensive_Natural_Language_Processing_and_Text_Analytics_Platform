"""Integration and validation tests for model registry and benchmarking suite."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from omnitext.db.models.benchmark import BenchmarkResult, ModelRegistryEntry
from omnitext.db.models.job import Job
from omnitext.db.session import AsyncSessionLocal
from omnitext.main import app
from omnitext.services.analysis_service import AnalysisService
from omnitext.worker.main import BackgroundWorker


@pytest.mark.asyncio
async def test_benchmarking_and_registry_flow() -> None:
    """Verify registry seeding, queuing benchmark run, processing worker job, and promoting active model."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Verify Model Registry database is seeded during lifespan startup
        async with AsyncSessionLocal() as session:
            stmt = select(ModelRegistryEntry)
            res = await session.execute(stmt)
            entries = res.scalars().all()
            assert len(entries) > 0

            # Verify there is at least 1 active model for summarization task
            summ_stmt = select(ModelRegistryEntry).where(
                ModelRegistryEntry.task == "summarization",
                ModelRegistryEntry.is_active == True,
            )
            summ_res = await session.execute(summ_stmt)
            active_summ = summ_res.scalars().all()
            assert len(active_summ) == 1
            assert active_summ[0].model_id == "sshleifer/distilbart-cnn-6-6"

        # 2. Get Benchmarks List (Anonymous user has read access per PRD)
        get_res = await client.get("/api/v1/benchmarks")
        assert get_res.status_code == 200
        data = get_res.json()["data"]
        assert "registry" in data
        assert "results" in data
        assert len(data["registry"]) > 0

        # 3. Create User and Authenticate
        email = f"benchmark_user_{uuid.uuid4().hex[:6]}@example.com"
        reg_res = await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "password123"}
        )
        assert reg_res.status_code == 200

        login_res = await client.post(
            "/api/v1/auth/token",
            data={"username": email, "password": "password123"}
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 4. Trigger Benchmarks Run (Unauthenticated returns 401)
        anon_run = await client.post("/api/v1/benchmarks/run")
        assert anon_run.status_code == 401

        # Authenticated trigger
        run_res = await client.post("/api/v1/benchmarks/run", headers=headers)
        assert run_res.status_code == 200
        job_id = run_res.json()["data"]["job_id"]
        assert run_res.json()["data"]["status"] == "pending"

        # Verify job is enqueued in the DB
        async with AsyncSessionLocal() as session:
            job_stmt = select(Job).where(Job.id == job_id)
            job_res = await session.execute(job_stmt)
            job = job_res.scalar_one_or_none()
            assert job is not None
            assert job.type == "run_benchmark"

        # 5. Process Benchmark Job via worker (Simulated)
        worker = BackgroundWorker()
        await worker.process_next_job()

        # Check job completion and benchmark results persisted
        async with AsyncSessionLocal() as session:
            job_stmt = select(Job).where(Job.id == job_id)
            job_res = await session.execute(job_stmt)
            job = job_res.scalar_one_or_none()
            assert job.status == "completed"

            bench_stmt = select(BenchmarkResult)
            bench_res = await session.execute(bench_stmt)
            results = bench_res.scalars().all()
            assert len(results) > 0

        # Verify new results exist in list
        get_res_2 = await client.get("/api/v1/benchmarks")
        assert get_res_2.status_code == 200
        data_2 = get_res_2.json()["data"]
        assert len(data_2["results"]) > 0

        # 6. Promote Registry Model (Unauthenticated returns 401)
        anon_promote = await client.post(
            "/api/v1/benchmarks/promote",
            json={"task": "summarization", "model_id": "facebook/bart-large-cnn"},
        )
        assert anon_promote.status_code == 401

        # Authenticated promote call
        promote_res = await client.post(
            "/api/v1/benchmarks/promote",
            headers=headers,
            json={"task": "summarization", "model_id": "facebook/bart-large-cnn"},
        )
        assert promote_res.status_code == 200
        assert promote_res.json()["data"]["success"] is True

        # Verify database model entry is updated to active
        async with AsyncSessionLocal() as session:
            stmt = select(ModelRegistryEntry).where(
                ModelRegistryEntry.task == "summarization",
                ModelRegistryEntry.is_active == True,
            )
            res = await session.execute(stmt)
            active_models = res.scalars().all()
            assert len(active_models) == 1
            assert active_models[0].model_id == "facebook/bart-large-cnn"

        # Verify AnalysisService cache for summarization is cleared
        assert "summarization" not in AnalysisService._loaded_adapters
