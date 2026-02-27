from __future__ import annotations

from types import SimpleNamespace

from latest_ai_development.crew import CrewService


def test_kickoff_returns_non_empty_result(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("CREWAI_API_KEY", "test-key")
    service = CrewService(model="openai/gpt-4o-mini")

    def fake_kickoff(self, inputs):
        return SimpleNamespace(tasks_output=['{"module":"seo","summary":"ok"}'])

    monkeypatch.setattr("latest_ai_development.crew.Crew.kickoff", fake_kickoff)

    result = service.run_task("analyze_seo", "https://example.com")

    assert result["task"] == "analyze_seo"
    assert result["url"] == "https://example.com"
    assert isinstance(result["result"], str)
    assert result["result"].strip() != ""
