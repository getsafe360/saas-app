"""FastAPI entrypoint for the Vercel API gateway over CrewAI workflows."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timezone
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


class TestStartResponse(BaseModel):
    test_id: str


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


async def _run_test_analysis(test_id: str, payload: TestStartRequest) -> None:
    revision = 1
    try:
        settings = GatewaySettings.from_env()
        platform = payload.platform or (
            "wordpress" if _is_wordpress_url(str(payload.url), settings) else "generic"
        )
        task_sequence = [
            ("accessibility", "repair_accessibility", 50),
            ("performance", "analyze_seo", 90),
        ]

        service = CrewService(model=settings.default_model)
        revision = await _publish_with_meta(
            test_id,
            SiteEvent(type="status", state="in_progress", platform=platform),
            revision,
        )
        revision = await _publish_with_meta(
            test_id,
            SiteEvent(type="progress", state="in_progress", progress=5, platform=platform),
            revision,
        )

        issues_total = 0
        for category, task_key, progress_value in task_sequence:
            result = service.run_task(task_key=task_key, url=str(payload.url))
            output = str(result.get("result", ""))
            issue_count = max(1, min(12, len(output) // 280))
            issues_total += issue_count
            issues = [
                {"id": f"{category}-{idx+1}", "severity": "medium", "title": f"{category.title()} issue {idx+1}"}
                for idx in range(min(4, issue_count))
            ]
            revision = await _publish_with_meta(
                test_id,
                SiteEvent(
                    type="category",
                    state="in_progress",
                    category=category,
                    issues=issues,
                    progress=progress_value,
                    platform=platform,
                ),
                revision,
            )
            revision = await _publish_with_meta(
                test_id,
                SiteEvent(type="progress", state="in_progress", progress=progress_value, platform=platform),
                revision,
            )
            await asyncio.sleep(0.35)

        revision = await _publish_with_meta(
            test_id,
            SiteEvent(
                type="savings",
                state="in_progress",
                savings={"tokens_used": issues_total * 120, "time_saved": "~2h/week", "cost_saved": "$120/mo"},
                platform=platform,
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
    import json

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
async def start_test(payload: TestStartRequest) -> TestStartResponse:
    import uuid

    test_id = str(uuid.uuid4())
    asyncio.create_task(_run_test_analysis(test_id, payload))
    return TestStartResponse(test_id=test_id)


@app.get("/api/test/events/{test_id}")
async def stream_test_events(test_id: str, request: Request) -> EventSourceResponse:
    queue = await event_bus.subscribe_to_site_events(test_id)

    async def generator():
        try:
            await event_bus.publish_event(
                test_id,
                _with_meta(SiteEvent(type="status", state="connecting"), 0),
            )
            while True:
                if await request.is_disconnected():
                    break
                event = await queue.get()
                yield _serialize_event(event)
                if event.get("state") in {"completed", "errors_found"}:
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
