#!/usr/bin/env python3
"""Serve work/ with content types this repository decides, not the host.

`python -m http.server` asks the machine's mime database what a file is. That
database is not part of this repository: it is the Python version, plus the
Windows registry or /etc/mime.types. Anything it does not recognise is served
as application/octet-stream, and a browser downloads that rather than showing
it.

Which makes the index's main verb environment dependent. Seven of its rows
point at .md files, and a locator you click that saves a file instead of
opening one is a broken link that looks like a working one. On the machine this
was written on, Python 3.14 knows .md and everything renders. On a Python that
does not, the same tree silently degrades for half the page.

So the types are pinned here. `scripts/console.py` already made this decision
for the same reason, serving .txt explicitly so the font licences render in a
browser rather than downloading, and this is that decision applied to the
preview tree.

Python standard library only.

    python scripts/preview.py                 serve work/ on 8788
    python scripts/preview.py --port 9000
"""

import argparse
import http.server
import socket
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work"

# Every extension this tree actually contains, and nothing speculative. A type
# guessed for a file that is not here is a guess nobody has checked.
#
# charset=utf-8 is on every text type deliberately. Without it a browser falls
# back to its own locale default, and a document containing a curly quote or a
# dash renders as mojibake on somebody else's machine.
TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".ico": "image/vnd.microsoft.icon",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler with the guessing taken out of it.

    guess_type is overridden rather than extensions_map being updated, because
    how http.server consults that map has changed across releases and the point
    of this file is to stop depending on the release.
    """

    def guess_type(self, path):
        suffix = Path(path).suffix.lower()
        if suffix in TYPES:
            return TYPES[suffix]
        return super().guess_type(path)

    def end_headers(self):
        # A preview server exists to show the last edit. A cached one shows the
        # edit before it, and the reader cannot tell the difference.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        # One line per request, without the date stamp http.server prefixes,
        # which is noise when this is running in a pane next to the page.
        print(f"  {self.address_string()} {fmt % args}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", type=int, default=8788)
    ap.add_argument("--host", default="0.0.0.0",
                    help="address to bind (default 0.0.0.0, all interfaces)")
    args = ap.parse_args()

    if not WORK.is_dir():
        print(f"no {WORK}; run this from the repository")
        return 1

    handler = lambda *a, **kw: Handler(*a, directory=str(WORK), **kw)  # noqa: E731
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer((args.host, args.port), handler) as httpd:
        print(f"work/ on http://127.0.0.1:{args.port}")
        try:
            lan = socket.gethostbyname(socket.gethostname())
            print(f"          http://{lan}:{args.port}")
        except OSError:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
