import json
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
except Exception:  # noqa: BLE001
    load_dotenv = None
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

from crew import CrewService

if load_dotenv is not None:
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
JOB_TTL_SECONDS = int(os.environ.get("TEST_JOB_TTL_SECONDS", "1800"))
HEARTBEAT_INTERVAL_SECONDS = int(os.environ.get("TEST_SSE_HEARTBEAT_SECONDS", "10"))
TERMINAL_JOB_STATUSES = {"completed", "failed", "error"}
TERMINAL_STATUS_EVENTS = {"completed", "errors_found"}


def now_ts() -> float:
    return time.time()


def get_job(test_id: str) -> TestJob | None:
    with JOBS_LOCK:
        return JOBS.get(test_id)


def save_job(job: TestJob) -> None:
    with JOBS_LOCK:
        JOBS[job.id] = job


def is_terminal_event(event: dict[str, Any]) -> bool:
    return event.get("type") == "error" or (
        event.get("type") == "status" and event.get("state") in TERMINAL_STATUS_EVENTS
    )


def should_purge_job(job: TestJob, current_ts: float) -> bool:
    return job.status in TERMINAL_JOB_STATUSES and (current_ts - job.updated_at) > JOB_TTL_SECONDS


def to_terminal_result_payload(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "summary": result.get("summary"),
        "short_summary": result.get("short_summary"),
        "greeting": result.get("greeting"),
        "categories": result.get("categories"),
    }


def purge_expired_jobs() -> int:
    current_ts = now_ts()
    with JOBS_LOCK:
        expired_ids = [job_id for job_id, job in JOBS.items() if should_purge_job(job, current_ts)]
        for job_id in expired_ids:
            del JOBS[job_id]
    return len(expired_ids)


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
        job.updated_at = now_ts()

        if event_type == "progress":
            progress_value = payload.get("progress")
            if isinstance(progress_value, (int, float)):
                job.progress = float(progress_value)
        elif event_type == "status":
            state = payload.get("state")
            if isinstance(state, str) and not (job.status in TERMINAL_JOB_STATUSES and state == "in_progress"):
                job.status = state
        elif event_type == "summary":
            existing = job.result or {}
            job.result = {
                "summary": payload.get("summary") or existing.get("summary"),
                "short_summary": payload.get("short_summary") or existing.get("short_summary"),
                "greeting": payload.get("greeting") or existing.get("greeting"),
                "categories": payload.get("categories") if payload.get("categories") is not None else existing.get("categories"),
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
        # Emit 0..100 progress integers to keep the contract explicit across backend and tests.
        (10, "Fetching HTML"),
        (30, "Analyzing accessibility"),
        (60, "Checking SEO"),
        (80, "Running security checks"),
    ]

    for progress, message in milestones:
        time.sleep(1.0)
        emit_event(test_id, "progress", progress=progress, message=message)


def _emit_heartbeats(test_id: str, stop_event: threading.Event) -> None:
    while not stop_event.wait(HEARTBEAT_INTERVAL_SECONDS):
        if stop_event.is_set():
            break
        emit_event(
            test_id,
            "status",
            state="in_progress",
            message="heartbeat",
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        )


def _run_sparky_worker(test_id: str, url: str) -> None:
    import logging

    logger = logging.getLogger(__name__)
    logger.info("[WORKER] Starting test_id=%s url=%s", test_id, url)

    heartbeat_stop = threading.Event()
    heartbeat_worker = threading.Thread(target=_emit_heartbeats, args=(test_id, heartbeat_stop), daemon=True)
    heartbeat_worker.start()

    try:
        emit_event(test_id, "status", state="in_progress", message="started")
        emit_event(test_id, "debug", message="Sparky pipeline bootstrapped")

        _simulate_progress(test_id)

        result = CREW.run_sparky_pipeline(url)
        summary = result.get("short_summary") or result.get("summary") or "Analysis complete"
        greeting = result.get("greeting") or "Hi! Here is your test report."
        result_payload = to_terminal_result_payload({
            **result,
            "summary": result.get("summary") or summary,
            "short_summary": result.get("short_summary") or summary,
            "greeting": greeting,
        })

        with JOBS_LOCK:
            job = JOBS.get(test_id)
            if job is not None:
                job.result = result_payload
                job.updated_at = now_ts()

        emit_event(
            test_id,
            "summary",
            summary=summary,
            greeting=greeting,
            short_summary=result_payload.get("short_summary"),
            categories=result_payload.get("categories"),
            message="Analysis complete",
        )
        emit_event(test_id, "status", state="completed", message="done")
        logger.info("[WORKER] Completed test_id=%s", test_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("[WORKER] Failed test_id=%s error=%s", test_id, str(exc), exc_info=True)
        emit_event(test_id, "error", message=str(exc))
    finally:
        heartbeat_stop.set()


@app.route("/api/test/start", methods=["POST"])
def start_homepage_test() -> Response:
    purge_expired_jobs()
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
    save_job(job)

    worker = threading.Thread(target=_run_sparky_worker, args=(test_id, url), daemon=True)
    worker.start()

    return jsonify({"id": test_id, "test_id": test_id, "status": "started"})


@app.route("/api/test/events/<test_id>", methods=["GET"])
def stream_events(test_id: str):
    with JOBS_LOCK:
        job = JOBS.get(test_id)
        if job is None:
            return jsonify({"error": "stream not found"}), 404

        history = list(job.events)
        terminal_after_replay = bool(history) and is_terminal_event(history[-1])
        subscriber_queue: "queue.Queue[dict[str, Any]] | None" = None

        if not terminal_after_replay:
            subscriber_queue = queue.Queue()
            job.subscribers.add(subscriber_queue)

    def to_sse(event: dict[str, Any]) -> str:
        return f"event: {event.get('type', 'message')}\ndata: {json.dumps(event)}\n\n"

    def event_stream():
        try:
            for historical_event in history:
                yield to_sse(historical_event)

            # Replay-only clients should receive history and then terminate immediately when
            # the final replayed event is terminal, instead of hanging indefinitely.
            if terminal_after_replay or subscriber_queue is None:
                return

            while True:
                try:
                    event = subscriber_queue.get(timeout=15)
                    yield to_sse(event)
                    if is_terminal_event(event):
                        break
                except queue.Empty:
                    yield ": keepalive\n\n"
        finally:
            if subscriber_queue is not None:
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


@app.route("/api/test/results/<test_id>", methods=["GET"])
def get_test_results(test_id: str):
    job = get_job(test_id)
    if job is None:
        return jsonify({"error": "result not found"}), 404

    if job.status != "completed" or job.result is None:
        return jsonify({"error": "result not ready", "status": job.status}), 404

    return jsonify({"id": job.id, "test_id": job.id, **job.result})


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
