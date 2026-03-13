import json
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

from crew import CrewService

load_dotenv()

app = Flask(__name__)
CORS(app)


@dataclass
class TestJob:
    id: str
    url: str
    status: str = "pending"
    progress: float = 0.0
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    events: list[dict[str, Any]] = field(default_factory=list)
    subscribers: set["queue.Queue[dict[str, Any]]"] = field(default_factory=set)


JOBS: dict[str, TestJob] = {}
JOBS_LOCK = threading.Lock()
CREW = CrewService(model=os.environ.get("CREW_MODEL", "openai/gpt-5-mini"))


def validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("url must be a valid http/https URL")
    return url


def emit_event(test_id: str, event_type: str, **payload: Any) -> None:
    event = {"type": event_type, **payload}

    with JOBS_LOCK:
        job = JOBS.get(test_id)
        if job is None:
            return

        job.events.append(event)
        job.updated_at = time.time()

        if event_type == "progress":
            progress_value = payload.get("progress")
            if isinstance(progress_value, (int, float)):
                job.progress = float(progress_value)
        elif event_type == "status":
            state = payload.get("state")
            if isinstance(state, str):
                job.status = state
        elif event_type == "summary":
            job.result = {
                "summary": payload.get("summary"),
                "greeting": payload.get("greeting"),
                "message": payload.get("message"),
            }
        elif event_type == "error":
            message = payload.get("message")
            if isinstance(message, str):
                job.error = message
                job.status = "failed"

        subscribers = list(job.subscribers)

    for subscriber in subscribers:
        subscriber.put(event)


def _simulate_progress(test_id: str) -> None:
    milestones = [
        (0.1, "Fetching HTML"),
        (0.3, "Analyzing accessibility"),
        (0.6, "Checking SEO"),
        (0.8, "Running security checks"),
    ]

    for progress, message in milestones:
        time.sleep(1.0)
        emit_event(test_id, "progress", progress=progress, message=message)


def _run_sparky_worker(test_id: str, url: str) -> None:
    import logging

    logger = logging.getLogger(__name__)
    logger.info("[WORKER] Starting test_id=%s url=%s", test_id, url)

    try:
        emit_event(test_id, "status", state="in_progress", message="started")
        emit_event(test_id, "debug", message="Sparky pipeline bootstrapped")

        _simulate_progress(test_id)

        result = CREW.run_sparky_pipeline(url)
        summary = result.get("short_summary") or result.get("summary") or "Analysis complete"
        greeting = result.get("greeting") or "Hi! Here is your test report."

        emit_event(
            test_id,
            "summary",
            summary=summary,
            greeting=greeting,
            message="Analysis complete",
        )
        emit_event(test_id, "status", state="completed", message="done")
        logger.info("[WORKER] Completed test_id=%s", test_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("[WORKER] Failed test_id=%s error=%s", test_id, str(exc), exc_info=True)
        emit_event(test_id, "error", message=str(exc))


@app.route("/api/test/start", methods=["POST"])
def start_homepage_test() -> Response:
    try:
        data = request.get_json(force=True)
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": f"Invalid JSON: {str(e)}"}), 400

    url = data.get("url") if isinstance(data, dict) else None
    if not isinstance(url, str):
        return jsonify({"error": "url required"}), 400

    try:
        validate_url(url)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    test_id = uuid.uuid4().hex
    job = TestJob(id=test_id, url=url)

    with JOBS_LOCK:
        JOBS[test_id] = job

    worker = threading.Thread(target=_run_sparky_worker, args=(test_id, url), daemon=True)
    worker.start()

    return jsonify({"id": test_id, "test_id": test_id, "status": "started"})


@app.route("/api/test/events/<test_id>", methods=["GET"])
def stream_events(test_id: str):
    with JOBS_LOCK:
        job = JOBS.get(test_id)
        if job is None:
            return jsonify({"error": "stream not found"}), 404

        subscriber_queue: "queue.Queue[dict[str, Any]]" = queue.Queue()
        history = list(job.events)
        job.subscribers.add(subscriber_queue)

    def to_sse(event: dict[str, Any]) -> str:
        return f"event: {event.get('type', 'message')}\ndata: {json.dumps(event)}\n\n"

    def event_stream():
        try:
            for historical_event in history:
                yield to_sse(historical_event)

            while True:
                try:
                    event = subscriber_queue.get(timeout=15)
                    yield to_sse(event)
                    if event.get("type") in {"error"}:
                        break
                    if event.get("type") == "status" and event.get("state") == "completed":
                        break
                except queue.Empty:
                    yield ": keepalive\n\n"
        finally:
            with JOBS_LOCK:
                current = JOBS.get(test_id)
                if current is not None:
                    current.subscribers.discard(subscriber_queue)

    response = Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
    )
    response.headers["Cache-Control"] = "no-cache"
    response.headers["Connection"] = "keep-alive"
    response.headers["X-Accel-Buffering"] = "no"
    return response


@app.route("/analyze", methods=["POST"])
def legacy_analyze():
    data = request.get_json(force=True)
    url = data.get("url") if isinstance(data, dict) else None
    if not url:
        return jsonify({"error": "Missing URL"}), 400

    result = CREW.run_full_audit(url)
    return jsonify(result)


@app.route("/api/health", methods=["GET"])
def backend_health():
    crew_ok = CREW is not None
    api_key_ok = bool(os.environ.get("OPENAI_API_KEY"))
    jobs_ok = isinstance(JOBS, dict)
    healthy = crew_ok and api_key_ok and jobs_ok

    return jsonify({
        "status": "ok" if healthy else "error",
        "crew_service": crew_ok,
        "openai_key_present": api_key_ok,
        "jobs_registry": jobs_ok,
        "message": "Backend is running and healthy" if healthy else "Backend dependencies are not ready",
    }), 200 if healthy else 503


@app.route("/api/test/self", methods=["GET"])
def self_test_sparky_pipeline():
    try:
        result = CREW.run_sparky_pipeline("https://example.com")
        return jsonify({
            "status": "ok",
            "greeting": result.get("greeting"),
            "categories": result.get("categories"),
            "summary": result.get("summary"),
            "short_summary": result.get("short_summary"),
            "message": "Sparky pipeline executed successfully",
        })
    except Exception as exc:  # noqa: BLE001
        return jsonify({
            "status": "error",
            "message": str(exc),
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, threaded=True)
