"""FastAPI entrypoint for CrewAI microservice endpoints."""

from __future__ import annotations

from typing import Dict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl

from crew_service.config import ConfigError, Settings
from crew_service.crew.crew import CrewConfigurationError, CrewService


class TaskRequest(BaseModel):
    url: HttpUrl


app = FastAPI(title="CrewAI Microservice", version="1.0.0")


@app.on_event("startup")
def validate_runtime() -> None:
    Settings.from_env()


@app.get("/health")
def health() -> Dict[str, str]:
    settings = Settings.from_env()
    return {"status": "ok", **settings.as_public_dict()}


def execute_task(task_key: str, payload: TaskRequest) -> Dict[str, object]:
    try:
        settings = Settings.from_env()
        service = CrewService(model=settings.default_model)
        return service.run_task(task_key=task_key, url=str(payload.url))
    except (ConfigError, CrewConfigurationError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive runtime boundary
        raise HTTPException(status_code=500, detail=f"Task execution failed: {exc}") from exc


@app.post("/audit/wordpress")
def audit_wordpress(payload: TaskRequest) -> Dict[str, object]:
    return execute_task("audit_wordpress", payload)


@app.post("/analyze/seo")
def analyze_seo(payload: TaskRequest) -> Dict[str, object]:
    return execute_task("analyze_seo", payload)


@app.post("/repair/accessibility")
def repair_accessibility(payload: TaskRequest) -> Dict[str, object]:
    return execute_task("repair_accessibility", payload)
