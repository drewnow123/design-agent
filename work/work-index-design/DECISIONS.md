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

---

## Amendment C: there is no reduced-motion block, and that is the correct build

Review finding 6, resolved 2026-08-26.

**The direction contradicted itself.** Section 7 states that under
`prefers-reduced-motion: reduce` both behaviors are kept, then asserts in the
next breath that "the reduced-motion block on this page is one substitution and
not a no-op", and section 10 item 13 asks a checker to confirm that block
"substitutes something real". Those cannot all be true at once. If both
behaviors survive the query, the block has nothing to change, and a block that
changes nothing is precisely the dead code section 7 spends its last sentence
banning.

**The build was right and the direction was wrong.** `component-builder`
shipped no block and said so rather than manufacturing a substitution to
satisfy a checklist. That was the correct call and it is now the specification.

Measured against the shipped page before ruling, so this is settled on evidence
rather than on the argument alone:

| | count |
|---|---|
| `@keyframes`, `animation`, `transform`, `translate`, `scale(`, `will-change` | 0 each |
| `scroll-behavior` | 0 |
| transitions declared | 2, `background-color` and `outline-color` |

Nothing on this page moves. Both transitions are colour, both at `--t-quick`,
and `DIRECTION-3` section 4.6 point 6 permits colour transitions up to 140ms
under reduced motion, because reduced motion means reduced movement. So the
honest response to the query is to change nothing, and the honest way to
express that is to write nothing.

### What changes

- **Section 7's last paragraph is superseded.** Its reasoning is kept and its
  conclusion is inverted: because both behaviors are permitted to survive, no
  block is written. Its warning against shipping `transition: none !important`
  over a stylesheet with nothing to disable stands, and is now the rule rather
  than an aside.
- **Section 10 item 13 is inverted.** It no longer asks whether a block exists
  and substitutes something real. It asks the opposite: that no
  `prefers-reduced-motion` block is present *while* nothing on the page moves.
  `audit()` enforces it.

### The condition under which this expires

This ruling is contingent, not permanent, and the check encodes the condition
rather than the conclusion. **If anything on this page ever moves** — a
keyframe, a transform, a scroll behavior, a transition on a property that
changes geometry — then a reduced-motion block becomes required and its absence
becomes a defect. `audit()` fails in that case rather than silently continuing
to bless an absence that was only ever correct for a page made entirely of
colour.

That is the difference between recording a decision and recording the reason
for it. A checklist item that says "no block" would be wrong the first time
someone adds an animation, and nobody re-reads a passing check.

---

## Amendment D: a path wraps rather than pushing the page sideways

Found by `component-builder` during the fix pass, outside the review. Resolved
2026-08-26.

**Two approved rules contradicted each other.** Section 4.3 says a path is
"one string, never truncated, always copy-pasteable". Section 4.5 says
"nothing scrolls sideways, and nothing is hidden". A path longer than its row
cannot satisfy both, and `.path` was `flex: 0 0 auto` with
`white-space: nowrap`, so the page lost.

Measured with a synthetic 81-character filename before ruling:

| viewport | sideways scroll, before | after |
|---|---|---|
| 768px | 127px | 0 |
| 700px | 180px | 0 |
| 640px | 240px | 0 |
| 600px | 0 | 0 |

600px was already clean because the narrow block below 620px had the right
treatment all along. The defect lived only in the wide layout, which is why
nobody found it by testing the breakpoint.

### The ruling

**The path wraps.** It keeps its own right-hand column and simply takes more
than one line when a line will not hold it.

That satisfies both rules rather than choosing between them. Wrapping is not
truncating: every character is still there and still copies. Nothing is
hidden, and the page stays still. What gives way is the path being one
unbroken line, which the direction never actually promises. It is a property
the design had by accident because no path had yet been long enough to
question it.

Rejected alternatives:

- **Truncate with an ellipsis, full path in a `title`.** Violates section 4.3
  outright, and a locator you cannot copy is not a locator.
- **Scroll the row rather than the page.** A horizontally scrolling row on a
  contents page is a worse object than a wrapped line, and it hides content
  behind a gesture, which section 4.5 also forbids.
- **Shrink the type until it fits.** Two paths at different sizes in one column
  stop being a column.

### How it breaks

`overflow-wrap: anywhere` alone would break mid-segment, so
`agent-console-design` could split as `agent-cons` / `ole-design`. The
generator emits `<wbr>` after each separator, giving the line breaker somewhere
better to go first, and falls back to breaking anywhere only when one segment
is itself longer than the row. `<wbr>` is zero-width and contributes no
character, so a wrapped path still copies as the path.

### What was checked afterwards

The flush right column is the page's signature and a wrapping path could have
destroyed it. Measured at 1000px with the long path present: **all fifteen
paths share a single right edge**, and only the over-long one occupies more
than one line. The fix is inert for every path that fits.

---

## Amendment E: no italic is served, and a set difference now says so

Review finding 24, resolved 2026-08-26.

**The direction asked for two things that could not both be honoured.** Section
3 says to copy four woff2 files into `work/fonts/`, and the table in the same
section says of Newsreader italic: "Not used. Do not load it." The build did
both, correctly and literally: it copied the file and never referenced it. The
result was 99KB of the 291KB served tree that nothing on the page could reach.

Checked before deleting, because a font that looks dead and is not is a worse
outcome than one that is:

- `inline()` renders exactly two forms, a code literal and a link. **There is no
  emphasis syntax**, so no string anyone writes in `index.json` can produce an
  `<em>`.
- `newsreader-italic-var-latin.woff2` appears zero times in the generated page.

So the face was unreachable in both directions: nothing referenced it, and
nothing could come to.

### What was removed

- `work/fonts/newsreader-italic-var-latin.woff2`, 101,388 bytes. The served
  font payload falls from 291,388 to 190,712 bytes, a third of it gone.
- The italic `Newsreader Fallback` `@font-face` block, which declared a metric
  matched local fallback for a face that was never requested.

`OFL-Newsreader.txt` **stays**. Newsreader roman still ships and travels under
that same licence, so removing it would be the actual licence problem.

Section 3's instruction to copy the fallback blocks verbatim stands for the
three faces that remain. Verbatim was the right instruction: it stopped the
builder re-deriving twelve metric override numbers by hand, and the block for
a face nobody serves was a cheap price for that until someone counted it.

### The check

`check_fonts()` compares what is in `work/fonts/` against what the page asks
for, in both directions, and it fires on either mismatch.

- A font served but never requested is dead weight.
- A font requested but not served is a face that silently falls back, which is
  worse, because a page that quietly renders in Georgia looks fine to whoever
  ships it.

It was written before the deletion and confirmed failing on the then-current
tree, so the check is known to catch this rather than merely to pass now. Both
directions were exercised.

This is the same shape as amendment C: the reviewer found this by reading, and
reading is exactly what is unreliable about an unreferenced byte. A set
difference is not.

---

## Amendment F: this repository decides its content types

Review finding 11, resolved 2026-08-26.

The reviewer flagged, without being able to test it, that the seven `.md` rows
might download rather than open because `python -m http.server` would serve
them as `application/octet-stream`. **The premise was wrong and the worry was
right**, which is an unusual and useful combination.

Measured in Chrome against the running server:

| | |
|---|---|
| `Content-Type` sent | `text/markdown` |
| Chrome's behaviour | renders inline, as text |
| `document.contentType` | `text/markdown` |

So nothing downloads, and no defect existed on this machine.

### Why it was still worth fixing

`http.server` does not know what a `.md` file is. It asks the host: the Python
version's built-in table, plus the Windows registry or `/etc/mime.types`. On
this machine Python 3.14 has `.md` in `mimetypes.types_map`, so it works.

That is a property of the machine, not of this repository. Confirmed by
serving a file with an extension no database knows:

```
.unknownext -> application/octet-stream
```

Which a browser downloads. So on a Python whose table lacks `.md`, seven of
fourteen rows silently stop opening and start saving. **The register's main
verb would be environment dependent**, and the failure would look like a
working link to whoever shipped it.

### The fix

`scripts/preview.py` replaces `python -m http.server` in the `static-preview`
launch config, and pins every content type this tree serves. `guess_type` is
overridden rather than `extensions_map` being updated, because how
`http.server` consults that map has changed across releases and the entire
point is to stop depending on the release.

`scripts/console.py` already made this decision, serving `.txt` explicitly so
the font licences render in a browser rather than downloading. This is that
decision applied to the preview tree, and the two servers now agree.

Two things came free and are worth naming: every text type carries
`charset=utf-8`, without which a document containing a curly quote renders as
mojibake under someone else's locale default; and the preview sends
`Cache-Control: no-store`, because a preview server showing the edit before
last is worse than one that is down.

### A note on measuring

The first measurement after this change reported 147px of sideways overflow and
looked like a regression in amendment D. It was not. The browser pane's
viewport was **zero pixels wide**, and against a zero-width viewport every
element overflows. Re-measured at 1000, 768 and 375: overflow 0 at each, and
all fourteen paths still share one right edge.

Worth writing down because the artifact is convincing. A measurement taken
through this pane should be discarded unless it also reports the viewport width
it was taken at.
