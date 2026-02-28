"""FastAPI entrypoint for the Vercel API gateway over CrewAI workflows."""

from __future__ import annotations

import asyncio
import logging
import sys
from contextlib import asynccontextmanager
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
