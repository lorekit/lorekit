"""Task runner protocol — plugin point for background job dispatch.

Open source default: LocalTaskRunner (asyncio.create_task, same process).
Cloud override: ModalTaskRunner (dispatches to Modal serverless functions).

The cloud/ submodule replaces the runner at startup to inject Modal dispatch.
The open source app runs everything in-process — no external dependencies.
"""

from __future__ import annotations

from typing import Any, Callable, Coroutine, Protocol, runtime_checkable


# Task function signature: async callable that takes keyword args
TaskFunc = Callable[..., Coroutine[Any, Any, Any]]


@runtime_checkable
class TaskRunner(Protocol):
    """Protocol for dispatching background tasks.

    Implementations must provide:
    - submit(): launch a task function in the background
    - shutdown(): clean up resources (called at app shutdown)
    """

    async def submit(
        self,
        func: TaskFunc,
        *,
        task_type: str,
        job_id: str,
        **kwargs: Any,
    ) -> None:
        """Submit a background task for execution.

        Args:
            func: The async function to run.
            task_type: Category for routing (e.g. "clips", "render", "keyframe").
                       Modal uses this to pick the right function config (CPU/GPU/memory).
            job_id: The job ID for tracking. Implementations may use this for
                    logging, cost attribution, or deduplication.
            **kwargs: Arguments forwarded to func.
        """
        ...

    async def shutdown(self) -> None:
        """Clean up resources. Called during app shutdown."""
        ...
