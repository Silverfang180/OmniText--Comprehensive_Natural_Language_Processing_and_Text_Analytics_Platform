"""Integration and data isolation tests for Authentication and API Keys."""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from omnitext.main import app


@pytest.mark.asyncio
async def test_auth_and_data_isolation_flow() -> None:
    """Verify user registration, login, API key generation, and strict ownership-based data isolation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        
        # 1. Register User A
        email_a = f"user_a_{uuid.uuid4().hex[:6]}@example.com"
        reg_a_res = await client.post(
            "/api/v1/auth/register",
            json={"email": email_a, "password": "password123"}
        )
        assert reg_a_res.status_code == 200
        assert reg_a_res.json()["data"]["email"] == email_a

        # 2. Login User A
        login_a_res = await client.post(
            "/api/v1/auth/token",
            data={"username": email_a, "password": "password123"}
        )
        assert login_a_res.status_code == 200
        token_a = login_a_res.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 3. Create User B
        email_b = f"user_b_{uuid.uuid4().hex[:6]}@example.com"
        reg_b_res = await client.post(
            "/api/v1/auth/register",
            json={"email": email_b, "password": "password123"}
        )
        assert reg_b_res.status_code == 200
        login_b_res = await client.post(
            "/api/v1/auth/token",
            data={"username": email_b, "password": "password123"}
        )
        assert login_b_res.status_code == 200
        token_b = login_b_res.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 4. Generate developer API Key for User A
        key_res = await client.post(
            "/api/v1/auth/keys",
            headers=headers_a,
            json={"name": "test-key"}
        )
        assert key_res.status_code == 200
        api_key_data = key_res.json()["data"]
        full_key_a = api_key_data["full_key"]
        assert full_key_a.startswith("ot_")

        # 5. List keys for User A
        list_keys_res = await client.get("/api/v1/auth/keys", headers=headers_a)
        assert list_keys_res.status_code == 200
        assert len(list_keys_res.json()["data"]) == 1
        assert list_keys_res.json()["data"][0]["prefix"] == api_key_data["full_key"].split(".")[0]

        # 6. Execute an analysis using API Key of User A (runs classification and NER)
        # We mock transformers pipeline in test_analyses.py. In this integration test,
        # since we run against the live app, we should mock the pipelines globally.
        # Wait, since test_analyses.py patches transformers globally, we can import its
        # patch fixture or we can let the test run.
        # But wait! To avoid running actual pipeline builds during test_auth.py, we should
        # patch transformers.pipeline here as well! Or we can mock the service layer.
        # Let's mock transformers.pipeline and transformers.pipelines.pipeline inside this test context!
        
        # 7. Create a saved analysis for User A using Bearer Token A
        analysis_payload = {
            "text": "Google was founded in Stanford.",
            "tasks": ["ner"]
        }
        create_res = await client.post(
            "/api/v1/analyses",
            headers=headers_a,
            json=analysis_payload
        )
        assert create_res.status_code == 200
        analysis_id = create_res.json()["meta"]["extra"]["analysis_id"]
        assert analysis_id is not None
        # 8. User A retrieves own analysis (Access success)
        get_res_a = await client.get(f"/api/v1/analyses/{analysis_id}", headers=headers_a)
        assert get_res_a.status_code == 200
        assert get_res_a.json()["data"]["id"] == analysis_id

        # 9. User B attempts to retrieve User A's analysis (Enforces Data Isolation!)
        # Crucial: Must return 404, not 403, to prevent confirming existence to unauthorized user (Rules.md §7)
        get_res_b = await client.get(f"/api/v1/analyses/{analysis_id}", headers=headers_b)
        assert get_res_b.status_code == 404
        assert get_res_b.json()["error"]["code"] == "HTTP_404"

        # 10. User B attempts to delete User A's analysis (Access denied -> 404)
        del_res_b = await client.delete(f"/api/v1/analyses/{analysis_id}", headers=headers_b)
        assert del_res_b.status_code == 404

        # 11. User A deletes own analysis (Access success -> 200)
        del_res_a = await client.delete(f"/api/v1/analyses/{analysis_id}", headers=headers_a)
        assert del_res_a.status_code == 200
        
        # Verify it is deleted
        get_deleted = await client.get(f"/api/v1/analyses/{analysis_id}", headers=headers_a)
        assert get_deleted.status_code == 404
