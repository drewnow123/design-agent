#!/usr/bin/env python3
"""Turn a console answer into a Claude Code turn.

The console writes an answer into `.handoff/responses/` and stops. Nothing
downstream of that directory is watching it, so a project stays `ready` until
a human takes a turn in an attached terminal. This is that watcher: it sees a
response land, wakes Claude Code headlessly in the repository root, and
supervises the run. No terminal, no laptop.

Python standard library only, matching the rest of the tooling.

    python scripts/runner.py --check     verify the CLI before installing
    python scripts/runner.py             run in the foreground
    python scripts/runner.py --once      handle what is waiting, then exit
"""

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HANDOFF = ROOT / ".handoff"
RESPONSES = HANDOFF / "responses"
LEDGER = HANDOFF / "runner-seen.json"

POLL_SECONDS = float(os.environ.get("HANDOFF_POLL_SECONDS", "2"))
RUN_TIMEOUT = int(os.environ.get("HANDOFF_RUN_TIMEOUT", "1800"))
CLAUDE = os.environ.get("HANDOFF_CLAUDE_BIN", "claude")

# What Claude should type to reach the state writer. The deployed box has no
# bare `python`, only `python3`, so a prompt naming `python` produces a stage
# that runs and then silently fails to record itself. This is also the string
# the allowlist in .claude/settings.json has to match, so the two have to be
# talked about together.
PY = os.environ.get("HANDOFF_PYTHON", "python" if os.name == "nt" else "python3")
PERMISSION_MODE = os.environ.get("HANDOFF_PERMISSION_MODE", "acceptEdits")
MAX_ATTEMPTS = int(os.environ.get("HANDOFF_MAX_ATTEMPTS", "2"))

# Flags this script actually passes. --check proves each one exists on the
# installed CLI rather than trusting that it does. Tool permissions live in
# .claude/settings.json, not here, because that surface is stable across CLI
# versions and the name of an allowlist flag is not.
REQUIRED_FLAGS = ["--print", "--output-format", "--resume", "--permission-mode"]

_stop = False


def log(msg):
    stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"{stamp} runner: {msg}", flush=True)


def utc_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_ledger():
    """Which response files have already been handed to Claude, and how often.

    The console never deletes from the inbox and `handoff.py drain --archive`
    is Claude's job rather than this script's, so a run that ends without
    archiving would otherwise re-fire the same answer forever. The ledger is
    the backstop: after MAX_ATTEMPTS a response is left alone and its project
    is marked stopped, which is a state the console already draws and already
    counts as needing a person.
    """
    if not LEDGER.exists():
        return {}
    try:
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        log("ledger unreadable, starting a fresh one")
        return {}


def write_ledger(seen):
    tmp = LEDGER.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(seen, indent=2), encoding="utf-8")
    os.replace(tmp, LEDGER)


def pending():
    """Response files waiting, oldest first.

    `.partial` means the console died mid-write. The contract says the project
    is still held and nothing needs replaying, so skip it by name.
    """
    if not RESPONSES.is_dir():
        return []
    out = [
        p for p in RESPONSES.iterdir()
        if p.is_file() and p.suffix == ".json" and not p.name.endswith(".partial")
    ]
    return sorted(out, key=lambda p: p.name)


def handoff(*args):
    """Call the state writer. It takes the cross-process lock, we do not."""
    return subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "handoff.py"), *args],
        cwd=ROOT, capture_output=True, text=True,
    )


def session_path():
    return HANDOFF / "runner-session"


def build_prompt(resp):
    """What Claude is woken up with.

    Deliberately thin. Everything durable already lives on disk: CLAUDE.md has
    the pipeline rules, state.json has where every project stands, and the
    direction documents are in work/. Restating any of that here would let the
    two copies drift.
    """
    slug = resp.get("project", "?")
    kind = resp.get("askKind", "?")
    decision = resp.get("decision", "?")
    note = (resp.get("payload") or {}).get("note")

    lines = [
        "An answer came in from the console. You are the orchestrator and no",
        "one is at a terminal, so act on it and leave the board correct.",
        "",
        f"  project   {slug}",
        f"  ask kind  {kind}",
        f"  decision  {decision}",
    ]
    if note:
        lines.append(f"  note      {note}")
    lines += [
        "",
        "Do this:",
        "",
        f"1. Run `{PY} scripts/handoff.py drain --archive` and read the answer",
        "   in full. That command is the contract, and it archives what it reads.",
        "2. Mark the stage you are about to run with `handoff.py start`.",
        "3. Do the work the decision asks for. The pipeline and its handoff",
        "   rules are in CLAUDE.md and they still apply: one stage, then stop.",
        "4. Record the outcome with `handoff.py finish`, then park the next",
        "   decision with `handoff.py hold` so it reaches the console.",
        "",
        "You cannot ask a follow-up question in prose here, because there is no",
        "one reading stdout. If you need something from Andrew, the only way to",
        "reach him is `handoff.py hold --kind question`. Use it rather than",
        "guessing, and rather than stopping silently.",
    ]
    return "\n".join(lines)


def run_claude(prompt):
    """One headless turn. Returns (ok, session_id, detail)."""
    cmd = [CLAUDE, "--print", prompt, "--output-format", "json",
           "--permission-mode", PERMISSION_MODE]

    prior = session_path()
    resumed = False
    if prior.exists():
        sid = prior.read_text(encoding="utf-8").strip()
        if sid:
            cmd[1:1] = ["--resume", sid]
            resumed = True

    log(f"claude starting ({'resumed' if resumed else 'new session'})")
    started = time.time()
    try:
        proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True,
                              timeout=RUN_TIMEOUT)
    except subprocess.TimeoutExpired:
        return False, None, f"timed out after {RUN_TIMEOUT}s"
    except FileNotFoundError:
        return False, None, f"{CLAUDE} is not on PATH"

    took = int(time.time() - started)
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()
        return False, None, f"exit {proc.returncode}: {tail[-1] if tail else 'no output'}"

    sid = None
    try:
        sid = json.loads(proc.stdout).get("session_id")
    except (ValueError, AttributeError):
        # A run that worked but printed something unexpected is still a run.
        # Losing the session id costs continuity, not correctness.
        log("could not read session_id from the output; the next run starts fresh")

    return True, sid, f"{took}s"


def handle(path, seen):
    name = path.name
    attempts = seen.get(name, {}).get("attempts", 0)
    if attempts >= MAX_ATTEMPTS:
        return

    try:
        resp = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError) as exc:
        log(f"{name} will not parse ({exc}); leaving it for a person")
        seen[name] = {"attempts": MAX_ATTEMPTS, "at": utc_now(), "error": str(exc)}
        write_ledger(seen)
        return

    slug = resp.get("project", "?")
    log(f"{name}: {resp.get('decision', '?')} on {slug}")

    seen[name] = {"attempts": attempts + 1, "at": utc_now()}
    write_ledger(seen)

    ok, sid, detail = run_claude(build_prompt(resp))

    if ok:
        if sid:
            session_path().write_text(sid, encoding="utf-8")
        log(f"{name}: done in {detail}")
        if path.exists():
            # Claude was told to archive. If it did not, say so plainly rather
            # than tidying up behind it: a silent fix here would hide a broken
            # prompt, and the same answer would replay on the next attempt.
            log(f"{name}: still in the inbox, claude did not archive it")
        return

    log(f"{name}: failed ({detail})")
    if attempts + 1 >= MAX_ATTEMPTS:
        stage = resp.get("askKind") or "component-builder"
        res = handoff("stop", slug, "--stage", stage)
        if res.returncode == 0:
            log(f"{slug}: marked stopped so the console shows it needs you")
        else:
            log(f"{slug}: could not mark stopped ({res.stderr.strip()})")


def check():
    """Prove the CLI supports what this script passes, before it is installed."""
    print(f"repository   {ROOT}")
    print(f"claude       {CLAUDE}")

    try:
        out = subprocess.run([CLAUDE, "--help"], capture_output=True, text=True,
                             timeout=30)
    except FileNotFoundError:
        print(f"\nFAIL  {CLAUDE} is not on PATH.")
        return 1
    except subprocess.TimeoutExpired:
        print(f"\nFAIL  {CLAUDE} --help did not return.")
        return 1

    help_text = out.stdout + out.stderr
    missing = [f for f in REQUIRED_FLAGS if f not in help_text]
    for flag in REQUIRED_FLAGS:
        print(f"  {'ok  ' if flag not in missing else 'MISS'} {flag}")

    writer = ROOT / "scripts" / "handoff.py"
    print(f"  {'ok  ' if writer.exists() else 'MISS'} scripts/handoff.py")
    print(f"  {'ok  ' if HANDOFF.is_dir() else 'MISS'} .handoff/")

    # The prompt tells Claude to type this. If it is not on PATH, every stage
    # runs and then fails to record itself, which looks like a hung board
    # rather than a missing interpreter.
    interpreter = shutil.which(PY)
    print(f"  {'ok  ' if interpreter else 'MISS'} {PY} on PATH"
          f"{'' if interpreter else '  <- the prompt tells claude to type this'}")

    if missing or not writer.exists() or not interpreter:
        print("\nFAIL  fix the above before installing the unit.")
        return 1
    print("\nok    safe to install.")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true",
                    help="verify the CLI and the layout, then exit")
    ap.add_argument("--once", action="store_true",
                    help="handle what is waiting, then exit")
    args = ap.parse_args()

    if args.check:
        return check()

    if not HANDOFF.is_dir():
        log(f"no {HANDOFF}; is this the repository root?")
        return 1

    RESPONSES.mkdir(parents=True, exist_ok=True)

    def on_signal(*_):
        global _stop
        _stop = True
        log("stopping after the current run")

    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)

    log(f"watching {RESPONSES}")
    while not _stop:
        seen = read_ledger()
        for path in pending():
            if _stop:
                break
            if seen.get(path.name, {}).get("attempts", 0) >= MAX_ATTEMPTS:
                continue
            handle(path, seen)
            seen = read_ledger()
        if args.once:
            return 0
        time.sleep(POLL_SECONDS)
    return 0


if __name__ == "__main__":
    sys.exit(main())
