#!/usr/bin/env python3
"""Record pipeline activity for the Handoff console, and drain its inbox.

The console reads `.handoff/state.json` and writes answers into
`.handoff/responses/`. This is the other half of that contract: the commands
the orchestrator runs so the board reflects what the pipeline is actually
doing, and the command that collects what the operator answered.

Every write takes the cross-process lock in handoff_state, because the console
server may be writing an answer at the same moment.

    handoff.py start   <slug> <stage>            a subagent was spawned
    handoff.py finish  <slug> <stage> [--detail] a subagent returned
    handoff.py hold    <slug> --kind ...         park it, the operator decides
    handoff.py ready   <slug>                    answered, next stage not begun
    handoff.py clear   <slug>                    signed off
    handoff.py stop    <slug> --stage <stage>    a stage failed
    handoff.py note    <slug> "text" [--quote]   record an operator decision
    handoff.py drain   [--archive]               read the answers inbox
    handoff.py show                              the board, as text

Run it from the repository root.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from handoff_state import (                                    # noqa: E402
    ASK_KINDS, RESPONSES, SEVERITIES, STATE, STATES,
    StateUnreadable, add_history, empty_state, fail, find_project,
    next_ask_id, read_state, state_lock, utc_now, write_state,
)


def load() -> dict:
    try:
        state = read_state()
    except StateUnreadable as err:
        fail(str(err))
    return state if state is not None else empty_state()


def project_for(state: dict, slug: str, create: bool = False) -> dict:
    project = find_project(state, slug)
    if project is None:
        if not create:
            known = ", ".join(p.get("slug", "?") for p in state.get("projects", [])) or "none"
            fail(f"no project '{slug}'. known projects: {known}")
        project = {
            "slug": slug, "state": "running", "stage": "",
            "since": utc_now(), "ask": None, "history": [],
        }
        state.setdefault("projects", []).append(project)
    return project


def set_state(project: dict, value: str) -> None:
    """State and `since` move together, because `since` is what the console
    counts elapsed time from. Setting one without the other makes a project
    that has been running for four seconds claim it has been running for a day.
    """
    if value not in STATES:
        fail(f"'{value}' is not one of: {', '.join(STATES)}")
    project["state"] = value
    project["since"] = utc_now()


# ---- commands -----------------------------------------------------------

def cmd_start(args) -> int:
    with state_lock():
        state = load()
        project = project_for(state, args.slug, create=True)
        project["stage"] = args.stage
        set_state(project, "running")
        project["ask"] = None
        add_history(project, "stage", f"{args.stage} started",
                    stage=args.stage, event="started")
        write_state(state)
    print(f"{args.slug}: running at {args.stage}")
    return 0


def cmd_finish(args) -> int:
    with state_lock():
        state = load()
        project = project_for(state, args.slug)
        project["stage"] = args.stage
        project["stageCount"] = int(project.get("stageCount", 0)) + 1
        add_history(project, "stage", f"{args.stage} finished", detail=args.detail,
                    stage=args.stage, event="finished")
        # Finishing is not by itself a state change. The orchestrator either
        # holds for a decision or starts the next stage, and both say so.
        write_state(state)
    print(f"{args.slug}: {args.stage} finished")
    return 0


def build_ask(project: dict, args, reuse_id: str = None) -> dict:
    """Build the ask. `reuse_id` keeps an existing id rather than minting one.

    Minting is not free: `next_ask_id` increments a counter that the
    operator's saved drafts are keyed on, so calling it and then deciding not
    to use the result orphans whatever is in the browser. The caller decides
    the id first, and only then is a new one allocated.
    """
    kind = args.kind
    ask = {
        "id": reuse_id or next_ask_id(project, kind),
        "revision": 1,
        "kind": kind,
        "headline": args.headline,
    }
    if args.agent:
        ask["from"] = args.agent
    if args.meta:
        ask["meta"] = args.meta
    ask["at"] = utc_now()

    if kind == "direction":
        if not args.doc:
            fail("--kind direction needs --doc FILE")
        path = Path(args.doc)
        if not path.is_file():
            fail(f"no such file: {path}")
        ask["document"] = path.read_text(encoding="utf-8")

    elif kind == "build":
        if not args.preview:
            fail("--kind build needs --preview URL")
        if not args.preview.startswith(("http://", "https://")):
            fail("--preview must be an http or https url")
        ask["previewUrl"] = args.preview
        ask["changed"] = args.changed or []

    elif kind == "findings":
        if not args.findings:
            fail("--kind findings needs --findings FILE")
        path = Path(args.findings)
        if not path.is_file():
            fail(f"no such file: {path}")
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as err:
            fail(f"{path} is not valid json: {err}")
        if not isinstance(raw, list) or not raw:
            fail(f"{path} must be a non empty json array of findings")
        findings = []
        for i, item in enumerate(raw, 1):
            if not isinstance(item, dict):
                fail(f"finding {i} is not an object")
            severity = item.get("severity")
            if severity not in SEVERITIES:
                fail(f"finding {i} severity must be one of: {', '.join(SEVERITIES)}")
            if not item.get("text"):
                fail(f"finding {i} has no text")
            entry = {"id": item.get("id") or f"f{i}",
                     "severity": severity, "text": item["text"]}
            if item.get("where"):
                entry["where"] = item["where"]
            findings.append(entry)
        ask["findings"] = findings
        ask["to"] = args.to or "the builder"

    else:                                   # question
        if not args.question:
            fail("--kind question needs --question TEXT")
        ask["question"] = args.question
        if args.note:
            ask["note"] = args.note
        if args.option:
            if not 2 <= len(args.option) <= 4:
                fail("a question takes two to four --option values, or none for free text")
            ask["options"] = [{"id": f"o{i}", "label": label}
                              for i, label in enumerate(args.option, 1)]
    return ask


def cmd_hold(args) -> int:
    with state_lock():
        state = load()
        project = project_for(state, args.slug)
        previous = project.get("ask") or {}

        # Re-holding an open ask of the same kind keeps its id, which is what
        # the operator's typed draft is saved against, and bumps its revision,
        # which is what the server's 409 check compares.
        #
        # This used to build the ask first and then compare ids, which could
        # never match: building one allocates the next id unconditionally. So
        # the revision was permanently 1, the 409 could never fire on the
        # change it was written for, and every re-hold silently orphaned a
        # draft. Amendment D exists to stop exactly that.
        reuse = previous.get("id") if previous.get("kind") == args.kind else None
        ask = build_ask(project, args, reuse_id=reuse)
        if reuse:
            ask["revision"] = int(previous.get("revision", 1)) + 1
        project["ask"] = ask
        if args.agent:
            project["stage"] = args.agent
        set_state(project, "held")
        write_state(state)
    print(f"{args.slug}: held on {ask['kind']} ({ask['id']} rev {ask['revision']})")
    return 0


def cmd_ready(args) -> int:
    with state_lock():
        state = load()
        project = project_for(state, args.slug)
        project["ask"] = None
        set_state(project, "ready")
        write_state(state)
    print(f"{args.slug}: ready to run")
    return 0


def cmd_clear(args) -> int:
    with state_lock():
        state = load()
        project = project_for(state, args.slug)
        project["ask"] = None
        if args.stages is not None:
            project["stageCount"] = args.stages
        set_state(project, "clear")
        add_history(project, "decision", "you signed off.")
        write_state(state)
    print(f"{args.slug}: clear")
    return 0


def cmd_stop(args) -> int:
    with state_lock():
        state = load()
        project = project_for(state, args.slug)
        project["stage"] = args.stage
        # A stopped project still carries an ask, because it still needs a
        # person: retry the stage, or close the project.
        project["ask"] = {
            "id": next_ask_id(project, "question"),
            "revision": 1,
            "kind": "question",
            "headline": f"{args.stage} stopped on {args.slug}",
            "from": args.stage,
            "at": utc_now(),
            "question": args.reason or f"{args.stage} did not finish. Nothing was written.",
            "options": [{"id": "o1", "label": "Retry the stage"},
                        {"id": "o2", "label": "Close the project"}],
        }
        set_state(project, "stopped")
        add_history(project, "stage", f"{args.stage} stopped", detail=args.detail,
                    stage=args.stage, event="failed")
        write_state(state)
    print(f"{args.slug}: stopped at {args.stage}")
    return 0


def cmd_note(args) -> int:
    with state_lock():
        state = load()
        project = project_for(state, args.slug)
        add_history(project, "decision", args.text, detail=args.detail,
                    quote=args.quote, event=args.event)
        write_state(state)
    print(f"{args.slug}: recorded")
    return 0


def cmd_forget(args) -> int:
    """Remove a project from the board entirely.

    Every other command records something. This one un-records, which is why it
    is the only command that asks before it acts: the register is a record, and
    a decision the operator made is not usually a thing to delete. It exists
    because a board also collects throwaway projects, and a register nobody
    trusts because it is full of abandoned rows is worse than a shorter one.

    Draining the project's answers first is deliberate. Removing the project
    while its responses sit unread in the inbox would leave the orchestrator
    holding decisions for something that no longer exists.
    """
    with state_lock():
        state = load()
        project = project_for(state, args.slug)
        events = len(project.get("history", []))
        if not args.yes:
            held = " It is waiting on you." if project.get("state") in ("held", "stopped") else ""
            plural = "" if events == 1 else "s"
            print(f"{args.slug}: {project.get('state')}, {events} recorded event{plural}.{held}")
            print("this removes it from the board and cannot be undone.")
            answer = input("type the slug to confirm: ").strip()
            if answer != args.slug:
                print("left alone")
                return 1
        state["projects"] = [x for x in state.get("projects", [])
                             if x.get("slug") != args.slug]
        write_state(state)

    stale = []
    if RESPONSES.is_dir():
        for path in RESPONSES.glob("*.json"):
            try:
                if json.loads(path.read_text(encoding="utf-8")).get("project") == args.slug:
                    stale.append(path)
            except ValueError:
                continue
    for path in stale:
        path.unlink()

    tail = ""
    if stale:
        tail = f", and {len(stale)} unread answer{'' if len(stale) == 1 else 's'} discarded"
    print(f"{args.slug}: forgotten, {events} event{'' if events == 1 else 's'}{tail}")
    return 0


def cmd_drain(args) -> int:
    """Read the answers the operator gave, oldest first.

    A response is staged under a `.partial` name before state.json moves, so
    one left behind means the write died early and the project it belongs to
    is still held. Replaying it would apply a decision the operator never
    completed, so it must not be drained.

    The glob below is what excludes them, because a staged file is named
    `.partial` rather than `.json`. The explicit name filter after it is
    redundant and is kept only as a guard against that naming changing.
    """
    if not RESPONSES.is_dir():
        print("nothing waiting")
        return 0
    files = sorted(p for p in RESPONSES.glob("*.json") if not p.name.endswith(".partial"))
    if not files:
        print("nothing waiting")
        return 0

    processed = RESPONSES / "processed"
    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except ValueError as err:
            print(f"{path.name}: unreadable, skipped ({err})", file=sys.stderr)
            continue
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print()
        if args.archive:
            processed.mkdir(parents=True, exist_ok=True)
            path.replace(processed / path.name)

    if args.archive:
        print(f"{len(files)} drained into {processed.as_posix()}", file=sys.stderr)
    else:
        print(f"{len(files)} waiting. re-run with --archive once acted on.",
              file=sys.stderr)
    return 0


def cmd_show(args) -> int:
    try:
        state = read_state()
    except StateUnreadable as err:
        fail(str(err))
    if state is None:
        print(f"no state file at {STATE.as_posix()}")
        return 0
    projects = state.get("projects", [])
    if not projects:
        print("no projects yet")
        return 0
    order = {s: i for i, s in enumerate(("held", "stopped", "running", "ready", "clear"))}
    for project in sorted(projects, key=lambda p: (order.get(p.get("state"), 9), p.get("slug", ""))):
        ask = project.get("ask") or {}
        tail = f"  {ask.get('headline', '')}" if ask else ""
        print(f"{project.get('slug', '?'):<18} {project.get('state', '?'):<10} "
              f"{project.get('stage', ''):<20}{tail}")
    held = sum(1 for p in projects if p.get("state") in ("held", "stopped"))
    print()
    print(f"{held} waiting on you" if held else "nothing is held")
    return 0


# ---- wiring -------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Record pipeline activity for the Handoff console.")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("start", help="a subagent was spawned")
    p.add_argument("slug"); p.add_argument("stage")
    p.set_defaults(func=cmd_start)

    p = sub.add_parser("finish", help="a subagent returned")
    p.add_argument("slug"); p.add_argument("stage")
    p.add_argument("--detail", help="a measured value, for example '12 files'")
    p.set_defaults(func=cmd_finish)

    p = sub.add_parser("hold", help="park the project on a decision")
    p.add_argument("slug")
    p.add_argument("--kind", required=True, choices=ASK_KINDS)
    p.add_argument("--headline", required=True)
    p.add_argument("--agent", help="the agent that produced it")
    p.add_argument("--meta", help="one line under the headline")
    p.add_argument("--doc", help="direction: markdown file to render")
    p.add_argument("--preview", help="build: http url to embed")
    p.add_argument("--changed", action="append", help="build: repeatable")
    p.add_argument("--findings", help="findings: json array file")
    p.add_argument("--to", help="findings: who they go back to")
    p.add_argument("--question", help="question: the question text")
    p.add_argument("--note", help="question: an optional second line")
    p.add_argument("--option", action="append", help="question: repeatable, two to four")
    p.set_defaults(func=cmd_hold)

    p = sub.add_parser("ready", help="answered, next stage not begun")
    p.add_argument("slug"); p.set_defaults(func=cmd_ready)

    p = sub.add_parser("clear", help="signed off")
    p.add_argument("slug"); p.add_argument("--stages", type=int)
    p.set_defaults(func=cmd_clear)

    p = sub.add_parser("stop", help="a stage failed")
    p.add_argument("slug"); p.add_argument("--stage", required=True)
    p.add_argument("--reason"); p.add_argument("--detail")
    p.set_defaults(func=cmd_stop)

    p = sub.add_parser("note", help="record an operator decision")
    p.add_argument("slug"); p.add_argument("text")
    p.add_argument("--quote", help="written feedback, verbatim")
    p.add_argument("--detail")
    p.add_argument("--event", choices=("returned",),
                   help="mark this decision as sending work back, which is "
                        "what redraws the thread from the builder column")
    p.set_defaults(func=cmd_note)

    p = sub.add_parser("forget", help="remove a project from the board")
    p.add_argument("slug")
    p.add_argument("--yes", action="store_true",
                   help="skip the confirmation, for scripts")
    p.set_defaults(func=cmd_forget)

    p = sub.add_parser("drain", help="read the answers inbox")
    p.add_argument("--archive", action="store_true",
                   help="move drained responses into responses/processed")
    p.set_defaults(func=cmd_drain)

    p = sub.add_parser("show", help="the board, as text")
    p.set_defaults(func=cmd_show)

    args = parser.parse_args()
    try:
        return args.func(args)
    except TimeoutError as err:
        fail(str(err))


if __name__ == "__main__":
    raise SystemExit(main())
