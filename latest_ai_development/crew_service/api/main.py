"""FastAPI entrypoint for the Vercel API gateway over CrewAI workflows."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Literal
from urllib.parse import urlparse

# Ensure Vercel can import the unified src package.
SERVICE_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = SERVICE_ROOT.parent / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field, HttpUrl
from sse_starlette.sse import EventSourceResponse

from .event_bus import event_bus
from .events import SiteEvent

from latest_ai_development.config.settings import ConfigError
from latest_ai_development.crew import CrewConfigurationError, CrewService

from config import GatewaySettings

logger = logging.getLogger("crew_service.gateway")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

_PROGRESS_THROTTLE_SECONDS = 0.3
_MAX_CONCURRENT_TESTS_PER_KEY = 2


class AnalyzeRequest(BaseModel):
    site_id: str = Field(description="Site identifier used for SSE channeling.")
    url: HttpUrl
    platform: Literal["wordpress", "generic"] | None = Field(
        default=None,
        description="Optional platform override. Defaults to auto-detect from URL and env config.",
    )


class AnalyzeResponse(BaseModel):
    status: str
    platform: str
    task: str
    data: Dict[str, Any]


class TestStartRequest(BaseModel):
    url: HttpUrl
    platform: Literal["wordpress", "generic"] | None = Field(default=None)
    language: str = Field(default="en")
    name: str | None = Field(default=None)
    session_id: str | None = Field(default=None)


class TestStartResponse(BaseModel):
    test_id: str


class _HomepageLimiter:
    def __init__(self, max_per_key: int) -> None:
        self._max_per_key = max_per_key
        self._active: dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def acquire(self, key: str) -> bool:
        async with self._lock:
            count = self._active.get(key, 0)
            if count >= self._max_per_key:
                return False
            self._active[key] = count + 1
            return True

    async def release(self, key: str) -> None:
        async with self._lock:
            count = self._active.get(key, 0)
            if count <= 1:
                self._active.pop(key, None)
            else:
                self._active[key] = count - 1


homepage_limiter = _HomepageLimiter(max_per_key=_MAX_CONCURRENT_TESTS_PER_KEY)


def _with_meta(event: SiteEvent, revision: int) -> SiteEvent:
    payload = {**event}
    payload["revision"] = revision
    payload["timestamp"] = datetime.now(timezone.utc).isoformat()
    hashed_source = json.dumps(payload, sort_keys=True, default=str)
    payload["hash"] = hashlib.sha256(hashed_source.encode("utf-8")).hexdigest()[:12]
    return payload


async def _publish_with_meta(channel_id: str, event: SiteEvent, revision: int) -> int:
    final_event = _with_meta(event, revision)
    await event_bus.publish_event(channel_id, final_event)
    return revision + 1


def _looks_like_wordpress(url: str) -> bool:
    lowered = url.lower()
    return any(hint in lowered for hint in ("wp-", "wordpress", "/blog"))


def _extract_json_or_fallback(raw: str, fallback: dict[str, Any]) -> dict[str, Any]:
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return fallback


def _build_default_categories() -> dict[str, list[dict[str, str]]]:
    return {
        "accessibility": [{"title": "Add visible focus states", "severity": "medium", "priority": "high"}],
        "performance": [{"title": "Reduce render-blocking resources", "severity": "medium", "priority": "high"}],
        "seo_360": [{"title": "Improve structured data coverage for AI answers", "severity": "medium", "priority": "high"}],
        "security": [{"title": "Harden security headers", "severity": "medium", "priority": "high"}],
        "content": [{"title": "Make headlines clearer and intent-driven", "severity": "low", "priority": "medium"}],
    }


def _compose_sparky_fallback_summary(name: str | None, language: str, platform: str) -> str:
    first = "Hi" if language.lower().startswith("en") else "Hola"
    target = f" {name}" if name else ""
    wp_sentence = (
        " WordPress-wise, prioritize admin security, outdated plugins/themes, and backend speed."
        if platform == "wordpress"
        else ""
    )
    return (
        f"{first}{target}! I’m Sparky. Your homepage snapshot is ready. "
        "Focus first on performance and SEO (360°), then accessibility and security for fast gains."
        f"{wp_sentence} Create a free account to unlock the full report and automated fixes."
    ).strip()


async def _run_test_analysis(test_id: str, payload: TestStartRequest) -> None:
    revision = 1
    limiter_key = payload.session_id or "anonymous"
    acquired = await homepage_limiter.acquire(limiter_key)
    if not acquired:
        await event_bus.publish_event(
            test_id,
            _with_meta(
                SiteEvent(
                    type="error",
                    state="errors_found",
                    message="Too many concurrent homepage tests for this session. Please retry in a moment.",
                ),
                revision,
            ),
        )
        await event_bus.publish_event(test_id, _with_meta(SiteEvent(type="status", state="errors_found"), revision + 1))
        return

    try:
        settings = GatewaySettings.from_env()
        auto_platform = "wordpress" if (_is_wordpress_url(str(payload.url), settings) or _looks_like_wordpress(str(payload.url))) else "generic"
        platform = payload.platform or auto_platform

        service = CrewService(model="openai/gpt-4o-mini")
        last_progress_ts = 0.0

        revision = await _publish_with_meta(
            test_id,
            SiteEvent(type="status", state="in_progress", platform=platform),
            revision,
        )

        async def maybe_publish_progress(progress_value: float) -> None:
            nonlocal revision, last_progress_ts
            now = time.monotonic()
            if (now - last_progress_ts) < _PROGRESS_THROTTLE_SECONDS:
                return
            revision = await _publish_with_meta(
                test_id,
                SiteEvent(type="progress", state="in_progress", progress=progress_value, platform=platform),
                revision,
            )
            last_progress_ts = now

        await maybe_publish_progress(5)

        snapshot_result = service.run_task(task_key="site_snapshot", url=str(payload.url))
        parsed_snapshot = _extract_json_or_fallback(str(snapshot_result.get("result", "")), {
            "module": "site_snapshot",
            "platform": platform,
            "categories": _build_default_categories(),
        })
        categories = parsed_snapshot.get("categories") or _build_default_categories()

        wp_findings = []
        if platform == "wordpress":
            wp_result = service.run_task(task_key="wordpress_snapshot", url=str(payload.url))
            parsed_wp = _extract_json_or_fallback(str(wp_result.get("result", "")), {"wordpress_findings": []})
            wp_findings = parsed_wp.get("wordpress_findings") or []
            categories["wordpress"] = wp_findings[:3] if isinstance(wp_findings, list) else []

        ordered_categories = ["accessibility", "performance", "seo_360", "security", "content"]
        if platform == "wordpress":
            ordered_categories.append("wordpress")

        cat_progress = 20
        for category in ordered_categories:
            raw_issues = categories.get(category, [])
            issues = raw_issues[:3] if isinstance(raw_issues, list) else []
            revision = await _publish_with_meta(
                test_id,
                SiteEvent(
                    type="category",
                    state="in_progress",
                    category=category,
                    issues=issues,
                    progress=cat_progress,
                    platform=platform,
                ),
                revision,
            )
            cat_progress = min(95, cat_progress + 15)
            await maybe_publish_progress(cat_progress)

        summary_context = {
            "name": payload.name,
            "language": payload.language,
            "platform": platform,
            "category_snapshots": categories,
        }
        summary_result = service.run_task(task_key="generate_sparky_summary", url=str(payload.url))
        summary_text = str(summary_result.get("result", "")).strip()
        if not summary_text:
            summary_text = _compose_sparky_fallback_summary(payload.name, payload.language, platform)

        revision = await _publish_with_meta(
            test_id,
            SiteEvent(
                type="summary",
                state="in_progress",
                message=summary_text,
                progress=99,
                platform=platform,
                savings={"context": summary_context},
            ),
            revision,
        )

        await _publish_with_meta(
            test_id,
            SiteEvent(type="status", state="completed", progress=100, platform=platform),
            revision,
        )
    except Exception as exc:  # pragma: no cover
        await event_bus.publish_event(
            test_id,
            _with_meta(
                SiteEvent(type="error", state="errors_found", message=f"Test analysis failed: {exc}"),
                revision,
            ),
        )
        await event_bus.publish_event(
            test_id,
            _with_meta(SiteEvent(type="status", state="errors_found"), revision + 1),
        )
    finally:
        await homepage_limiter.release(limiter_key)


@asynccontextmanager
async def lifespan(_: FastAPI):
    GatewaySettings.from_env()
    yield


app = FastAPI(title="CrewAI API Gateway", version="1.0.0", lifespan=lifespan)


def _is_wordpress_url(target_url: str, settings: GatewaySettings) -> bool:
    wp_domain = urlparse(settings.wordpress_site_url).netloc
    return urlparse(target_url).netloc == wp_domain


def _select_task(payload: AnalyzeRequest, settings: GatewaySettings) -> tuple[str, str]:
    if payload.platform == "wordpress":
        return "wordpress", "audit_wordpress"
    if payload.platform == "generic":
        return "generic", "analyze_seo"
    return (
        ("wordpress", "audit_wordpress")
        if _is_wordpress_url(str(payload.url), settings)
        else ("generic", "analyze_seo")
    )


def _serialize_event(event: SiteEvent) -> dict[str, str]:
    return {"data": json.dumps(event)}


@app.get("/api/events/{site_id}")
async def stream_events(site_id: str, request: Request) -> EventSourceResponse:
    queue = await event_bus.subscribe_to_site_events(site_id)

    async def generator():
        try:
            await event_bus.publish_event(
                site_id,
                SiteEvent(type="status", state="connecting"),
            )
            while True:
                if await request.is_disconnected():
                    await event_bus.publish_event(site_id, SiteEvent(type="status", state="disconnected"))
                    break
                event = await queue.get()
                yield _serialize_event(event)
        except (asyncio.CancelledError, GeneratorExit):
            await event_bus.publish_event(site_id, SiteEvent(type="status", state="disconnected"))
            raise
        finally:
            await event_bus.unsubscribe(queue)

    return EventSourceResponse(generator())


@app.post("/api/test/start", response_model=TestStartResponse)
async def start_test(payload: TestStartRequest, request: Request) -> TestStartResponse:
    import uuid

    test_id = str(uuid.uuid4())
    session_id = payload.session_id or request.headers.get("x-session-id") or request.client.host if request.client else None
    enriched_payload = payload.model_copy(update={"session_id": session_id})
    asyncio.create_task(_run_test_analysis(test_id, enriched_payload))
    return TestStartResponse(test_id=test_id)


@app.get("/api/test/events/{test_id}")
async def stream_test_events(test_id: str, request: Request) -> EventSourceResponse:
    queue = await event_bus.subscribe_to_site_events(test_id)

    async def generator():
        summary_seen = False
        try:
            await event_bus.publish_event(
                test_id,
                _with_meta(SiteEvent(type="status", state="connecting"), 0),
            )
            while True:
                if await request.is_disconnected():
                    break
                event = await queue.get()
                if event.get("type") == "summary":
                    summary_seen = True
                yield _serialize_event(event)
                if summary_seen and event.get("state") in {"completed", "errors_found"}:
                    break
        finally:
            await event_bus.unsubscribe(queue)

    return EventSourceResponse(generator())


@app.get("/api/health")
def health() -> Dict[str, Any]:
    settings = GatewaySettings.from_env()
    return {
        "status": "ok",
        "service": "crew-service-gateway",
        "config": settings.as_public_dict(),
    }


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    try:
        settings = GatewaySettings.from_env()
        platform, task_key = _select_task(payload, settings)

        if platform == "wordpress" and not _is_wordpress_url(str(payload.url), settings):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid site configuration: WordPress request URL does not match "
                    "configured WORDPRESS_SITE_URL domain"
                ),
            )

        service = CrewService(model=settings.default_model)
        await event_bus.publish_event(payload.site_id, SiteEvent(type="status", state="in_progress"))

        category = "wordpress" if platform == "wordpress" else "seo"
        await event_bus.publish_event(
            payload.site_id,
            SiteEvent(type="category", state="in_progress", category=category, issues=[]),
        )
        await event_bus.publish_event(payload.site_id, SiteEvent(type="progress", state="in_progress", progress=42))

        result = service.run_task(task_key=task_key, url=str(payload.url))

        usage = result.get("usage_metrics")
        await event_bus.publish_event(
            payload.site_id,
            SiteEvent(type="savings", savings={"tokens_used": usage}),
        )
        await event_bus.publish_event(payload.site_id, SiteEvent(type="status", state="completed"))

        logger.info(
            "analysis_completed",
            extra={
                "platform": platform,
                "task": task_key,
                "url": str(payload.url),
                "app_env": settings.app_env,
            },
        )

        return AnalyzeResponse(status="success", platform=platform, task=task_key, data=result)
    except ConfigError as exc:
        raise HTTPException(status_code=500, detail=f"Missing env vars: {exc}") from exc
    except CrewConfigurationError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid crew configuration: {exc}") from exc
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid site configuration: {exc}") from exc
    except Exception as exc:  # pragma: no cover - runtime provider/network boundary
        raise HTTPException(
            status_code=503,
            detail=(
                "Model provider unavailable or network unreachable. "
                f"Details: {exc}"
            ),
        ) from exc
