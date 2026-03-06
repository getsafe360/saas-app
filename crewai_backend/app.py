import json
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

from crew import CrewService

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)


@dataclass
class StreamState:
    events: "queue.Queue[str]" = field(default_factory=queue.Queue)
    completed: bool = False
    started_at: float = field(default_factory=time.time)


STREAMS: Dict[str, StreamState] = {}
STREAM_LOCK = threading.Lock()


def validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("url must be a valid http/https URL")
    return url


def normalize_categories(raw: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        category_id = item.get("id") or item.get("category") or item.get("name")
        if not isinstance(category_id, str) or not category_id.strip():
            continue
        issues = item.get("issues")
        if not isinstance(issues, list):
            issues = []
        normalized.append({"id": category_id.strip(), "issues": issues[:3]})
    return normalized


def publish_event(stream_id: str, payload: Dict[str, Any]) -> None:
    event = f"data: {json.dumps(payload)}\n\n"
    with STREAM_LOCK:
        stream = STREAMS.get(stream_id)
    if stream:
        stream.events.put(event)


def mark_completed(stream_id: str) -> None:
    with STREAM_LOCK:
        stream = STREAMS.get(stream_id)
    if stream:
        stream.completed = True


def run_sparky_stream_job(stream_id: str, url: str, language: str, name: str | None) -> None:
    try:
        service = CrewService(model=os.environ.get("CREW_MODEL", "openai/gpt-5-mini"))

        result = service.run_sparky_pipeline(
            url=url,
            language=language,
            name=name,
        )

        greeting = f"Hi {name}, I'm Sparky. I just finished a fast homepage snapshot." if name else "Hi, I'm Sparky. I just finished a fast homepage snapshot."
        categories = normalize_categories(result.get("categories"))
        summary = result.get("summary") if isinstance(result.get("summary"), str) else ""
        platform = result.get("platform") if isinstance(result.get("platform"), str) else "generic"

        publish_event(stream_id, {"type": "greeting", "message": greeting, "platform": platform})
        publish_event(stream_id, {"type": "categories", "categories": categories, "platform": platform})
        publish_event(stream_id, {"type": "summary", "message": summary, "platform": platform, "greeting": greeting})
        publish_event(stream_id, {"type": "completed", "state": "completed", "platform": platform})
    except Exception as exc:
        publish_event(stream_id, {"type": "error", "state": "errors_found", "message": str(exc)})
    finally:
        mark_completed(stream_id)


@app.route("/api/test/start", methods=["POST"])
def start_homepage_test() -> Response:
    data = request.get_json(silent=True) or {}
    url = data.get("url")
    language = data.get("language") or "en"
    name = data.get("name")

    if not isinstance(url, str):
        return jsonify({"error": "url required"}), 400

    try:
        validate_url(url)
    except ValueError as err:
        return jsonify({"error": str(err)}), 400

    stream_id = uuid.uuid4().hex
    stream_state = StreamState()

    with STREAM_LOCK:
        STREAMS[stream_id] = stream_state

    worker = threading.Thread(
        target=run_sparky_stream_job,
        args=(stream_id, url, language if isinstance(language, str) else "en", name if isinstance(name, str) else None),
        daemon=True,
    )
    worker.start()

    return jsonify({"id": stream_id})


@app.route("/api/test/events/<stream_id>", methods=["GET"])
def stream_test_events(stream_id: str) -> Response:
    with STREAM_LOCK:
        stream = STREAMS.get(stream_id)

    if stream is None:
        return jsonify({"error": "stream not found"}), 404

    def event_generator():
        # Initial connect state for immediate frontend feedback.
        yield f"data: {json.dumps({'type': 'status', 'state': 'connecting'})}\n\n"
        while True:
            try:
                event = stream.events.get(timeout=1.0)
                yield event
            except queue.Empty:
                if stream.completed:
                    break
                yield ": keepalive\n\n"

    return Response(
        stream_with_context(event_generator()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, threaded=True)
