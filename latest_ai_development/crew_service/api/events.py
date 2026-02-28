"""Unified event schema for SSE events."""

from __future__ import annotations

from typing import Any, Literal, TypedDict


EventType = Literal["status", "progress", "category", "repair", "savings"]
EventState = Literal[
    "idle",
    "connecting",
    "in_progress",
    "completed",
    "errors_found",
    "repairing",
    "repaired",
    "disconnected",
]


class SiteEvent(TypedDict, total=False):
    type: EventType
    state: EventState
    category: str
    progress: float
    issues: list[dict[str, Any]]
    savings: dict[str, Any]
    message: str
    platform: Literal["wordpress"]
