import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


class _ImmediateThread:
    def __init__(self, target=None, args=(), kwargs=None, daemon=None):
        self._target = target
        self._args = args
        self._kwargs = kwargs or {}

    def start(self):
        if self._target is not None:
            self._target(*self._args, **self._kwargs)


class _FakeCrewService:
    def __init__(self, model=None):
        self.model = model

    def run_sparky_pipeline(self, url: str):
        return {
            "greeting": "Hi from test",
            "short_summary": "Analysis complete",
            "summary": "Analysis complete",
            "categories": [{"id": "seo", "issues": []}],
        }


def load_app_module():
    module_name = "testable_crewai_app"
    app_path = Path(__file__).resolve().parents[1] / "app.py"

    fake_crew_module = types.ModuleType("crew")
    fake_crew_module.CrewService = _FakeCrewService
    sys.modules["crew"] = fake_crew_module

    spec = importlib.util.spec_from_file_location(module_name, app_path)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None and spec.loader is not None
    spec.loader.exec_module(module)
    return module


class TestSSEContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app_module = load_app_module()
        cls.client = cls.app_module.app.test_client()

    def setUp(self):
        with self.app_module.JOBS_LOCK:
            self.app_module.JOBS.clear()

    def _start_job(self):
        def run_worker_immediately(test_id: str, _url: str):
            self.app_module.emit_event(test_id, "status", state="in_progress", message="started")
            self.app_module.emit_event(test_id, "progress", progress=10, message="Fetching HTML")
            self.app_module.emit_event(test_id, "progress", progress=30, message="Analyzing accessibility")
            self.app_module.emit_event(
                test_id,
                "summary",
                summary="Analysis complete",
                short_summary="Analysis complete",
                message="Analysis complete",
                greeting="Hi from test",
                categories=[{"id": "seo", "issues": []}],
            )
            self.app_module.emit_event(test_id, "status", state="completed", message="done")

        with patch.object(self.app_module, "_run_sparky_worker", side_effect=run_worker_immediately), patch.object(
            self.app_module.threading,
            "Thread",
            _ImmediateThread,
        ):
            response = self.client.post("/api/test/start", json={"url": "https://example.com"})
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIsNotNone(payload)
        return payload["test_id"]

    def test_start_to_events_contract_order(self):
        test_id = self._start_job()

        response = self.client.get(f"/api/test/events/{test_id}", buffered=True)
        body = response.get_data(as_text=True)

        status_in_progress_idx = body.find('event: status\ndata: {"type": "status", "state": "in_progress"')
        progress_idx = body.find('event: progress\ndata: {"type": "progress"')
        summary_idx = body.find('event: summary\ndata: {"type": "summary"')
        status_completed_idx = body.rfind('event: status\ndata: {"type": "status", "state": "completed"')

        self.assertGreaterEqual(status_in_progress_idx, 0)
        self.assertGreaterEqual(progress_idx, 0)
        self.assertGreater(summary_idx, progress_idx)
        self.assertGreater(status_completed_idx, summary_idx)
        self.assertIn('"message": "Analysis complete"', body)

    def test_late_subscriber_gets_history_then_stream_closes(self):
        test_id = self._start_job()

        response = self.client.get(f"/api/test/events/{test_id}", buffered=True)
        body = response.get_data(as_text=True)

        self.assertIn('"state": "completed"', body)
        self.assertNotIn(': keepalive', body)

        with self.app_module.JOBS_LOCK:
            history = list(self.app_module.JOBS[test_id].events)
        self.assertTrue(history)
        self.assertTrue(self.app_module.is_terminal_event(history[-1]))

    def test_results_endpoint_ready_only_after_completion(self):
        created = self.client.post("/api/test/start", json={"url": "https://example.com"})
        self.assertEqual(created.status_code, 200)
        created_payload = created.get_json()
        assert created_payload is not None
        test_id = created_payload["test_id"]

        pending_job = self.app_module.TestJob(id=test_id, url="https://example.com", status="in_progress")
        with self.app_module.JOBS_LOCK:
            self.app_module.JOBS[test_id] = pending_job

        not_ready = self.client.get(f"/api/test/results/{test_id}")
        self.assertEqual(not_ready.status_code, 404)

        with self.app_module.JOBS_LOCK:
            self.app_module.JOBS[test_id].status = "completed"
            self.app_module.JOBS[test_id].result = {
                "summary": "Analysis complete",
                "short_summary": "Analysis complete",
                "greeting": "Hi from test",
                "categories": [{"id": "seo", "issues": []}],
            }

        ready = self.client.get(f"/api/test/results/{test_id}")
        self.assertEqual(ready.status_code, 200)
        ready_payload = ready.get_json()
        self.assertIsNotNone(ready_payload)
        self.assertEqual(ready_payload["summary"], "Analysis complete")
        self.assertIn("categories", ready_payload)

    def test_progress_values_are_integer_percentages(self):
        test_id = self._start_job()

        response = self.client.get(f"/api/test/events/{test_id}", buffered=True)
        body = response.get_data(as_text=True)

        for expected in ['"progress": 10', '"progress": 30']:
            self.assertIn(expected, body)


if __name__ == "__main__":
    unittest.main()
