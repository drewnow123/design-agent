#!/usr/bin/env python3
"""Write work/index.html, the register of everything this pipeline has built.

The page it produces is a contents page: one line per project, its documents
hanging under that line, and a flush right column of real paths. The visual
direction is work/work-index-design/DIRECTION.md and its two amendments are in
work/work-index-design/DECISIONS.md.

Amendment A is the reason this file exists at all, and it also fixes the split
this script is built around:

    Structure is discovered. Prose is written.

Discovered here, by walking work/: which projects exist, which documents each
one has, what their paths are, how many findings are in a FINDINGS file, and
which project was written to most recently. Written by a person, in
work/index.json: the display names, the one or two sentence glosses, and the
occasional trailing clause on a document whose name is not enough.

The reason for the split is that the two halves rot on different clocks. The
structure changes on every brief, so a person maintaining it by hand would be
wrong more often than right, and a register that is usually wrong teaches its
reader to stop looking at it. The sentences change almost never, and no walk of
a directory tree will ever produce one worth reading.

Two rules follow from that and neither is negotiable:

  * A directory on disk that index.json says nothing about is still rendered,
    named from its slug, and this script says so on stdout. Dropping it would
    put the page below the autoindex it replaces, which at least never lies
    about what is there.
  * A slug in index.json with no directory on disk is an error. That is a
    sentence describing something that no longer exists, which is the same
    defect pointing the other way, and it fails loudly rather than quietly
    rendering a dead row.

Usage:
    python scripts/build-index.py            write work/index.html
    python scripts/build-index.py --check    verify, write nothing

Run it from anywhere; paths are resolved from this file. Standard library
only, no dependencies, matching scripts/handoff.py and scripts/console.py.
"""

import argparse
import html
import json
import os
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import quote, unquote

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work"
PROSE = WORK / "index.json"
OUT = WORK / "index.html"

# The foot line names this file, and it reads the name off this file rather
# than repeating it as a string, so renaming the script cannot make the page
# lie about who wrote it. It is stated relative to the repository root because
# that is where the command is run from, and it is resolved rather than
# prefixed, so a move cannot make it lie either.
try:
    GENERATOR = Path(__file__).resolve().relative_to(ROOT).as_posix()
except ValueError:  # run from a copy outside the repository
    GENERATOR = Path(__file__).name

# Directories under work/ that belong to this page rather than being projects
# of their own. fonts/ is the four woff2 files index.html loads.
NOT_PROJECTS = {"fonts"}

# A directory whose name is <slug><suffix> is not a project. It belongs to
# <slug>, and its own name never appears on the page except inside a path,
# because nobody arrives here wanting to learn that tool-library-design is a
# directory. The two modes differ in what actually becomes a line:
#
#   files      a folder of documents. Each document is its own attachment,
#              because each one is a thing you would open on its own.
#   directory  an instrument. The directory itself is one attachment, because
#              a line per file inside a test harness is noise.
#
# Order matters: it is the order the attachments appear in before index.json
# reorders them, and documents should precede the instrument that checks them.
SUFFIX_MODE = (("-design", "files"), ("-check", "directory"))

# A count appears only where the number is a fact about the work rather than a
# fact about the file, so exactly one kind of file gets one: a findings array,
# whose length is how much the reviewer found. Word counts, byte sizes and line
# counts are all available, all honest and all useless. Deriving it here is the
# point of amendment A's third row: this is the only number on the page, and it
# cannot drift from the file it describes because it is read out of it.
FINDINGS_RE = re.compile(r"^FINDINGS(-\d+)?\.json$")


def fail(message: str) -> None:
    print(f"build-index: {message}", file=sys.stderr)
    raise SystemExit(2)


# A note is a line this script prints about something it found on disk and
# could not be told about. The kind is carried alongside the sentence so the
# summary at the end can count each kind by its own name rather than calling
# all of them directories.
def add_note(notes: list, kind: str, text: str) -> None:
    notes.append((kind, text))


NOTE_LABELS = {
    "project": ("directory not in index.json", "directories not in index.json"),
    "attachment": ("document not in index.json", "documents not in index.json"),
    "loose": ("loose file under work/", "loose files under work/"),
    "count": ("findings file with no usable count", "findings files with no usable count"),
    "odd": ("entry that is neither a file nor a directory",
            "entries that are neither a file nor a directory"),
}


def summarise(notes: list) -> str:
    counts = Counter(kind for kind, _ in notes)
    parts = [f"{n} {NOTE_LABELS[kind][0 if n == 1 else 1]}"
             for kind, n in sorted(counts.items())]
    return ", ".join(parts) if parts else "nothing on disk is undescribed"


# ---- the keys a person may write ----------------------------------------

# Naming a file that does not exist is already a hard error. Misspelling
# 'gloss' is the same mistake pointing the other way: it deletes a sentence
# from a page nobody re-reads. Both fail here rather than one of them passing.
TOP_KEYS = {"_", "page", "projects"}
PAGE_KEYS = {"title", "lede", "description"}
PROJECT_KEYS = {"name", "gloss", "path", "attachments"}
DOC_KEYS = {"name", "clause"}


def check_keys(obj: dict, allowed: set, where: str) -> None:
    unknown = sorted(set(obj) - allowed)
    if not unknown:
        return
    fail(f"{where}: index.json has no key {', '.join(repr(k) for k in unknown)}. "
         f"the keys here are {', '.join(sorted(allowed))}. a typo would drop a "
         "written sentence silently, which is the one thing this page must not do.")


# ---- the prose file -----------------------------------------------------

def load_prose() -> dict:
    if not PROSE.exists():
        fail(f"no {PROSE.relative_to(ROOT).as_posix()}. it holds the sentences; "
             "the structure comes from disk, but the sentences cannot.")
    try:
        data = json.loads(PROSE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        fail(f"{PROSE.relative_to(ROOT).as_posix()} will not parse: {err}")
    if not isinstance(data, dict):
        fail("index.json must be an object with 'page' and 'projects'.")
    check_keys(data, TOP_KEYS, "index.json")
    for key in ("page", "projects"):
        if not isinstance(data.get(key), dict):
            fail(f"index.json needs an object at '{key}'.")
    check_keys(data["page"], PAGE_KEYS, "index.json 'page'")
    return data


# ---- inline prose -------------------------------------------------------

# The glosses need two inline forms and no more: a machine literal, which is
# set in the mono face because that is the third voice, and a link. Anything
# richer would be a markdown renderer, and there is already a hand written one
# in the console that exists for a reason this page does not share.
INLINE_RE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`")


def inline(text: str, where: str, allow_links: bool = True) -> str:
    """Escape a written string and render its two inline forms."""
    out = []
    at = 0
    for m in INLINE_RE.finditer(text):
        out.append(html.escape(text[at:m.start()]))
        if m.group(3) is not None:
            out.append('<span class="lit">' + html.escape(m.group(3)) + "</span>")
        else:
            if not allow_links:
                # Section 4.4 of the direction expects a link to be possible
                # inside an attachment clause, but section 4.2 makes the whole
                # row one link, and an anchor inside an anchor is not a thing a
                # browser will keep. Refusing here is better than emitting
                # markup that silently reparents itself.
                fail(f"{where}: a link cannot go in a clause, because the whole "
                     "row is already one link.")
            label = inline(m.group(1), where, allow_links=False)
            out.append(f'<a href="{html.escape(m.group(2))}">{label}</a>')
        at = m.end()
    out.append(html.escape(text[at:]))
    return "".join(out)


def flatten(text: str) -> str:
    """The same string with its markup removed, for an accessible name."""
    return INLINE_RE.sub(lambda m: m.group(3) if m.group(3) is not None else m.group(1), text)


# ---- discovery ----------------------------------------------------------

def title_from(stem: str) -> str:
    """A name for something index.json did not name. Deliberately plain: it
    should read as a fallback rather than pass for a written one."""
    words = stem.replace("_", "-").replace(".", " ").split("-")
    return " ".join(w for w in words if w).capitalize()


def _git(*args):
    """Run git at the repository root, or return None if there is no answer.

    None means git is not installed, this is not a repository, or the command
    failed. Every caller falls back to the filesystem in that case, so the page
    still builds from a plain unzipped copy of the tree.
    """
    try:
        proc = subprocess.run(["git", "-C", str(ROOT), *args],
                              capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.SubprocessError):
        return None
    return proc.stdout if proc.returncode == 0 else None


_DIRTY = []


def git_dirty():
    """Repository relative paths git does not have a committed record of.

    These are the files whose only date is the one on disk, which is the right
    date for them: they are the work in progress.
    """
    if not _DIRTY:
        out = _git("status", "--porcelain", "-z", "--untracked-files=all")
        if out is None:
            _DIRTY.append(None)
        else:
            paths = set()
            for record in out.split("\0"):
                if not record:
                    continue
                paths.add(record[3:] if record[2:3] == " " else record)
            _DIRTY.append(frozenset(paths))
    return _DIRTY[0]


def files_under(paths):
    """(path, repository relative path) for every file under these paths."""
    for path in paths:
        if path.is_file():
            yield path, path.resolve().relative_to(ROOT).as_posix()
        elif path.is_dir():
            for base, _dirs, names in os.walk(path):
                for name in names:
                    entry = Path(base) / name
                    try:
                        yield entry, entry.resolve().relative_to(ROOT).as_posix()
                    except ValueError:
                        continue


def newest_write(paths) -> float:
    """When this project was last written to.

    Git's record first, the disk second, and that order matters. A clone or a
    checkout stamps every file with the moment it landed, so mtime alone makes
    'most recently written first' mean 'whatever order the tar came out in' on
    any machine but the one the work was done on, and it makes --check report a
    page as out of date for no reason but a re-stamped disk. The commit that
    last touched a project is the durable answer and it travels with the
    repository.

    Uncommitted files keep their mtime, because for them the disk is the only
    record there is, and they are exactly the ones being worked on now.
    """
    dirty = git_dirty()
    if dirty is None:
        return newest_mtime(paths)

    rels = []
    for path in paths:
        try:
            rels.append(path.resolve().relative_to(ROOT).as_posix())
        except ValueError:
            continue
    best = 0.0
    if rels:
        out = _git("log", "-1", "--format=%ct", "--", *rels)
        if out and out.strip():
            best = float(out.strip())
    for path, rel in files_under(paths):
        if rel in dirty:
            try:
                best = max(best, path.stat().st_mtime)
            except OSError:
                pass
    return best


def newest_mtime(paths) -> float:
    """The most recent write anywhere under these paths.

    Directory mtimes are not enough: on Windows a directory's mtime only moves
    when an entry is added or removed, so editing a document in place would not
    change the order at all. This walks to the files.
    """
    best = 0.0
    for path in paths:
        if path.is_file():
            best = max(best, path.stat().st_mtime)
            continue
        if not path.is_dir():
            continue
        best = max(best, path.stat().st_mtime)
        for base, _dirs, files in os.walk(path):
            for name in files:
                try:
                    best = max(best, (Path(base) / name).stat().st_mtime)
                except OSError:
                    pass
    return best


def findings_count(path: Path, notes: list):
    """How many findings are in a findings file, or None if it will not say.

    A count is the one decorative thing on this page, and a reviewer writes
    these files, so a malformed one is a normal failure rather than an
    exceptional one. Aborting the regeneration over it would leave the whole
    index stale and quietly wrong to save a number, which is a bad trade: the
    row still renders, it renders without its count, and the reason is printed.
    """
    rel = path.relative_to(WORK).as_posix()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        add_note(notes, "count", f"{rel} will not parse, so it gets no count: {err}")
        return None
    if not isinstance(data, list):
        add_note(notes, "count", f"{rel} is not a json array, so it gets no count.")
        return None
    return len(data)


def discover(prose: dict, notes: list) -> list:
    """Every project under work/, most recently written first.

    Returns a list of dicts: slug, dirname (or None), attachments (a list of
    dicts with rel, is_dir and count), and mtime.

    Nothing under work/ leaves this function unaccounted for. What cannot
    become a line on the page becomes a line on stdout instead, because the
    autoindex this page replaced at least never lied about what was there, and
    a register that quietly omits things is worse than the listing it replaced.
    """
    if not WORK.is_dir():
        fail("no work/ directory.")

    names = []
    for entry in sorted(WORK.iterdir()):
        if entry.name.startswith("."):
            continue
        if entry.is_dir():
            if entry.name not in NOT_PROJECTS:
                names.append(entry.name)
            continue
        # A file sitting directly under work/ is not a project and cannot be
        # made into one, but the page should not imply it is not there.
        # index.html is this script's output and index.json is its input, so
        # neither of those is news; anything else gets a line.
        if entry not in (OUT, PROSE):
            add_note(notes, "loose", f"{entry.name}: a file directly under work/, "
                     "not a project, so it is not on the page.")

    own = []       # slugs that have a directory of their own, in disk order
    holders = {}   # slug -> [(rank, dirname, mode)]
    for name in names:
        for rank, (suffix, mode) in enumerate(SUFFIX_MODE):
            if name.endswith(suffix) and len(name) > len(suffix):
                holders.setdefault(name[:-len(suffix)], []).append((rank, name, mode))
                break
        else:
            own.append(name)

    # A slug can be attested by its own directory, by an attached sibling, or
    # by both. work-index is the third case in reverse: it has a -design
    # sibling and no directory, because its build output is index.html itself,
    # which sits at the root of work/ rather than in a folder. That project is
    # still real and dropping it would hide work-index-design/ from the page.
    slugs = list(own) + [s for s in holders if s not in own]

    projects = []
    for slug in slugs:
        attachments = []
        roots = []
        if slug in own:
            roots.append(WORK / slug)
        for _rank, dirname, mode in sorted(holders.get(slug, [])):
            roots.append(WORK / dirname)
            if mode == "directory":
                attachments.append({"rel": dirname + "/", "is_dir": True, "count": None})
                continue
            for entry in sorted((WORK / dirname).iterdir()):
                if entry.name.startswith("."):
                    continue
                if entry.is_dir():
                    # A folder inside a folder of documents is one attachment,
                    # not a line for each file in it. That is the judgment a
                    # -check directory already gets and for the same reason: it
                    # is a thing you open, not a set of documents you read one
                    # at a time, and the trailing slash says so. The other
                    # options were to walk into it, which would put a page of
                    # screenshots on the register, or to drop it, which
                    # amendment A does not allow.
                    attachments.append({"rel": f"{dirname}/{entry.name}/",
                                        "is_dir": True, "count": None})
                    continue
                if not entry.is_file():
                    add_note(notes, "odd", f"{dirname}/{entry.name} is neither a file "
                             "nor a directory, so there is no honest row for it.")
                    continue
                count = findings_count(entry, notes) if FINDINGS_RE.match(entry.name) else None
                attachments.append({"rel": f"{dirname}/{entry.name}", "is_dir": False, "count": count})
        # index.html is excluded from the ordering on purpose. It is this
        # script's own output, so counting it would put whichever project owns
        # it at the top forever and would change the page's order on every run,
        # which is the opposite of safe to run repeatedly. What is not
        # excluded, and used to be missed, is the file that writes it: the one
        # project whose build output is this page is built from a script that
        # lives outside work/, so a walk of work/ alone cannot see any work
        # done on it and it sinks down a list ordered by recency of work. The
        # locator in index.json is what identifies it, so nothing here has to
        # be kept in step by hand.
        if (prose["projects"].get(slug) or {}).get("path") == OUT.name:
            roots.append(Path(__file__).resolve())

        projects.append({
            "slug": slug,
            "dirname": slug if slug in own else None,
            "attachments": attachments,
            "mtime": newest_write(roots),
        })

    # Ordering is information: most recently written first, never alphabetical.
    # Alphabetical is the machine's order and it is the order the directory
    # listing this page replaces already had. The slug breaks ties so that two
    # projects written in the same second still render in a stable order.
    projects.sort(key=lambda p: (-p["mtime"], p["slug"]))
    return projects


# ---- merging discovery with prose ---------------------------------------

def build_model(prose: dict, found: list, notes: list) -> dict:
    written = prose["projects"]
    known = {p["slug"] for p in found}

    for slug in written:
        if slug not in known:
            fail(f"index.json describes '{slug}', and there is no such directory "
                 f"under work/. a stale entry is worse than a missing one.")

    entries = []
    for project in found:
        slug = project["slug"]
        said = written.get(slug)
        if said is None:
            add_note(notes, "project",
                     f"{slug}: nothing in index.json. named from the slug, no gloss.")
            said = {}
        if not isinstance(said, dict):
            fail(f"index.json entry for '{slug}' must be an object.")
        check_keys(said, PROJECT_KEYS, f"index.json '{slug}'")

        if project["dirname"]:
            path = project["dirname"] + "/"
            if said.get("path") and said["path"] != path:
                fail(f"'{slug}' has a directory, so its path is {path} and "
                     f"index.json must not override it with {said['path']}.")
        else:
            # No directory of its own, so disk cannot supply the locator and
            # the prose file has to. It is still checked against disk below.
            path = said.get("path")
            if not path:
                fail(f"'{slug}' has no directory of its own, only an attached "
                     "sibling. index.json must give it a 'path' naming the file "
                     "it built.")

        check_path(path, slug)

        docs = said.get("attachments") or {}
        if not isinstance(docs, dict):
            fail(f"index.json 'attachments' for '{slug}' must be an object keyed by path.")
        discovered = {a["rel"]: a for a in project["attachments"]}
        for rel in docs:
            if rel not in discovered:
                fail(f"index.json describes '{rel}' under '{slug}', and there is "
                     "no such file or directory.")

        # Written order first, because the order five documents are read in is
        # an editorial fact, then whatever else is on disk, so nothing is lost.
        ordered = [discovered[rel] for rel in docs if rel in discovered]
        for attachment in project["attachments"]:
            if attachment["rel"] not in docs:
                add_note(notes, "attachment",
                         f"{slug}: {attachment['rel']} is not in index.json. "
                         "named from the filename, no clause.")
                ordered.append(attachment)

        rendered_docs = []
        for attachment in ordered:
            said_doc = docs.get(attachment["rel"]) or {}
            if not isinstance(said_doc, dict):
                fail(f"index.json entry for '{attachment['rel']}' must be an object.")
            check_keys(said_doc, DOC_KEYS, f"index.json '{attachment['rel']}'")
            rel = attachment["rel"]
            check_path(rel, slug)
            base = rel.rstrip("/").rsplit("/", 1)[-1]
            name = said_doc.get("name") or title_from(base if attachment["is_dir"] else Path(base).stem)
            rendered_docs.append({
                "name": name,
                "clause": said_doc.get("clause"),
                "rel": rel,
                "count": attachment["count"],
            })

        entries.append({
            "slug": slug,
            "name": said.get("name") or title_from(slug),
            "gloss": said.get("gloss"),
            "path": path,
            # A project whose build output is this page gets aria-current, so a
            # screen reader is told the one row that points at where it already
            # is. Derived, not written: the output path is not a fact anybody
            # should have to keep in step by hand.
            "current": (WORK / path) == OUT,
            "docs": rendered_docs,
        })

    return {"page": prose["page"], "entries": entries}


def check_path(rel: str, slug: str) -> None:
    """Every path on this page is complete, real, and says what it is by its
    last character. A trailing slash is the entire taxonomy: a path ending in
    one is something you open, a path ending in a filename is something you
    read. There is no second signal, so this one has to be true."""
    target = WORK / rel.rstrip("/")
    # The one path this script does not have to find on disk is its own output,
    # because on a first run it is about to create it. Vouching for it here is
    # honest in a way that skipping the check would not be: after this run it
    # is a real file, and if the write fails nothing is served either.
    if target == OUT:
        return
    if rel.endswith("/"):
        if not target.is_dir():
            fail(f"'{slug}': {rel} ends in a slash and is not a directory.")
    else:
        if not target.is_file():
            fail(f"'{slug}': {rel} does not end in a slash and is not a file.")


# ---- the page -----------------------------------------------------------

CSS = """
/* Builds: the register of work/.
 *
 * One rule runs through this file: a line on this page does a job or it is
 * not drawn. The leader ties a name to its path and expresses rank by its
 * indent; the single rule under the head separates the page's own voice from
 * the register. There is no third line, no card, no shadow and no elevation
 * token, because this page holds no objects. It is a surface you read and
 * leave. The console at work/agent-console/ is the surface that holds things,
 * and its furniture belongs there.
 *
 * Spacing is the console's six steps: 4 / 8 / 14 / 22 / 36 / 56.
 * The focus ring is an outline, never a shadow.
 */

/* ---------------------------------------------------------------- fonts */

/* Three voices. The system speaks in one, documents speak in another, and
   machine literals speak in a third. A DIRECTION.md is titled in Newsreader
   because it is a document; a project is named in Instrument Sans because the
   page is naming it; every path is Geist Mono because a path is a literal.
   That is the whole taxonomy, and it is why no icon is needed or allowed.

   The italic is not loaded. Nothing on this page is set in it. */

@font-face {
  font-family: "Instrument Sans";
  src: url("fonts/instrument-sans-var-latin.woff2") format("woff2");
  font-weight: 400 700;
  font-stretch: 75% 100%;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Newsreader";
  src: url("fonts/newsreader-var-latin.woff2") format("woff2");
  font-weight: 380 700;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Geist Mono";
  src: url("fonts/geist-mono-var-latin.woff2") format("woff2");
  font-weight: 400 500;
  font-style: normal;
  font-display: swap;
}

/* The four metric matched fallbacks, copied verbatim out of
   work/agent-console/styles.css rather than re-derived. Every number was read
   out of the head, hhea and OS/2 tables of the real font files, so a swap does
   not move a row. */

@font-face {
  font-family: "Instrument Fallback";
  src: local("Segoe UI"), local("Helvetica Neue"), local("Arial");
  size-adjust: 102.0%;      /* Instrument Sans x 51.00 over Segoe UI x 50.00 */
  ascent-override: 95.10%;  /* 97.00 over 1.020 */
  descent-override: 24.51%; /* 25.00 over 1.020 */
  line-gap-override: 0%;
}

@font-face {
  font-family: "Newsreader Fallback";
  src: local("Georgia"), local("Times New Roman");
  size-adjust: 88.49%;      /* Newsreader x 42.60 over Georgia x 48.14 */
  ascent-override: 83.06%;  /* 73.50 over 0.8849 */
  descent-override: 29.95%; /* 26.50 over 0.8849 */
  line-gap-override: 0%;
}

@font-face {
  font-family: "Newsreader Fallback";
  src: local("Georgia Italic"), local("Times New Roman Italic");
  font-style: italic;
  size-adjust: 88.49%;
  ascent-override: 83.06%;
  descent-override: 29.95%;
  line-gap-override: 0%;
}

@font-face {
  font-family: "Geist Fallback";
  src: local("Consolas"), local("SF Mono"), local("Menlo");
  size-adjust: 108.12%;     /* Geist Mono x 53.00 over Consolas x 49.02 */
  ascent-override: 92.95%;  /* 100.50 over 1.0812 */
  descent-override: 27.28%; /* 29.50 over 1.0812 */
  line-gap-override: 0%;
}

/* --------------------------------------------------------------- tokens */

/* The console's neutrals, taken verbatim. Two surfaces of one tool with
   different greens would be a defect. Only the tokens this page uses are
   declared, so the ones it must not use cannot be reached for: there is no
   elevation scale here, no radius above 8px, no spring and no attention hue.
   Nothing on this page ever needs doing, so the colour that means your move
   is not spent here. */

:root {
  --s1: 4px;
  --s2: 8px;
  --s3: 14px;
  --s4: 22px;
  --s5: 36px;
  --s6: 56px;

  --r-2: 8px;
  --indent: 24px;

  /* Not the console's 1240px. A leader running that far stops being a leader
     and becomes a road, and these are one line entries with nothing to fill
     the width with. */
  --column: 820px;

  --font-system: "Instrument Sans", "Instrument Fallback", system-ui, sans-serif;
  --font-doc: "Newsreader", "Newsreader Fallback", Georgia, serif;
  --font-mono: "Geist Mono", "Geist Fallback", ui-monospace, monospace;

  /* Every weight steps down by 20 units in dark mode. Light text on a dark
     ground reads optically heavier, and a variable axis is the honest way to
     pay for that rather than jumping to the next named weight. */
  --w-reg: 430;
  --w-med: 520;
  --w-strong: 600;
  --w-doc: 390;

  /* dark, designed first */
  --bg: #0B0F0E;
  --surface-1: #121716;
  --ink: #E6EDEB;
  --ink-2: #A2ADAA;
  --ink-3: #7C8783;
  --rule: #222A28;
  --rule-strong: #333E3B;
  --live: #45DDD0;

  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --t-quick: 140ms;

  color-scheme: dark;
}

/* Light, reached two ways from one set of values. An explicit choice is an
   attribute on <html>; no attribute at all means nobody has chosen one, and
   then the machine's own preference decides. Writing it this way is what makes
   the page right with JavaScript switched off, where the attribute is never
   set. The markup used to carry data-theme="dark" instead, so a machine that
   prefers light was served a dark page and, with no script running, no way
   back. */

:root[data-theme="light"] {
__LIGHT__
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
__LIGHT2__
  }
}

/* ----------------------------------------------------------------- base */

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  background: var(--bg);
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-system);
  font-size: 16px;
  font-optical-sizing: auto;
  font-synthesis-weight: none;
  font-variation-settings: "wght" var(--w-reg), "wdth" 100;
}

.page {
  max-width: var(--column);
  margin: 0 auto;
  padding: var(--s6) var(--s4) 0;
}

/* ------------------------------------------------------------ page head */

/* Three elements and no more: the title, one sentence, and a hairline. No
   search field with ten things to search, no project count, no date claiming
   a freshness the file does not have. */

.head {
  padding-bottom: var(--s4);
  border-bottom: 1px solid var(--rule);
}

h1 {
  margin: 0;
  font-size: 28px;
  line-height: 34px;
  letter-spacing: -0.018em;
  font-variation-settings: "wght" var(--w-strong), "wdth" 100;
}

.lede {
  margin: var(--s3) 0 0;
  max-width: 60ch;
  font-family: var(--font-doc);
  font-size: 17px;
  line-height: 1.6;
  font-variation-settings: "wght" var(--w-doc);
}

/* A literal inside a sentence is still a literal, so it takes the third
   voice, at the size that keeps its x height level with the serif around it. */
.lit {
  font-family: var(--font-mono);
  font-size: 0.9em;
  font-variation-settings: "wght" 400;
}

/* The console's link rule, unchanged, and it applies only inside prose. A row
   cannot take it, because a horizontal line already runs through every row and
   a second one would be mud. */
.lede a,
.gloss a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 0.12em;
  text-decoration-thickness: from-font;
}

/* ------------------------------------------------------------- register */

.register {
  list-style: none;
  margin: var(--s5) 0 0;
  padding: 0;
}

.project + .project {
  margin-top: var(--s5);
}

/* The documents are a real nested list inside their project's item, so the
   parent and child relation that is the whole claim of this page reaches a
   screen reader rather than being implied by padding. */
.docs {
  list-style: none;
  margin: var(--s3) 0 0;
  padding: 0 0 0 var(--indent);
}

.gloss {
  margin: var(--s2) 0 0 var(--indent);
  max-width: 60ch;
  font-family: var(--font-doc);
  font-size: 17px;
  line-height: 1.6;
  font-variation-settings: "wght" var(--w-doc);
}

/* ------------------------------------------------------------- the rows */

/* Name at the left, leader, path flush right. The row is one link and the
   negative inline margin is what lets its hover fill breathe past the text
   without moving the flush column off the edge of the measure. */

.row {
  display: flex;
  /* Never between the items. Wrapping here is what left a leader alone on the
     first line, running to the right margin and ending in nothing, with its
     path underneath it: measured at every width from 621px to 758px on the
     one row long enough to trigger it. A name or a clause that runs out of
     room now wraps inside itself, the leader stays tied to the first line it
     was drawn on and the path stays flush right, which is what a contents page
     has always done with a long title. The two line collapse below 620px is a
     decision, so it is made once by the media query rather than by whatever
     the longest row happens to measure. */
  flex-wrap: nowrap;
  align-items: baseline;
  gap: var(--s2);
  padding: var(--s1) var(--s2);
  margin-inline: calc(var(--s2) * -1);
  color: inherit;
  text-decoration: none;
  border-radius: var(--r-2);
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition:
    background-color var(--t-quick) var(--ease-standard),
    outline-color var(--t-quick) var(--ease-standard);
}

/* Two signals on interaction and one of them is independent of colour. Rows
   do not lift: a page of hairline rows that bounce under the mouse feels
   loose, and nothing here is an object to be picked up. */
.row:hover,
.row:focus-visible {
  background-color: var(--surface-1);
}

.row:focus-visible {
  outline-color: var(--live);
}

.row:hover .name,
.row:focus-visible .name {
  text-decoration: underline;
  text-underline-offset: 0.12em;
  text-decoration-thickness: from-font;
}

.name {
  font-size: 16.5px;
  line-height: 22px;
  letter-spacing: -0.006em;
  font-variation-settings: "wght" var(--w-med), "wdth" 100;
  /* The name can always give way in the end. Refusing to let it shrink keeps
     it on one line under pressure, and it was tried, but then a long name
     beside a long path pushes the path off the edge and the page scrolls
     sideways, which is worse than a name on two lines: the path is the
     locator and it is the reason the row is there. So the name shrinks last
     (see .clause) rather than never. */
  min-width: 0;
  overflow-wrap: anywhere;
}

/* aria-current tells a screen reader which row points at the page it is
   already on. This is the sighted half of the same sentence: one step up the
   weight scale the page already holds, which is how a contents page marks the
   sheet you are standing on. Not a badge, not a dot, not a second colour and
   not an icon, because none of those are available here. */
.row[aria-current="page"] .name {
  font-variation-settings: "wght" var(--w-strong), "wdth" 100;
}

/* A document is titled in the document face, because it is a document. */
.row-doc .name {
  font-family: var(--font-doc);
  font-size: 15.5px;
  line-height: 22px;
  letter-spacing: normal;
  font-variation-settings: "wght" var(--w-doc);
  color: var(--ink-2);
}

.clause {
  font-family: var(--font-doc);
  font-size: 15.5px;
  line-height: 22px;
  font-variation-settings: "wght" var(--w-doc);
  color: var(--ink-3);
  min-width: 0;
  /* The clause gives way before the name does. Flex shares a shortfall in
     proportion to width as well as to weight, so an ordinary weight would
     take a quarter of it out of the name and break a two word title in half
     while its own supporting clause sat on one line. At this weight the name
     keeps its width until the clause has given up everything it has, and only
     then starts wrapping itself. */
  flex-shrink: 1000;
}

.count {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 18px;
  font-variation-settings: "wght" 400;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

/* The leader is furniture and is declared as such: it carries nothing the
   name at its left and the path at its right do not already carry. Aligned to
   the baseline with no height of its own, so the hairline lands on the same
   line the two texts sit on and ties them together rather than crossing them. */
.leader {
  flex: 1 1 var(--s4);
  min-width: var(--s4);
  height: 0;
  align-self: baseline;
  border-bottom: 1px solid var(--rule-strong);
}

/* One string, never truncated, always copy pasteable. The filenames end flush
   right and the dim directory prefixes trail ragged to the left of them, which
   reads correctly and keeps every path complete. */
.path {
  flex: 0 0 auto;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 18px;
  font-variation-settings: "wght" 400;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}

.path .dir {
  color: var(--ink-3);
}

/* ------------------------------------------------------------- the foot */

.foot {
  max-width: var(--column);
  margin: 0 auto;
  padding: var(--s5) var(--s4) var(--s6);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3) var(--s4);
  font-size: 13px;
  line-height: 18px;
  letter-spacing: 0.004em;
  font-variation-settings: "wght" var(--w-reg), "wdth" 96;
  color: var(--ink-3);
}

.colophon {
  margin: 0;
  max-width: 60ch;
}

/* Without JavaScript this control cannot do anything, so without JavaScript
   it is not drawn. The boot script sets the class in the head, before the body
   is parsed, so nothing appears and then disappears. */
.theme {
  display: none;
  align-items: baseline;
  gap: var(--s1);
}

:root.js .theme {
  display: flex;
}

/* Plain text, at the foot, never a floating icon button. */
.themebtn {
  appearance: none;
  background: none;
  border: 0;
  margin: 0;
  padding: var(--s1);
  font: inherit;
  font-family: var(--font-system);
  font-variation-settings: "wght" var(--w-reg), "wdth" 96;
  color: inherit;
  cursor: pointer;
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color var(--t-quick) var(--ease-standard);
}

.themebtn[aria-pressed="true"] {
  color: var(--ink-2);
}

.themebtn:hover,
.themebtn:focus-visible {
  text-decoration: underline;
  text-underline-offset: 0.12em;
  text-decoration-thickness: from-font;
}

.themebtn:focus-visible {
  outline-color: var(--live);
}

/* ------------------------------------------------------------- narrower */

/* Below 620px the leader has no room and is cut. The row becomes two lines,
   the path sitting under the name at the name's own indent, both flush left.
   A flush right path with two inches of nothing between it and its name reads
   as a bug rather than as a leader that lost its rule. */

@media (max-width: 620px) {
  :root {
    --indent: 12px;
  }

  .page {
    padding-top: var(--s5);
  }

  .leader {
    display: none;
  }

  .path {
    flex: 0 0 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .row {
    flex-wrap: wrap;
    min-height: 48px;
    align-content: center;
    padding-block: var(--s2);
  }

  /* The two buttons are the only controls here that are not links, and they
     were the smallest thing to press on a page where everything else had
     already been given a 48px target. */
  .theme {
    align-items: center;
  }

  .themebtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    min-width: 48px;
    padding-inline: var(--s2);
  }

  .lede,
  .gloss {
    max-width: none;
    font-size: 16px;
  }

  .row-doc .name,
  .clause {
    font-size: 16px;
  }
}
"""

# The light tokens are written once here and land in the stylesheet twice,
# under an explicit choice and under the machine's own preference, so the two
# cannot drift apart.
LIGHT = """  --bg: #EDF1EF;
  --surface-1: #F6F9F8;
  --ink: #101614;
  --ink-2: #424D4A;
  --ink-3: #5F6C68;
  --rule: #DBE3DF;
  --rule-strong: #C3CCC8;
  --live: #0E7C74;

  --w-reg: 450;
  --w-med: 540;
  --w-strong: 620;
  --w-doc: 400;

  color-scheme: light;"""

CSS = CSS.replace("__LIGHT__", LIGHT).replace(
    "__LIGHT2__",
    "\n".join(("  " + line if line.strip() else line)
                  for line in LIGHT.splitlines()))


BOOT = """
  // Resolve the theme before first paint so the page never flashes the wrong
  // ground. Reads only localStorage and the OS preference.
  //
  // The key is `handoff.theme` and the values are `light` and `dark`, which is
  // exactly what work/agent-console/app.js writes. The two surfaces are served
  // from the same origin, so sharing the key means they agree on theme instead
  // of disagreeing across a click.
  (function () {
    var root = document.documentElement;
    // The theme control is drawn only where it can work, and this runs before
    // the body is parsed, so it never appears and then goes away.
    root.className = "js";
    var saved = null;
    try { saved = localStorage.getItem("handoff.theme"); } catch (e) { saved = null; }
    if (saved === "light" || saved === "dark") {
      root.setAttribute("data-theme", saved);
    }
    // No stored choice means no attribute at all, and the stylesheet's own
    // prefers-color-scheme rule decides. Writing the machine's preference into
    // the attribute here would freeze it, and it would also make an inherited
    // preference indistinguishable from a chosen one.
  })();
"""

CONTROL = """
  // Two buttons rather than one toggle, because a toggle labelled with the
  // theme you are not in has to be read twice. Each button says the theme it
  // sets, and the one you are in is the one that is pressed.
  (function () {
    var root = document.documentElement;
    var buttons = document.querySelectorAll("[data-theme-set]");
    var os = window.matchMedia("(prefers-color-scheme: light)");

    function stored() {
      try { return localStorage.getItem("handoff.theme"); } catch (e) { return null; }
    }

    // What the reader is actually looking at, which is the stored choice if
    // there is one and the machine's preference if there is not.
    function effective() {
      return root.getAttribute("data-theme") || (os.matches ? "light" : "dark");
    }

    function sync() {
      var now = effective();
      var chosen = root.getAttribute("data-theme") !== null;
      for (var i = 0; i < buttons.length; i++) {
        var mine = buttons[i].getAttribute("data-theme-set") === now;
        buttons[i].setAttribute("aria-pressed", mine ? "true" : "false");
        buttons[i].setAttribute(
          "title",
          mine && chosen
            ? "press again to follow the system"
            : "set the " + buttons[i].getAttribute("data-theme-set") + " theme");
      }
    }

    function apply(next) {
      if (next === null) {
        root.removeAttribute("data-theme");
        try { localStorage.removeItem("handoff.theme"); } catch (e) { /* ignore */ }
      } else {
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("handoff.theme", next); } catch (e) { /* ignore */ }
      }
      sync();
    }

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (ev) {
        var next = ev.currentTarget.getAttribute("data-theme-set");
        // Pressing the theme you are already holding is the way back out to
        // the system preference. A one way control that can only ever be
        // overridden is a setting you cannot unset.
        apply(root.getAttribute("data-theme") === next ? null : next);
      });
    }

    // While nothing is stored the page follows the machine, so it has to keep
    // following it when it changes rather than until the next reload.
    if (os.addEventListener) { os.addEventListener("change", sync); }
    else if (os.addListener) { os.addListener(sync); }

    // The console writes the same key on the same origin. A theme changed
    // there reaches this tab as it happens instead of at the next load.
    window.addEventListener("storage", function (ev) {
      if (ev.key !== null && ev.key !== "handoff.theme") { return; }
      var saved = stored();
      if (saved === "light" || saved === "dark") { root.setAttribute("data-theme", saved); }
      else { root.removeAttribute("data-theme"); }
      sync();
    });

    sync();
  })();
"""

# The register form in miniature: a leader, and a locator at the right margin.
# Deliberately not the console's favicon, so the two tabs are told apart in a
# tab strip without reading either title.
FAVICON = (
    "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20"
    "viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='7'%20"
    "fill='%230B0F0E'/%3E%3Crect%20x='4'%20y='15'%20width='14'%20height='2'%20"
    "fill='%23333E3B'/%3E%3Crect%20x='21'%20y='15'%20width='7'%20height='2'%20"
    "fill='%23A2ADAA'/%3E%3C/svg%3E"
)


def url_for(rel: str) -> str:
    """The href for a discovered path.

    Escaping and encoding are different operations and a link needs both, in
    this order. Percent-encoding comes first and is about the URL: a `#` in a
    filename is a fragment unless it is written %23, a space is not a character
    a URL may contain, and a literal `%` has to become %25 or the browser
    decodes the two characters after it. Escaping comes second and is about the
    attribute, so an `&` cannot start an entity. Doing only the second, which
    is what this did, produces a link that is silently wrong on a page whose
    entire job is being right about paths.

    The separator survives, because a path is a sequence of segments and each
    one is encoded on its own. A trailing slash survives with it: the last
    segment is empty, and an empty segment encodes to itself.

    Only discovered paths go through here. A URL somebody wrote in index.json
    is already a URL, and quoting it again would turn its own %20 into %2520.
    """
    return "/".join(quote(segment, safe="") for segment in rel.split("/"))


def split_path(rel: str) -> str:
    """A path renders as one string in two tones: the directory that holds the
    file recedes, the filename does not. The directory a document lives in is a
    filing convention nobody came here to learn, and this is the only place on
    the page it survives, which is where it belongs."""
    body = rel.rstrip("/")
    slash = rel[len(body):]
    if "/" in body:
        head, tail = body.rsplit("/", 1)
        # The trailing slash stays with the last segment, because it is what
        # that segment is: a thing you open rather than a thing you read. A
        # directory inside a directory used to lose its own name into the dim
        # prefix and render with nothing in the reading tone at all.
        return f'<span class="dir">{html.escape(head)}/</span>{html.escape(tail)}{slash}'
    return html.escape(rel)


def row(kind: str, href: str, name: str, rel: str, count=None, clause=None,
        current=False, pad: str = "") -> str:
    label = [flatten(name)]
    if count is not None:
        label.append(f"{count} items")
    if clause:
        label.append(flatten(clause))
    label.append(rel)

    attrs = [f'class="row {kind}"', f'href="{html.escape(url_for(href))}"',
             f'aria-label="{html.escape(", ".join(label))}"']
    if current:
        attrs.append('aria-current="page"')

    parts = [f'{pad}<a {" ".join(attrs)}>']
    parts.append(f'{pad}  <span class="name">{inline(name, rel, allow_links=False)}</span>')
    if count is not None:
        parts.append(f'{pad}  <span class="count">{count} items</span>')
    if clause:
        parts.append(f'{pad}  <span class="clause">{inline(clause, rel, allow_links=False)}</span>')
    # The leader carries no information, so it is hidden from the accessible
    # tree along with the rest of the row's own text: the aria-label above is
    # what is read, and it reads as a name followed by a locator.
    parts.append(f'{pad}  <span class="leader" aria-hidden="true"></span>')
    parts.append(f'{pad}  <span class="path">{split_path(rel)}</span>')
    parts.append(f"{pad}</a>")
    return "\n".join(parts)


def render(model: dict) -> str:
    page = model["page"]
    for key in ("title", "lede", "description"):
        if not page.get(key):
            fail(f"index.json 'page' needs a '{key}'.")

    body = []
    for entry in model["entries"]:
        body.append('<li class="project">')
        body.append(row("row-head", entry["path"], entry["name"], entry["path"],
                        current=entry["current"], pad="  "))
        if entry["gloss"]:
            body.append(f'  <p class="gloss">{inline(entry["gloss"], entry["slug"])}</p>')
        if entry["docs"]:
            body.append('  <ul class="docs">')
            for doc in entry["docs"]:
                body.append("    <li>")
                body.append(row("row-doc", doc["rel"], doc["name"], doc["rel"],
                                count=doc["count"], clause=doc["clause"], pad="      "))
                body.append("    </li>")
            body.append("  </ul>")
        body.append("</li>")

    # The foot names the generator and says which half of the page a person
    # wrote, which is what amendment A replaced the old admission of staleness
    # with. The old line said a new directory would not appear until someone
    # added it, and that stopped being true the moment this script existed.
    colophon = (f"Written by `{GENERATOR}` from the directories under `work/`. "
                "The sentences are written by hand.")

    return HTML.replace("__TITLE__", html.escape(page["title"])) \
               .replace("__DESCRIPTION__", html.escape(page["description"])) \
               .replace("__FAVICON__", FAVICON) \
               .replace("__CSS__", CSS.strip("\n")) \
               .replace("__BOOT__", BOOT.strip("\n")) \
               .replace("__CONTROL__", CONTROL.strip("\n")) \
               .replace("__LEDE__", inline(page["lede"], "page.lede")) \
               .replace("__COLOPHON__", inline(colophon, "colophon", allow_links=False)) \
               .replace("__REGISTER__", "\n".join(body)) + "\n"


HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<meta name="description" content="__DESCRIPTION__">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="__FAVICON__">

<link rel="preload" href="fonts/instrument-sans-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/newsreader-var-latin.woff2" as="font" type="font/woff2" crossorigin>

<style>
__CSS__
</style>

<script>
__BOOT__
</script>
</head>
<body>

<main class="page">

<div class="head">
<h1>__TITLE__</h1>
<p class="lede">__LEDE__</p>
</div>

<ul class="register">
__REGISTER__
</ul>

</main>

<footer class="foot">
<p class="colophon">__COLOPHON__</p>
<div class="theme" role="group" aria-label="Theme">
<button type="button" class="themebtn" data-theme-set="light">light</button>
<span aria-hidden="true">/</span>
<button type="button" class="themebtn" data-theme-set="dark">dark</button>
</div>
</footer>

<script>
__CONTROL__
</script>
</body>
</html>"""


# ---- the mechanical pre-flight ------------------------------------------

TAG_RE = re.compile(r"<[^>]+>")
BLOCK_RE = re.compile(r"<(style|script)\b.*?</\1>", re.S | re.I)

# The attributes that carry a string somebody reads. An aria-label is read
# aloud, a title is read on hover, and the two meta strings are read in a tab
# and in a search result. Stripping whole tags used to take all four out of
# every prose check, so the labels this script writes were the one set of
# sentences on the page that nothing checked.
ATTR_RE = re.compile(r'\b(?:aria-label|title|alt|content)="([^"]*)"')

# Comments are not rules and must not be counted as if they were. A comment
# mentioning border-radius would otherwise spend the page's single allowance
# and let a real second radius through behind it.
BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.S)
LINE_COMMENT_RE = re.compile(r"(?<![:/])//[^\n]*")


def code(page: str) -> str:
    """The page with its comments taken out, for the checks that count rules.

    The line comment pattern refuses to fire after a colon or a slash, which is
    what keeps it off the http:// strings on the page.
    """
    return LINE_COMMENT_RE.sub("", BLOCK_COMMENT_RE.sub("", page))


def visible_text(page: str) -> str:
    """Every string a person reads, which is what the prose checks apply to.
    Running them over the whole file would flag `.row:hover, .row:focus-visible`
    for the space before a full stop that is a class selector."""
    # Tags come out as nothing rather than as a space, because a literal set in
    # the mono face mid sentence is wrapped in a span and a space would put a
    # gap in front of the full stop that follows it. The block level tags in
    # this page each sit on their own line, so nothing runs together.
    markup = BLOCK_RE.sub("\n", page)
    text = TAG_RE.sub("", markup)
    labels = "\n".join(m.group(1) for m in ATTR_RE.finditer(markup))
    return html.unescape(text + "\n" + labels)


ROW_RE = re.compile(r'<a class="row[^"]*" href="([^"]*)"(.*?)</a>', re.S)
# Greedy, and without DOTALL, because the path span holds a span of its own
# and it is the last thing on its line: the first closing tag is the inner
# one and the last is the one that ends the path.
PATH_RE = re.compile(r'<span class="path">(.*)</span>')
UL_RE = re.compile(r"<(/?)ul\b")


def structure(page: str) -> list:
    """The shape the direction asks for: one main, one h1, and a hierarchy that
    is a nested list one level deep rather than an indent that looks like one.
    Every row is an anchor, so there is nothing to click that is not a link."""
    bad = []
    for tag, wanted in (("<main", 1), ("<h1", 1), ("<ul class=\"register\"", 1)):
        n = page.count(tag)
        if n != wanted:
            bad.append(f"{tag}: {n}, expected {wanted}")

    depth = 0
    deepest = 0
    for m in UL_RE.finditer(page):
        depth += -1 if m.group(1) else 1
        deepest = max(deepest, depth)
    if depth != 0:
        bad.append(f"the lists do not close: <ul> depth ends at {depth}")
    if deepest != 2:
        bad.append(f"the hierarchy is {deepest} lists deep, expected 2")

    rows = page.count('class="row ')
    anchored = len(ROW_RE.findall(page))
    if rows != anchored:
        bad.append(f"{rows} rows and {anchored} of them are anchors")
    return bad


def paths_resolve(page: str) -> list:
    """Every path on the page is complete, real, encoded, and says what it is.

    This is the check the page exists for, so it is made against the rendered
    file rather than against the model that produced it: the href is decoded
    and has to come back as the path printed beside it, that path has to be on
    disk, and its last character has to be true. A filename with a space or a
    hash in it fails here if the encoding is ever dropped again.
    """
    bad = []
    for match in ROW_RE.finditer(page):
        href, rest = match.group(1), match.group(2)
        shown = html.unescape(TAG_RE.sub("", PATH_RE.search(rest).group(1))).strip()
        target = unquote(html.unescape(href))
        if target != shown:
            bad.append(f"the link goes to {target!r} and the page says {shown!r}")
            continue
        if url_for(shown) != html.unescape(href):
            bad.append(f"{shown!r} is not url encoded in its href: {href!r}")
        on_disk = WORK / shown.rstrip("/")
        if shown.endswith("/"):
            if not on_disk.is_dir():
                bad.append(f"{shown!r} ends in a slash and is not a directory")
        elif not on_disk.is_file():
            bad.append(f"{shown!r} does not end in a slash and is not a file")
    return bad


def audit(page: str) -> list:
    """Section 10 of the direction, run rather than asserted.

    It lives here rather than in a checklist because a checklist is
    transcribed, and a number or a ban that is transcribed is a number or a ban
    that will one day be wrong. Every one of these is cheap.
    """
    bad = []
    rules = code(page)

    def count(needle, allowed=0, source=None, label=None):
        n = (rules if source is None else source).count(needle)
        if n != allowed:
            bad.append(f"{label or needle}: {n}, expected {allowed}")

    # Counted over the rules, because a comment is not a declaration.
    count("box-shadow")
    count("border-radius", 1)
    count("backdrop-filter")
    count("--elev-")
    count("--r-3")
    count("--r-4")
    count("--r-full")
    count("gradient")
    count("text-transform")
    count("-webkit-font-smoothing")
    count("optimizeLegibility")
    count("onclick")

    # Counted over the whole file, because the direction says these three may
    # not appear anywhere in it, and a comment about fetching state is still a
    # sign that somebody was thinking about it.
    count("fetch(", 0, page)
    count("XMLHttpRequest", 0, page)
    count("state.json", 0, page)

    # The focus ring is an outline, and it is the only chromatic thing here.
    if "outline-color: var(--live)" not in rules:
        bad.append("no focus ring: outline-color: var(--live) is not in the page")

    bad.extend(structure(page))
    bad.extend(paths_resolve(page))

    for value in re.findall(r"letter-spacing:\s*([^;]+);", rules):
        value = value.strip()
        if value in ("normal", "inherit"):
            continue
        m = re.fullmatch(r"(-?[\d.]+)em", value)
        if not m:
            bad.append(f"letter-spacing in a unit that cannot be checked: {value}")
        elif float(m.group(1)) > 0.012:
            bad.append(f"letter-spacing {value} is above 0.012em")

    text = visible_text(page)
    for char, name in (("—", "em-dash"), ("–", "en-dash")):
        if char in text:
            bad.append(f"{name} in a visible string")
    for m in re.finditer(r" [.,]", text):
        bad.append(f"a space before a full stop or comma: {text[max(0, m.start() - 40):m.end()]!r}")
    for ch in text:
        if ord(ch) > 0x2100 and ch not in "‘’“”":
            bad.append(f"a character outside the page's repertoire: {ch!r}")

    return bad


# ---- main ---------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Write work/index.html from work/ and work/index.json.")
    parser.add_argument("--check", action="store_true",
                        help="verify the inputs and the page on disk, write nothing")
    args = parser.parse_args()

    notes = []
    prose = load_prose()
    page = render(build_model(prose, discover(prose, notes), notes))
    for _kind, text in notes:
        print(text)

    failures = audit(page)
    for failure in failures:
        print(f"pre-flight: {failure}", file=sys.stderr)
    if failures:
        return 2

    existing = OUT.read_text(encoding="utf-8") if OUT.exists() else None

    if args.check:
        if existing is None:
            print("index.html does not exist. run without --check.")
            return 1
        if existing != page:
            print("index.html is out of date. run without --check.")
            return 1
        print(f"index.html is current. {summarise(notes)}.")
        return 0

    if existing == page:
        print("index.html unchanged.")
        return 0

    # Written through a temp file in the same directory and moved into place,
    # so a reader loading the page mid-write never sees half of it.
    temp = OUT.with_suffix(".html.partial")
    temp.write_text(page, encoding="utf-8", newline="\n")
    os.replace(temp, OUT)
    print(f"wrote {OUT.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
