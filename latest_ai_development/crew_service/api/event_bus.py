"""In-memory SSE event bus keyed by site id."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, DefaultDict


class SiteEventBus:
    """Simple per-site pub/sub bus with asyncio queues."""

    def __init__(self) -> None:
        self._queues: DefaultDict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe_to_site_events(self, site_id: str) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            self._queues[site_id].add(queue)
        return queue

    async def publish_event(self, site_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._queues.get(site_id, set()))

        for queue in queues:
            await queue.put(event)

    async def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            for site_id, queues in list(self._queues.items()):
                if queue in queues:
                    queues.remove(queue)
                if not queues:
                    self._queues.pop(site_id, None)


event_bus = SiteEventBus()

