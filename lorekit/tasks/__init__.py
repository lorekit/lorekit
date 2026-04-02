"""Background task dispatch for LoreKit.

Local mode: tasks run as asyncio tasks in the FastAPI process.
Cloud mode: tasks dispatch to Modal serverless functions.
"""

import threading

from lorekit.tasks.protocol import TaskRunner, TaskFunc
from lorekit.tasks.local import LocalTaskRunner

_runner: TaskRunner | None = None
_lock = threading.Lock()


def get_task_runner() -> TaskRunner:
    """Return the global task runner, creating a LocalTaskRunner if needed."""
    global _runner
    if _runner is None:
        with _lock:
            if _runner is None:
                _runner = LocalTaskRunner()
    return _runner


def set_task_runner(runner: TaskRunner) -> None:
    """Override the task runner (called by cloud/ at startup for Modal)."""
    global _runner
    with _lock:
        _runner = runner


__all__ = [
    "TaskRunner",
    "TaskFunc",
    "LocalTaskRunner",
    "get_task_runner",
    "set_task_runner",
]
