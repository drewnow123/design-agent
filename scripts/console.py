#!/usr/bin/env python3
"""Serve the Handoff console, and take the answers it collects.

The console is the surface for the one rule this pipeline actually runs on:
it never chains two agents back to back, so it spends most of its life parked
waiting for a person. This process is what lets that person unpark it from a
browser instead of from the terminal.

Two API routes, and nothing else:

    GET  /api/state      the contents of .handoff/state.json, or 404
    POST /api/respond    write a response, release the project, return state

Everything else is a static file out of work/agent-console/.

Usage:
    python scripts/console.py
    python scripts/console.py --port 8790

Run it from the repository root, the same way scripts/build.py is run. It
binds 0.0.0.0 so a phone on the same network can answer an ask, which is a
real case rather than a hypothetical one: the asks worth clearing from a
phone are the questions and the finding triage.

Two things here are load bearing and easy to get wrong.

Revision checking. Every ask carries a revision. The console sends the
revision it was displaying when the button was pressed, and this process
refuses the write with a 409 if state.json has moved on. Silently accepting
an approval of a document that has since been rewritten is the failure that
would make the whole tool untrustworthy, so it is a hard refusal rather than
a merge.

Atomic state writes. state.json is read by a poll every five seconds and is
also read by the orchestrator. A partially written file would be seen. The
new state goes to a temp file in the same directory and is then moved into
place with os.replace, which is atomic on both Windows and POSIX.

Standard library only, no dependencies, matching scripts/build.py.
"""

import argparse
import ipaddress
import json
import os
import re
import socket
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from handoff_state import (                                    # noqa: E402
    HANDOFF, RESPONSES, STATE, StateUnreadable, find_project,
    read_state, stamp as utc_stamp, state_lock, utc_now as utc_iso,
    write_state,
)

ROOT = Path("work/agent-console").resolve()

DEFAULT_PORT = 8790

# Hostnames allowed in addition to localhost and bare IP literals. Empty by
# default: a name only gets in when the operator names it with --allow-host.
ALLOWED_HOSTS = set()
MAX_BODY = 256 * 1024          # an ask response is text, not an upload

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".md": "text/plain; charset=utf-8",
}

SAFE_SLUG = re.compile(r"[^a-z0-9._-]+")

def lan_address() -> str:
    """Best guess at the address a phone on this network should be given.

    No packet is sent. Connecting a UDP socket only picks the route the OS
    would use, which is what makes it work on a machine with several
    interfaces where gethostbyname would return the wrong one.
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("10.255.255.255", 1))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def resolve_static(url_path: str):
    """Map a URL path to a file inside ROOT, or None.

    Returning None covers both "missing" and "outside the served directory".
    The check is done on the resolved path rather than on the string, because
    string checks for '..' miss encoded traversal and miss symlinks.
    """
    path = urllib.parse.urlparse(url_path).path
    path = urllib.parse.unquote(path)
    if path.endswith("/"):
        path += "index.html"
    candidate = (ROOT / path.lstrip("/")).resolve()
    try:
        candidate.relative_to(ROOT)
    except ValueError:
        return None
    if not candidate.is_file():
        return None
    return candidate


def decision_line(ask: dict, decision: str, payload: dict) -> str:
    """The register entry for a decision, in the operator's own vocabulary.

    Only three kinds of event are ever recorded, and this writes the third.
    """
    kind = ask.get("kind", "")
    if decision == "approve":
        if kind == "build":
            return "you approved the build"
        if kind == "direction":
            return "you approved the direction"
        return "you approved it"
    if decision == "changes":
        return "you sent it back"
    if decision == "send-findings":
        picked = len(payload.get("findings", []) or [])
        total = payload.get("of", picked)
        return f"you sent {picked} of {total} back to the builder"
    if decision == "close-review":
        return "you closed the review with nothing to fix"
    if decision == "answer":
        answer = payload.get("label") or payload.get("answer") or ""
        answer = str(answer).strip()
        if answer and len(answer) <= 48 and "\n" not in answer:
            return f"you answered: {answer}"
        return "you answered"
    return f"you responded: {decision}"


def apply_response(state: dict, project: dict, decision: str, payload: dict) -> dict:
    """Move the project from held to ready and record what was decided."""
    ask = project.get("ask") or {}
    now = utc_iso()

    entry = {
        "at": now,
        "kind": "decision",
        "text": decision_line(ask, decision, payload),
    }
    note = str(payload.get("note") or "").strip()
    if note and decision == "changes":
        entry["quote"] = note

    project.setdefault("history", []).append(entry)
    project["state"] = "ready"
    project["since"] = now
    project["ask"] = None
    state["generated"] = now
    return state


class Handler(BaseHTTPRequestHandler):
    server_version = "Handoff/1.0"
    protocol_version = "HTTP/1.1"

    # ---- plumbing -------------------------------------------------------

    def log_message(self, fmt, *args):
        # One quiet line per request. The default writes the client address
        # on every static asset, which buries the API calls worth seeing.
        sys.stderr.write("  %s %s\n" % (self.command, self.path))

    def handle_one_request(self):
        # A browser that cancels a preload mid-flight raises out of wfile.write
        # and the default handler prints a full traceback for it. That is a
        # normal event, not a fault, and a wall of traceback in the terminal
        # this tool sits next to would be worse than useless.
        try:
            super().handle_one_request()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            self.close_connection = True

    def host_allowed(self) -> bool:
        """Only a literal address or localhost may talk to this process.

        The server binds 0.0.0.0 so a phone can reach it, which also means any
        page in any browser on the network can. A DNS rebinding attack needs a
        hostname it controls to resolve here; refusing every Host that is not
        localhost or a bare IP takes that away. It costs nothing, because the
        two real ways in are both in that set.

        Serving from a hostname or behind a reverse proxy breaks that, because
        a proxy rewrites Host to its own name. Rather than dropping the check,
        --allow-host names the hostnames that are expected, which keeps every
        name nobody asked for out.
        """
        raw = (self.headers.get("Host") or "").strip()
        if not raw:
            return False
        host = raw.rsplit(":", 1)[0] if raw.count(":") == 1 else raw
        if host.startswith("["):                      # [::1]:8790
            host = host[1:].split("]")[0]
        host = host.strip().lower()
        if host in ("localhost", ""):
            return True
        if host in ALLOWED_HOSTS:
            return True
        try:
            ipaddress.ip_address(host)
            return True
        except ValueError:
            return False

    def send_json(self, status: int, payload) -> None:
        body = (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # The state is live by definition. Nothing about it may be cached.
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_plain(self, status: int, text: str) -> None:
        body = (text + "\n").encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ---- routes ---------------------------------------------------------

    def do_GET(self):
        if not self.host_allowed():
            self.send_json(403, {"error": "unrecognised Host header"})
            return

        route = urllib.parse.urlparse(self.path).path

        if route == "/api/state":
            try:
                state = read_state()
            except StateUnreadable as err:
                sys.stderr.write("  state.json unreadable: " + str(err) + chr(10))
                self.send_json(500, {"error": str(err)})
                return
            if state is None:
                # The console falls back to its sample file on a 404, and
                # says so in the footer rather than pretending it is live.
                self.send_json(404, {"error": "no state file at .handoff/state.json"})
                return
            self.send_json(200, state)
            return

        if route.startswith("/api/"):
            self.send_json(404, {"error": "no such route"})
            return

        target = resolve_static(route)
        if target is None:
            self.send_plain(404, "not found")
            return

        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type",
                         CONTENT_TYPES.get(target.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        if target.suffix == ".woff2":
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.host_allowed():
            self.send_json(403, {"error": "unrecognised Host header"})
            return

        route = urllib.parse.urlparse(self.path).path
        if route != "/api/respond":
            self.send_json(404, {"error": "no such route"})
            return

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            # The body is not being read, so it would otherwise be parsed as
            # the next request line on a keep-alive connection. Close instead.
            self.close_connection = True
            self.send_json(400, {"error": "body missing or too large"})
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self.send_json(400, {"error": "body is not json"})
            return

        # A body of [] or "x" is valid json and is not a mapping. Calling
        # .get() on it raised straight out of the handler, so the client got
        # no HTTP response at all rather than a 400.
        if not isinstance(payload, dict):
            self.send_json(400, {"error": "body must be a json object"})
            return

        slug = payload.get("project")
        ask_id = payload.get("askId")
        revision = payload.get("revision")
        decision = payload.get("decision")
        detail = payload.get("payload")
        if detail is None:
            detail = {}

        if not all(isinstance(v, str) and v for v in (slug, ask_id, decision)):
            self.send_json(400, {
                "error": "project, askId and decision are required strings"})
            return
        if not isinstance(detail, dict):
            self.send_json(400, {"error": "payload must be a json object"})
            return

        # Everything from here to the rename is one transaction against
        # state.json, so two responses arriving together cannot interleave.
        with state_lock():
            try:
                state = read_state()
            except StateUnreadable as err:
                sys.stderr.write("  state.json unreadable: " + str(err) + chr(10))
                self.send_json(500, {"error": str(err)})
                return

            if state is None:
                self.send_json(404, {"error": "no state file at .handoff/state.json"})
                return

            project = find_project(state, slug)
            if project is None:
                self.send_json(404, {"error": "no project named " + slug})
                return

            ask = project.get("ask")
            if not isinstance(ask, dict) or not ask:
                self.send_json(409, {
                    "error": "this project has no open ask. reload to see it."})
                return

            # The refusal that keeps the tool honest. The console answered a
            # specific revision of a specific ask, and only that one. An ask
            # carrying no revision is a mismatch rather than a wildcard:
            # letting None equal None would wave through every stale answer.
            ask_revision = ask.get("revision")
            if ask_revision is None or ask.get("id") != ask_id or ask_revision != revision:
                self.send_json(409, {"error": "this ask changed. reload to see it."})
                return

            record = {
                "at": utc_iso(),
                "project": slug,
                "askId": ask_id,
                "askKind": ask.get("kind"),
                "revision": revision,
                "decision": decision,
                "payload": detail,
            }

            # Three steps in this order, so no crash leaves the pair
            # inconsistent in the direction that matters. The response is
            # staged under a .partial name the orchestrator ignores, the state
            # moves, and only then does the response become visible. A crash
            # before the rename leaves a .partial and a project still held,
            # which is recoverable. The reverse, a response sitting in the
            # inbox for a project nobody released, is not.
            RESPONSES.mkdir(parents=True, exist_ok=True)
            safe = SAFE_SLUG.sub("-", slug.lower()) or "project"
            out = RESPONSES / (utc_stamp() + "-" + safe + ".json")
            staged = out.with_suffix(".partial")
            staged.write_text(json.dumps(record, indent=2, ensure_ascii=False) + chr(10),
                              encoding="utf-8", newline=chr(10))
            try:
                write_state(apply_response(state, project, decision, detail))
            except BaseException:
                staged.unlink(missing_ok=True)
                raise
            os.replace(staged, out)

        sys.stderr.write("  wrote " + str(out.relative_to(Path.cwd().resolve())) + chr(10))
        self.send_json(200, state)


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the Handoff console.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"port to bind (default {DEFAULT_PORT})")
    parser.add_argument("--host", default="0.0.0.0",
                        help="address to bind (default 0.0.0.0, all interfaces). "
                             "Use 127.0.0.1 to refuse everything but this machine.")
    parser.add_argument("--allow-host", action="append", default=[], metavar="NAME",
                        help="a hostname the Host header may carry, in addition to "
                             "localhost and bare IP addresses. Repeatable. Needed "
                             "when serving from a name or behind a reverse proxy.")
    args = parser.parse_args()

    ALLOWED_HOSTS.update(h.strip().lower() for h in args.allow_host if h.strip())

    if not ROOT.is_dir():
        print(f"console not found: {ROOT}", file=sys.stderr)
        print("run this from the repository root", file=sys.stderr)
        return 1

    HANDOFF.mkdir(parents=True, exist_ok=True)

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    held = 0
    # A broken state file is a thing to report and keep running through, not a
    # reason to die at startup with a raw traceback. The server still answers,
    # and /api/state returns the reason so the console can print it.
    try:
        state = read_state()
    except StateUnreadable as err:
        print(f"{STATE.name} is unreadable: {err}", file=sys.stderr)
        print("serving anyway. fix the file and the console picks it up.",
              file=sys.stderr)
        state = None
    else:
        if state is None:
            print(f"no {STATE.name} yet. the console will fall back to its sample file.")
        else:
            held = sum(1 for p in state.get("projects", []) if p.get("state") == "held")

    print(f"Handoff on http://127.0.0.1:{args.port}")
    print(f"           http://{lan_address()}:{args.port}   (phone, same network)")
    print(f"{held} held. responses land in {RESPONSES}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
