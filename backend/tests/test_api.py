import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["database"] == "connected"


def test_seed_and_query_flow():
    # 1. Seed sample documents
    seed_resp = client.post("/api/seed-samples")
    assert seed_resp.status_code == 200
    assert seed_resp.json()["status"] == "success"

    # 2. Query documents list
    docs_resp = client.get("/api/documents")
    assert docs_resp.status_code == 200
    docs = docs_resp.json()
    assert len(docs) >= 1

    # 3. Ask factual query
    query_resp = client.post("/api/query", json={
        "query": "How many days of paid Annual Leave do employees get?",
        "domain_filter": "All"
    })
    assert query_resp.status_code == 200
    res_data = query_resp.json()
    assert "generated_answer" in res_data
    assert res_data["confidence_score"] >= 0.40
    assert not res_data["is_knowledge_gap"]
    assert "24" in res_data["generated_answer"] or len(res_data["citations"]) > 0

    # 4. Ask ambiguous query
    amb_resp = client.post("/api/query", json={
        "query": "help",
        "domain_filter": "All"
    })
    assert amb_resp.status_code == 200
    assert amb_resp.json()["is_ambiguous"] is True

    # 5. Check analytics endpoint
    analytics_resp = client.get("/api/analytics")
    assert analytics_resp.status_code == 200
    analytics_data = analytics_resp.json()
    assert analytics_data["total_queries"] >= 2
