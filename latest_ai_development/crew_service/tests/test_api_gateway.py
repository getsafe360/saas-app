from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient

from crew_service.api import main


class StubCrewService:
    def __init__(self, model: str):
        self.model = model

    def run_task(self, task_key: str, url: str):
        if task_key == "site_snapshot":
            return {
                "task": task_key,
                "url": url,
                "model": self.model,
                "result": (
                    '{"module":"site_snapshot","platform":"generic","categories":{'
                    '"accessibility":[{"id":"a1","title":"a"}],'
                    '"performance":[{"id":"p1","title":"p"}],'
                    '"seo_360":[{"id":"s1","title":"s"}],'
                    '"security":[{"id":"x1","title":"x"}],'
                    '"content":[{"id":"c1","title":"c"}]}}'
                ),
                "usage_metrics": {},
            }
        if task_key == "wordpress_snapshot":
            return {
                "task": task_key,
                "url": url,
                "model": self.model,
                "result": '{"module":"wordpress_snapshot","wordpress_findings":[{"id":"w1","title":"plugin outdated"}]}',
                "usage_metrics": {},
            }
        if task_key == "generate_sparky_summary":
            return {
                "task": task_key,
                "url": url,
                "model": self.model,
                "result": "Hi Alex! Friendly summary.",
                "usage_metrics": {},
            }
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

    response = client.post("/api/analyze", json={"site_id": "s1", "url": "https://wp.example.com/blog"})
    assert response.status_code == 200
    body = response.json()
    assert body["platform"] == "wordpress"
    assert body["task"] == "audit_wordpress"


def test_analyze_generic_route(monkeypatch):
    _set_env(monkeypatch)
    monkeypatch.setattr(main, "CrewService", StubCrewService)
    client = TestClient(main.app)

    response = client.post("/api/analyze", json={"site_id": "s1", "url": "https://other-site.com"})
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
        json={"site_id": "s1", "url": "https://other-site.com", "platform": "wordpress"},
    )
    assert response.status_code == 422
    assert "Invalid site configuration" in response.json()["detail"]


def test_homepage_analysis_emits_summary_and_completed(monkeypatch):
    _set_env(monkeypatch)
    monkeypatch.setattr(main, "CrewService", StubCrewService)

    async def _run() -> list[dict]:
        queue = await main.event_bus.subscribe_to_site_events("t-1")
        payload = main.TestStartRequest(url="https://example.com", name="Alex", language="en", session_id="s-1")
        await main._run_test_analysis("t-1", payload)

        events = []
        while not queue.empty():
            events.append(await queue.get())
        await main.event_bus.unsubscribe(queue)
        return events

    events = asyncio.run(_run())
    assert any(e.get("type") == "summary" for e in events)
    assert any(e.get("type") == "status" and e.get("state") == "completed" for e in events)

    category_events = [e for e in events if e.get("type") == "category"]
    categories = [e.get("category") for e in category_events]
    assert categories.count("accessibility") == 1
    assert categories.count("performance") == 1
    assert categories.count("seo_360") == 1
    assert categories.count("security") == 1
    assert categories.count("content") == 1
