"""Shared state handling for the Handoff console and its CLI.

Two processes touch `.handoff/state.json`: `console.py`, when the operator
answers an ask, and `handoff.py`, when the orchestrator records a stage
transition. They must agree exactly on how the file is read, written and
locked, so that logic lives here rather than in either of them.

The in-process lock `console.py` used to carry was enough when the server was
the only writer. It is not enough now. A threading lock is invisible to another
process, so the orchestrator recording `component-builder finished` could
interleave with the operator approving a direction and one of the two would be
lost. The lock below is a lock file, which both processes can see.
"""

import json
import os
import sys
import tempfile
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

HANDOFF = Path(".handoff").resolve()
STATE = HANDOFF / "state.json"
RESPONSES = HANDOFF / "responses"
LOCK = HANDOFF / "state.lock"

STATES = ("held", "running", "ready", "clear", "stopped")
ASK_KINDS = ("direction", "build", "findings", "question")
SEVERITIES = ("must-fix", "worth fixing", "nitpick")

# The optional `event` vocabulary on a history entry. Three values, matching
# the three things that can happen to a stage.
EVENTS = ("started", "finished", "failed", "returned")

LOCK_TIMEOUT = 10.0        # seconds to wait for another writer
LOCK_STALE = 60.0          # a lock older than this is assumed abandoned


class StateUnreadable(Exception):
    """state.json exists and could not be parsed."""


def utc_now() -> str:
    """An instant the console can parse, always UTC, always to the second."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stamp() -> str:
    """The compact form used in response filenames."""
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


@contextmanager
def state_lock():
    """Hold the cross-process write lock, or raise after LOCK_TIMEOUT.

    O_CREAT | O_EXCL is atomic on every filesystem this runs on, which a
    "check then create" pair is not. A lock left behind by a killed process
    would otherwise block every future write forever, so one older than
    LOCK_STALE is broken rather than waited on.
    """
    HANDOFF.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + LOCK_TIMEOUT
    while True:
        try:
            fd = os.open(str(LOCK), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode("ascii"))
            os.close(fd)
            break
        except FileExistsError:
            try:
                age = time.time() - LOCK.stat().st_mtime
            except FileNotFoundError:
                continue                      # it vanished, try to take it
            except OSError:
                # Any other stat failure is not a missing lock, and looping
                # straight back skipped both the deadline and the sleep. In a
                # request handling thread that is a core at a hundred percent
                # with no way out.
                if time.monotonic() > deadline:
                    raise TimeoutError(
                        "could not read .handoff/state.lock. "
                        "if nothing else is running, delete it."
                    )
                time.sleep(0.05)
                continue
            if age > LOCK_STALE:
                LOCK.unlink(missing_ok=True)
                continue
            if time.monotonic() > deadline:
                raise TimeoutError(
                    "another process is holding .handoff/state.lock. "
                    "if nothing else is running, delete it."
                )
            time.sleep(0.05)
    try:
        yield
    finally:
        LOCK.unlink(missing_ok=True)


def read_state():
    """The parsed state, or None when there is no file.

    A malformed file raises rather than letting a JSONDecodeError propagate out
    of a request handler. Left uncaught it killed the response mid-flight, and
    the console then showed sample data as though the server were down, which
    is a lie about why: the server is up and the file is broken.
    """
    if not STATE.is_file():
        return None
    try:
        data = json.loads(STATE.read_text(encoding="utf-8"))
    except ValueError as err:
        raise StateUnreadable(f"state.json is not valid json: {err}") from err
    except OSError as err:
        raise StateUnreadable(f"state.json could not be read: {err}") from err
    if not isinstance(data, dict):
        raise StateUnreadable("state.json is not a json object")
    return data


def write_state(state: dict) -> None:
    """Replace state.json in one step, never leaving a partial file readable.

    A fixed temp name would collide between two concurrent writers, so the name
    is unique per write. The fsync before the rename means a crash cannot leave
    the real name pointing at an empty file.
    """
    HANDOFF.mkdir(parents=True, exist_ok=True)
    state["generated"] = utc_now()
    handle, tmp_name = tempfile.mkstemp(dir=str(HANDOFF), prefix="state.", suffix=".tmp")
    tmp = Path(tmp_name)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(json.dumps(state, indent=2, ensure_ascii=False) + "\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, STATE)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def empty_state() -> dict:
    """The shape the console expects before any project exists."""
    return {"version": 1, "generated": utc_now(), "projects": []}


def find_project(state: dict, slug: str):
    for project in state.get("projects", []):
        if project.get("slug") == slug:
            return project
    return None


def add_history(project: dict, kind: str, text: str,
                detail: str = None, quote: str = None, at: str = None,
                stage: str = None, event: str = None) -> dict:
    """Append one register entry.

    Only three kinds of event belong in the register: a stage started, a stage
    finished, and a decision the operator made. `kind` is `stage` or `decision`
    because the console sets those two in different faces.

    `stage` and `event` are optional and are the machine readable form of what
    `text` says in prose. The console draws each project as a thread across the
    three stage columns, and deriving that thread by parsing free-form English
    is brittle: one reworded message and a project's line disappears. Writing
    both fields makes the drawing exact.

    They are purely additive. `text` is still written, and the console still
    parses it when they are absent, so every state file produced before this
    existed keeps rendering. `event` is `started`, `finished` or `failed`.
    """
    entry = {"at": at or utc_now(), "kind": kind, "text": text}
    if detail:
        entry["detail"] = detail
    if quote:
        entry["quote"] = quote
    if stage:
        entry["stage"] = stage
    if event:
        if event not in EVENTS:
            fail(f"'{event}' is not one of: {', '.join(EVENTS)}")
        entry["event"] = event
    project.setdefault("history", []).append(entry)
    return entry


def next_ask_id(project: dict, kind: str) -> str:
    """`<slug>/<kind>/<n>`, per the console's documented convention.

    The counter is kept on the project because drafts are saved against the ask
    id in the operator's browser. Deriving it by counting history entries would
    renumber an ask whenever history was edited, silently discarding whatever
    the operator had typed into it.
    """
    seq = project.setdefault("askSeq", {})
    seq[kind] = int(seq.get(kind, 0)) + 1
    return f"{project['slug']}/{kind}/{seq[kind]}"


def fail(message: str) -> "NoReturn":
    print(f"handoff: {message}", file=sys.stderr)
    raise SystemExit(1)
