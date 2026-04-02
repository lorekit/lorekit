"""Local task runner — runs background tasks in-process via asyncio.

This is the open source default. Tasks run as asyncio tasks in the same
event loop as the FastAPI server. No external dependencies.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from lorekit.tasks.protocol import TaskFunc

logger = logging.getLogger(__name__)


class LocalTaskRunner:
    """Run background tasks as asyncio tasks in the current event loop."""

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task] = set()

    async def submit(
        self,
        func: TaskFunc,
        *,
        task_type: str,
        job_id: str,
        **kwargs: Any,
    ) -> None:
        """Launch func as an asyncio background task."""
        task = asyncio.create_task(
            func(job_id=job_id, **kwargs),
            name=f"lorekit-{task_type}-{job_id}",
        )
        self._tasks.add(task)
        task.add_done_callback(self._on_task_done)
        logger.debug("Submitted local task %s (job=%s)", task_type, job_id)

    def _on_task_done(self, task: asyncio.Task) -> None:
        """Log unhandled exceptions from background tasks."""
        self._tasks.discard(task)
        if not task.cancelled() and task.exception():
            logger.error(
                "Background task %s failed with unhandled exception: %s",
                task.get_name(), task.exception(),
            )

    async def shutdown(self) -> None:
        """Cancel any still-running tasks on shutdown."""
        if self._tasks:
            logger.info("Cancelling %d in-flight tasks", len(self._tasks))
            for task in self._tasks:
                task.cancel()
            await asyncio.gather(*self._tasks, return_exceptions=True)
            self._tasks.clear()
