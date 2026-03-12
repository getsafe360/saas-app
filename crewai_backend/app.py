import json
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

from crew import CrewService

load_dotenv()

app = Flask(__name__)
CORS(app)


@dataclass
class StreamEntry:
    queue: "queue.Queue[dict]" = field(default_factory=queue.Queue)
    done: bool = False
    created_at: float = field(default_factory=time.time)


STREAMS = {}
STREAM_LOCK = threading.Lock()
CREW = CrewService(model=os.environ.get("CREW_MODEL", "openai/gpt-5-mini"))


def validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("url must be a valid http/https URL")
    return url


def _emit(q: "queue.Queue[dict]", event_type: str, **payload):
    event = {"type": event_type, **payload}
    q.put(event)


@app.route("/api/test/start", methods=["POST"])
def start_homepage_test() -> Response:
    try:
        data = request.get_json(force=True)
    except Exception as e:
        return jsonify({"error": f"Invalid JSON: {str(e)}"}), 400

    url = data.get("url") if isinstance(data, dict) else None

    if not isinstance(url, str):
        return jsonify({"error": "url required"}), 400

    try:
        validate_url(url)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    stream_id = uuid.uuid4().hex

    with STREAM_LOCK:
        STREAMS[stream_id] = StreamEntry()

    worker = threading.Thread(target=_run_sparky_worker, args=(stream_id, url), daemon=True)
    worker.start()

    return jsonify({
        "id": stream_id,
        "test_id": stream_id,
        "status": "started"
    })


@app.route("/api/test/events/<stream_id>", methods=["GET"])
def stream_events(stream_id: str):
    with STREAM_LOCK:
        stream = STREAMS.get(stream_id)

    if stream is None:
        return jsonify({"error": "stream not found"}), 404

    q = stream.queue

    def event_stream():
        try:
            yield "event: status\ndata: {\"type\":\"status\",\"status\":\"connecting\"}\n\n"
            while True:
                try:
                    item = q.get(timeout=15)
                    event_type = item.get("type", "message")
                    yield f"event: {event_type}\ndata: {json.dumps(item)}\n\n"
                    if event_type in ("done", "error"):
                        break
                except queue.Empty:
                    yield ": keepalive\n\n"
        finally:
            with STREAM_LOCK:
                STREAMS.pop(stream_id, None)

    return Response(
        stream_with_context(event_stream()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _run_sparky_worker(stream_id: str, url: str):
    import logging

    logger = logging.getLogger(__name__)

    with STREAM_LOCK:
        stream = STREAMS.get(stream_id)

    if stream is None:
        return

    q = stream.queue
    logger.info("[WORKER] Starting sparky pipeline test_id=%s url=%s", stream_id, url)

    try:
        _emit(q, "status", test_id=stream_id, status="started", message="Pipeline started")
        _emit(q, "log", test_id=stream_id, message="Scanning URL and bootstrapping agents")
        _emit(q, "progress", test_id=stream_id, progress=10, message="Initialized")

        _emit(q, "log", test_id=stream_id, message="Running content and performance checks")
        _emit(q, "progress", test_id=stream_id, progress=35, message="Collecting signals")

        result = CREW.run_sparky_pipeline(url)
        logger.info("[WORKER] Pipeline completed successfully test_id=%s", stream_id)

        _emit(q, "log", test_id=stream_id, message="Synthesizing recommendations")
        _emit(q, "progress", test_id=stream_id, progress=80, message="Finalizing report")
        _emit(
            q,
            "result",
            test_id=stream_id,
            greeting=result.get("greeting"),
            categories=result.get("categories", []),
            summary=result.get("summary"),
            short_summary=result.get("short_summary"),
        )
        _emit(q, "progress", test_id=stream_id, progress=100, message="Complete")
        _emit(q, "status", test_id=stream_id, status="done", message="Pipeline finished")
        _emit(q, "done", test_id=stream_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("[WORKER] Pipeline failed test_id=%s: %s", stream_id, str(exc), exc_info=True)
        _emit(q, "error", test_id=stream_id, message=str(exc))
    finally:
        stream.done = True


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
    streams_ok = isinstance(STREAMS, dict)
    healthy = crew_ok and api_key_ok and streams_ok

    return jsonify({
        "status": "ok" if healthy else "error",
        "crew_service": crew_ok,
        "openai_key_present": api_key_ok,
        "streams_registry": streams_ok,
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
