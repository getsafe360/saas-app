from __future__ import annotations

from fastapi.testclient import TestClient

from crew_service.api import main


class StubCrewService:
    def __init__(self, model: str):
        self.model = model

    def run_task(self, task_key: str, url: str):
        return {"task": task_key, "url": url, "model": self.model, "result": "ok", "usage_metrics": {}}


def _set_env(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.setenv("CREWAI_API_KEY", "test")
    monkeypatch.setenv("WORDPRESS_SITE_URL", "https://wp.example.com")
    monkeypatch.setenv("NEXT_PUBLIC_API_URL", "https://api.example.com")


def test_health(monkeypatch):
    _set_env(monkeypatch)
    client = TestClient(main.app)

    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_analyze_wordpress_auto_route(monkeypatch):
    _set_env(monkeypatch)
    monkeypatch.setattr(main, "CrewService", StubCrewService)
    client = TestClient(main.app)

    response = client.post("/api/analyze", json={"url": "https://wp.example.com/blog"})
    assert response.status_code == 200
    body = response.json()
    assert body["platform"] == "wordpress"
    assert body["task"] == "audit_wordpress"


def test_analyze_generic_route(monkeypatch):
    _set_env(monkeypatch)
    monkeypatch.setattr(main, "CrewService", StubCrewService)
    client = TestClient(main.app)

    response = client.post("/api/analyze", json={"url": "https://other-site.com"})
    assert response.status_code == 200
    body = response.json()
    assert body["platform"] == "generic"
    assert body["task"] == "analyze_seo"


def test_wordpress_override_requires_matching_domain(monkeypatch):
    _set_env(monkeypatch)
    monkeypatch.setattr(main, "CrewService", StubCrewService)
    client = TestClient(main.app)

    response = client.post(
        "/api/analyze",
        json={"url": "https://other-site.com", "platform": "wordpress"},
    )
    assert response.status_code == 422
    assert "Invalid site configuration" in response.json()["detail"]
