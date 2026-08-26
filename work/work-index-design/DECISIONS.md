# Amendments to the work-index direction

`DIRECTION.md` was approved on 2026-08-26 from the console
(`work-index/direction/1`, "approved the direction"). These amendments were
agreed immediately after, in chat, and **they override the direction where they
conflict**.

---

## Amendment A: the page is generated, not typed

`DIRECTION.md` section 5 accepts that a directory added later is invisible
until someone hand-edits `index.html`, and mitigates it with a foot line
admitting as much.

**That cost was underpriced.** This pipeline creates a directory under `work/`
on every brief. Staleness is not an edge case here, it is the normal operating
condition of the thing being indexed, and a page that is wrong more often than
right teaches the reader to stop trusting it. That is the same failure section 5
uses to reject a second copy of the state file, applied to itself.

So: **`index.html` is written by `scripts/build-index.py`.** The served artifact
is unchanged, still plain static HTML with no runtime fetch, no dependency and
no build step in the browser. The no-build-step rule governs what the browser
receives, not whether a person or a script typed it.

### The split, which is the whole of this amendment

**Structure is discovered. Prose is written.**

| Discovered from disk | Written by a person |
|---|---|
| Which projects exist under `work/` | The project's display name |
| Which documents each one has, and their paths | The one or two sentence gloss |
| The findings count, from the length of the JSON array | A trailing clause on an attachment, where the name is not enough |
| Modification order, for "most recently written first" | |

The prose lives in `work/index.json`, keyed by slug. A directory present on
disk but absent from that file is **still rendered**, with its name derived
from the slug and no gloss, and the generator prints a line naming it. Silently
dropping a directory would reintroduce exactly the defect this page exists to
fix, and it would be worse than the autoindex, which at least never lies about
what is there.

A slug in `index.json` with no directory on disk is an error, not a warning.
That is a stale entry describing something that no longer exists.

### Consequences for the direction

- **Section 5's foot line changes.** "Written by hand. A new directory under
  `work/` does not appear here until someone adds it" is no longer true and must
  not ship. Replace it with a line naming the generator and stating that the
  glosses are hand written, so the page is still honest about which half of
  itself a person wrote.
- **Section 11 judgment 2 stands**, but `work/README.md` says how to regenerate
  rather than repeating the list, so there is one list and not two.
- The `10 items` count in section 4.2 is now derived rather than transcribed,
  which removes the only number on the page that could silently drift.
- Everything else in `DIRECTION.md` is unchanged. The generator's output must
  satisfy the section 10 pre-flight exactly as a typed file would.

---

## Amendment B: regenerating is part of the pipeline

A generator nobody runs is a hand-written page with extra steps.

`CLAUDE.md` gains one line in the "Keep the console current" section, alongside
the `handoff.py` commands, making the index part of the same reflex: regenerate
after creating a project directory and after a stage writes files into one. It
belongs in that section rather than a new one, because it is the same
obligation the section already states, which is that a surface the user reads
is only truthful if it is written as you go.

---

## What was left alone

The two open questions in `DIRECTION.md` section 11 were not answered and the
strategist's own choices stand: the title is **Builds**, and the gloss keeps its
link to `127.0.0.1:8790` alongside the `agent-console/` entry.
