# Visual direction: the index of `work/`

Status: proposed, awaiting user approval. No code until approved.

Design read: the front matter of a build directory, for the one person who
built everything in it, with a written-index language, leaning toward the
console's own type and color tokens with its elevation system deliberately
switched off.

Dials: DESIGN_VARIANCE 3 (a contents page is a settled form) · MOTION_INTENSITY
1 (two behaviors, both 140ms color transitions) · VISUAL_DENSITY 5 (ten lines,
and they should breathe).

---

## 1. Concept

**This page is a drawing register. Every project is one line, its documents
hang under that line, and the right margin is a flush column of real paths.**

The listing it replaces names six directories. This page names three projects,
says what each one is in a sentence somebody wrote, and puts everything else
underneath the project it belongs to. That correction is the entire job. There
is nothing else to do here, and the page should be over quickly.

The form is the one that print settled on for exactly this problem: a contents
page. A title at the left, a leader running right, a locator at the right
margin. In a book the locator is a page number. On a file server the path *is*
the page number, so the right margin carries paths, in mono, flush.

Signature: **the leader and the flush path column** (section 4.2). It is the
only structural device on the page and it does two jobs at once, tying a name
to its path across a wide gap, and expressing rank by how far it is indented.

---

## 2. Does it belong to the console's family

**Yes, one rank quieter, and the divergences are deliberate.**

Same family: the same three faces and the same voice rule, the same neutral
tokens, the same weight grade in dark mode, the same bans (no badges, no pills,
no colored dots, no uppercase, no eyebrows, no shadow on anything that is a
line, no em-dashes).

Not taken, and why: **the elevation system, the radius scale above 8px, the
spring, and the attention hue.** `DIRECTION-3` gives the console furniture
because the console holds objects: a document you read, controls you press, a
preview frame, a response bar. This page holds nothing. It is a surface you
read and leave. Putting `--elev-1` cards and a 20px radius on a ten-line index
would be raising objects that are not there, which is the cards-inside-cards
look that document rejects by name. A page with no objects gets no elevation.

The one thing this page has that the console does not: a hard flush-right
column. The console's board is a fixed-column grid with a drawing in the middle
of it. This page is prose with a locator column at the edge. Different content,
same hand.

---

## 3. Typography

Three faces, already self-hosted in this repository at
`work/agent-console/fonts/`, all SIL OFL 1.1, all variable, all latin subset.
Copy the four woff2 files and their licence texts into `work/fonts/` rather
than pointing at `../agent-console/fonts/`: a relative path up out of this
page's own directory couples the index to a sibling build that may be renamed,
and the fonts are 285KB total with only two on the critical path.

| File | Family | Voice on this page |
|---|---|---|
| `instrument-sans-var-latin.woff2` | Instrument Sans | The page's own voice: title, project names, the foot line |
| `newsreader-var-latin.woff2` | Newsreader | Glosses, and the titles of documents |
| `newsreader-italic-var-latin.woff2` | Newsreader italic | Not used. Do not load it |
| `geist-mono-var-latin.woff2` | Geist Mono | Every path and every count |

The console's rule is unchanged and it is what does the taxonomy work here:

> The system speaks in one voice, the documents speak in another, and machine
> literals speak in a third.

So a `DIRECTION.md` is titled in Newsreader, because it is a document. The
project `Front End Agents` is named in Instrument Sans, because the page is
naming it. Every path is Geist Mono, because a path is a literal. No icons are
needed to say which is which, and none are permitted.

Preload Instrument Sans and Newsreader roman. Metric-matched local fallbacks
with `size-adjust`, `ascent-override` and `descent-override` are already
computed in `work/agent-console/styles.css` lines 73 to 105. Copy those four
`@font-face` blocks verbatim rather than re-deriving them.

### Scale

Roles are lifted from `DIRECTION-3` sections 1.6 and 1.7 by name, so the two
surfaces top out at the same size and share every intermediate step.

| Role | Face | Size / leading | Weight step | `wdth` | Tracking |
|---|---|---|---|---|---|
| Page title | Instrument Sans | 28 / 34px | strong | 100 | -0.018em |
| Project name | Instrument Sans | 16.5 / 22px | med | 100 | -0.006em |
| Foot line | Instrument Sans | 13 / 18px | reg | 96 | 0.004em |
| Gloss, page and project | Newsreader | 17px / 1.60 | 400 light, 390 dark | | |
| Attachment title | Newsreader | 15.5 / 22px | 400 | | |
| Path | Geist Mono | 13 / 18px | 400, tabular | | |
| Count | Geist Mono | 13 / 18px | 400, tabular | | |

Weight steps are the console's: `--w-reg` 450 light / 430 dark, `--w-med` 540 /
520, `--w-strong` 620 / 600, set through `font-variation-settings` on the
`wght` axis with `font-synthesis-weight: none`. The 20-unit dark-mode step is
the irradiation compensation argued in `DIRECTION-3` section 1.5 and it applies
here for the same reason.

`font-optical-sizing: auto` globally, which is what activates Newsreader's
`opsz` axis. No override is needed on this page; there are no dense table cells.

**Bans, carried across intact.** No uppercase anywhere. No tracking above
0.012em. No mono for a label, a heading or a name. No eyebrow above anything. A
leader with a wide-tracked uppercase word sitting on it is the one move that
would turn this page into a template, and it is banned by construction.

---

## 4. Layout and structure

Content cap **820px**, centered, fluid below. Not the console's 1240px: a
leader running 1200px stops being a leader and becomes a road, and these are
one-line entries with nothing to fill the width. Vertical rhythm on the
console's six-step scale, 4 / 8 / 14 / 22 / 36 / 56.

### 4.1 The page head

Three elements and no more: the title, one gloss paragraph, and a hairline in
`--rule` under them. No search field with nothing to search. No project count.
No date claiming freshness. No logo.

Title: **Builds.** It is the README's own word for what is in here.

Gloss, verbatim, because copy is where a page like this goes generic:

> Everything this pipeline has built, one directory per brief, most recently
> written first. Nothing on this page is live. Where a project has got to is in
> the console, at 127.0.0.1:8790.

**Ordering is information.** Most recently written first, not alphabetical.
Alphabetical is the machine's order and it is the order the listing already had.

### 4.2 The entry

A project is a real `<li>`. Its documents are a real nested `<ul>` inside it.
The hierarchy is in the DOM, not in the padding, so a screen reader gets the
parent-and-child relation that is the whole claim of this page.

```
+-------------------------------------------------------------------+
|                                                                   |
|  Builds                                                           |
|                                                                   |
|  Everything this pipeline has built, one directory per brief,     |
|  most recently written first. Nothing on this page is live.       |
|  Where a project has got to is in the console, at                 |
|  127.0.0.1:8790.                                                  |
|  ---------------------------------------------------------------  |
|                                                                   |
|  Front End Agents -------------------------------- agent-console/ |
|                                                                   |
|      The console this pipeline reports into. It reads the         |
|      pipeline's state file and writes your answers back.          |
|      Opened from here it has no server behind it, so it shows     |
|      sample data.                                                 |
|                                                                   |
|      Direction ------------ agent-console-design/DIRECTION.md     |
|      The flow ------------ agent-console-design/DIRECTION-2.md    |
|      The visual language - agent-console-design/DIRECTION-3.md    |
|      Amendments A to I ---- agent-console-design/DECISIONS.md     |
|      Decisions, the rebuild agent-console-design/DECISIONS-2.md   |
|      Drawing checks -------------------- agent-console-check/     |
|                                                                   |
|  Fifth Street Tool Library ------------------------ tool-library/ |
|                                                                   |
|      A one page site for a neighborhood tool lending library.     |
|      Built to give the console a real brief to carry, and it      |
|      went through all three stages.                               |
|                                                                   |
|      Direction -------------- tool-library-design/DIRECTION.md    |
|      Findings  10 items ----- tool-library-design/FINDINGS.json   |
|                                                                   |
|  Written by hand. A new directory under work/ does not appear     |
|  here until someone adds it.                     light / dark     |
+-------------------------------------------------------------------+
```

Dashes above stand for a 1px hairline in `--rule-strong`, drawn as a flex
spacer with a `border-bottom`, vertically centered on the line's baseline box.

**The head line.** Project name at left, leader, path flush right. The whole
line is one link, and its accessible name reads "Front End Agents,
agent-console/".

**The gloss.** One or two sentences of Newsreader at 17px, capped at 60ch,
indented to the attachment indent. This is the only place on the page where
anyone wrote a sentence, and it is what answers "what is this." Rule: **history
goes in the sentence, never in a column.** "It went through all three stages"
is a true, durable fact and it belongs in prose. A status column cannot carry
it honestly (section 5).

**The attachment lines.** Title at left in Newsreader, an optional count, a
shorter leader, path flush right. Each is a link. Attachments may carry a
clause, never a paragraph: `Drawing checks` gets "loads the console at five
widths and measures what it drew" as a trailing clause in `--ink-3`, because
the name alone does not explain it. `Direction` needs nothing.

**Counts.** Geist Mono, `--ink-3`, sitting immediately after the title on the
left of the leader, with the leader breaking around it. Rule: **a count appears
only where the number is a fact about the work, not about the file.** `10 items`
on the findings, yes. Word counts, byte sizes and line counts, no.

### 4.3 The design directory: a child, and its name never appears

The `-design` sibling is a filing convention. Nobody landing here wants to know
that `tool-library-design/` is a directory; they want to know that tool-library
has a direction document and ten findings against it.

So: **the documents are listed, the directory that holds them is not.** It
survives only inside each path, where it belongs, and paths are graded to say
so. `tool-library-design/` renders in `--ink-3` and `FINDINGS.json` in
`--ink-2`, one string, never truncated, always copy-pasteable. The filenames end
flush right and the dim directory prefixes ragged left of them, which reads
correctly and keeps every path complete.

`agent-console-check/` is not a `-design` sibling and is not a project either.
It is an instrument belonging to the console, so it hangs under the console
alongside the documents. That is a judgment and I am making it: a harness that
loads exactly one build is an attachment of that build.

**The trailing slash is the entire taxonomy.** A path ending in `/` is
something you open. A path ending in a filename is something you read. No
icons, no file-type glyphs, no folder marks, no second signal of any kind.

### 4.4 Links, hover, focus

Every head line and every attachment line is a link. The console's link rule is
an underline at 0.12em offset, which cannot apply here: a horizontal line
already runs through every row, and a second one would be mud.

Divergence, stated: **at rest a row carries no underline, because the leader is
already the horizontal.** On hover and on focus the *name* takes the 0.12em
underline, and the whole row takes a `--surface-1` fill at `--r-2`. Two signals
on interaction, one of them independent of color. The console link treatment
applies unchanged to the two links inside prose (the console URL in the page
gloss, and anything in a clause).

**Rows do not lift.** Straight from `DIRECTION-3` section 3.4 and for the same
reason: a page of hairline rows that bounce under the mouse feels loose.

### 4.5 Narrow widths

**Below about 620px the leader has no room and is cut.** The row becomes two
lines: name on the first, path on the second at the name's own indent, both
left aligned. A flush-right path with a two-inch gap to a left-flush name and
nothing between them reads as a bug. This is the same two-line collapse the
console's board does at 375px.

- Indent steps go from 24px to 12px. The nesting is still visible.
- Gloss and attachment titles go to 16px, measure uncapped.
- Every link gets a 44px minimum target height, 48px preferred.
- Nothing scrolls sideways, and nothing is hidden.

### 4.6 Radius, elevation, spacing

- `--r-2` (8px) on the row hover fill. That is the only radius on the page.
- Zero `box-shadow`. No `--elev-*` token is defined here, so none can be used.
- No `backdrop-filter`. Nothing on this page is sticky and nothing scrolls
  under anything.
- Leaders and rules stay at **1 CSS pixel**. `DIRECTION-3` section 5.2 puts the
  sub-pixel hairline in the SVG track only and states that HTML rules stay at
  1px; there is no SVG on this page, so there is no 0.5px anywhere.

---

## 5. State: the page shows none, and here is the argument

**`.handoff/state.json` is not reachable from this page and no version of this
page will pretend otherwise.** It lives above the server root. `http.server`
refuses a path that resolves outside its directory, so a fetch cannot get
there, and this is not a bug to route around.

Three routes to live state exist. All three are rejected, with reasons:

1. **Fetch the console's API at `127.0.0.1:8790/api/state`.** Cross origin from
   `localhost:8788`, and that route sends no CORS header, so the browser blocks
   it. Even if it did not, this page would then be broken whenever the console
   server is down, which is most of the time, and it would fail silently.
2. **Have `scripts/handoff.py` also write a copy into `work/`.** Technically
   fine and it is the one I would build if state were required. It is still
   wrong: it asks for a change to the one writer that holds the cross-process
   lock, it puts a second copy of the truth on disk, and a static file that says
   `needs you` will one day be wrong at three in the morning. Two surfaces
   disagreeing about state is how a person learns to distrust both.
3. **Parse the server's own directory listings by fetching each subdirectory**
   to recover file counts and modified times. Depends on the exact HTML
   `http.server` happens to emit, breaks the moment the directory is served by
   anything else, and breaks entirely when the file is opened directly. A page
   that is sometimes right is worse than a page that is always written.

**What the page shows instead: the residue.** A project with a direction and no
build has not been built. A project with a build and a `FINDINGS.json` has been
through the reviewer. The files *are* the record, they are durable, they change
only when someone changes them, and this page is edited when they change. So
the attachment list under each project already carries everything a stage word
would have carried, and carries it without a freshness claim it cannot back.

Consequences, all deliberate:

- **No stage names, no state words, no `needs you`, no counts of what is
  waiting.** Those belong to the console and they are one click away.
- **The attention hue is never spent on this page.** Nothing here ever needs
  doing. That also means the index and the console are distinguishable at a
  glance in a tab strip, which is worth having.
- **The only chromatic thing on the page is the focus ring**, in `--live`,
  which is consistent: focus means "the thing about to move," and it is the
  only thing on this page that ever is.

**The accepted cost, stated plainly.** Putting `index.html` at the root of
`work/` means the directory listing is gone, and a directory added later is
invisible until someone edits this file. There is no escape hatch;
`http.server` has no query that forces the listing back. The mitigation is one
sentence in the page's own voice at the foot, and `work/README.md` shortened to
the same list so the fact survives in git as well as on screen:

> Written by hand. A new directory under `work/` does not appear here until
> someone adds it.

That is the console's `sample data. the server is not running.` line applied to
this page's own honesty problem.

---

## 6. Color

The console's neutral tokens, taken verbatim from `DIRECTION-3` sections 2.3
and 2.4. Two surfaces of one tool with different neutrals would be a defect.
Only the tokens this page uses are listed; the rest must not be defined here,
so they cannot be reached for.

**Dark, designed first**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0F0E` | Page. Cool green-black, never slate |
| `--surface-1` | `#121716` | Row hover fill, and nothing else |
| `--ink` | `#E6EDEB` | Page title, project names, gloss body |
| `--ink-2` | `#A2ADAA` | Filenames, attachment titles |
| `--ink-3` | `#7C8783` | Directory prefixes, counts, clauses, the foot line |
| `--rule` | `#222A28` | The one rule under the page head |
| `--rule-strong` | `#333E3B` | Every leader |
| `--live` | `#45DDD0` | Focus ring, 2px outline at 2px offset |

**Light**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#EDF1EF` | Page. Cool green-tinted paper, never cream |
| `--surface-1` | `#F6F9F8` | Row hover fill |
| `--ink` | `#101614` | Primary |
| `--ink-2` | `#424D4A` | Filenames, attachment titles |
| `--ink-3` | `#5F6C68` | Directory prefixes, counts, clauses, foot |
| `--rule` | `#DBE3DF` | Head rule |
| `--rule-strong` | `#C3CCC8` | Every leader |
| `--live` | `#0E7C74` | Focus ring |

**The leader is `--rule-strong`, which is the console's `--track` value
exactly.** That is the family tie, and the argument for its low contrast is the
console's own: a leader carries no information the name at its left and the
path at its right do not already carry, so it is furniture and is declared as
such. Everything on this page that carries information sits at 4.5:1 or better.

`--ink-3` on `--surface-1` clears AA in both themes. `--surface-2` and
`--surface-3` are not defined here, so the `--ink-3` on `--surface-3` trap from
`DIRECTION-3` cannot occur.

No P3 branch. The one chromatic token is a focus ring and the aqua's P3 gain is
not worth a media query on a page this size.

Theme: defaults to `prefers-color-scheme`, plain text `light / dark` control at
the foot, never a floating icon button. **It writes `handoff.theme` with the
values `"light"` and `"dark"` and applies `data-theme` on `<html>`**, which is
exactly what `agent-console/app.js` line 1190 does, so the index and the
console agree on theme when both are opened from `localhost:8788`. The builder
must read that code and confirm the key and value vocabulary before writing to
it; if either has changed, use a separate key and say so, because `DECISIONS-2`
amendment 6 forbids disturbing that storage.

---

## 7. Motion

**Two behaviors, both 140ms color transitions.**

| Behavior | Trigger | Property | Duration | Easing |
|---|---|---|---|---|
| Row hover | pointer enters a row | `background-color` | 140ms | `--ease-standard` |
| Focus ring | `:focus-visible` | `outline-color` from transparent | 140ms | `--ease-standard` |

`--ease-standard` is `cubic-bezier(0.2, 0, 0, 1)`, from `DIRECTION-3` section
4.2. No spring token is defined on this page.

Nothing else moves. No load animation, no leaders drawing in, no stagger, no
reveal on scroll, no lift, no scale on press. The console bans drawing its
track in on load and the same ban covers leaders for the same reason.

**Under `prefers-reduced-motion: reduce`, both behaviors are kept.**
`DIRECTION-3` section 4.6 point 6 permits color and opacity transitions up to
140ms under reduced motion, because reduced motion means reduced movement and
neither of these moves anything. So the reduced-motion block on this page is one
substitution and not a no-op. Do not ship a `transition: none !important` block
over a stylesheet with no transitions in it; `tool-library` shipped exactly that
and the reviewer flagged it as dead code.

---

## 8. Reference points

**A drawing register from a set of construction drawings.** The sheet index at
the front of a plan set: every sheet in the set, by title, with its number at
the right margin, nothing else on the page. Take: title plus locator, rank by
indent, a right margin that is a column, and the flat refusal to decorate a
list of what exists. Leave: title blocks, borders, revision clouds, sheet
numbering schemes, and anything that looks like it was drawn on vellum. This
sits one shelf along from the console's own reference, which is a technical
drawing, and that is on purpose: same trade, different document.

**The contents page of a technical manual.** Take: the leader as an elastic tie
between a name and its locator, chapters and sections sharing one flush right
column, and the discipline that a contents page is over in one screen. Leave:
dot leaders, roman numerals, small caps, centered title pages, and page ranges.

**The anti-reference is the page being replaced**, and it has exactly one
virtue worth keeping: `python -m http.server`'s autoindex never lies. It shows
what is on disk and claims nothing else. This page must not trade that away for
a richer surface. Everything else about it goes: the blue underlined links, the
alphabetical order, the `<hr>`, and the flat equality between a project and its
documents.

**Steering away from, named so the builder cannot drift into them:**

- A card grid, a bento, or any container around a one-line entry.
- A disclosure tree with triangles. Ten items, nothing to collapse, and it
  would add state to a page that has none.
- File-type icons, folder glyphs, or any icon at all.
- Status pills, colored dots, severity colors, a `3 projects` stat row.
- A hero, centered or otherwise. There is no thesis to state.
- Breadcrumbs on a page that is itself the root.
- A search field with six things to search.
- A generated timestamp implying freshness the file does not have.
- The 2026 dashboard: dark slate, a left sidebar of stroke icons, a live
  activity feed, an "Agents" nav item.
- Emoji. Em-dashes. En-dashes.

---

## 9. Considered and rejected

**Live pipeline state, by all three available routes.** Section 5, in full.

**Showing the `-design` directories as peer entries.** That is the defect being
fixed. Six equal directories is precisely the misrepresentation the listing
already commits.

**Naming the `-design` directory as a group heading above its documents.** It
is a filing convention. Naming it spends a line on something nobody came here
to learn, and the path already carries it.

**Dot leaders.** They read as a Word table of contents, and at 13px they
shimmer. A hairline is the same idea, drawn once.

**Making the leader carry a measure**, filled to some proportion of a project's
size or stage count. It would become a progress bar with a filled track, which
`design-taste-frontend` bans by name, and it would be a second-rate imitation
of the console's thread, which is the console's signature and should stay there.

**Copying the console's elevation and radius system.** Section 2. Cards on a
page with no objects.

**The attention hue.** Nothing on this page ever needs doing, and spending the
one hue that means "your move" on a page where nothing is your move would
devalue it on the surface where it matters.

**A 1240px cap to match the console.** A leader that long stops reading as a
leader.

**Alphabetical order.** The machine's order. It is what the listing already did
and it carries nothing.

**Byte sizes and file counts in the right margin.** Available, honest, and
useless. They are facts about files, not about work, and the margin is already
carrying the path.

**An `<hr>` between projects.** The gloss indent and the 36px gap already
separate them. A rule between two groups that are already separated is a rule
doing nothing, and this page's whole argument is that a line should do a job.

---

## 10. Pre-flight, mechanical

- [ ] `box-shadow` appears zero times.
- [ ] `border-radius` appears once, on the row hover fill, at 8px.
- [ ] `backdrop-filter`, `--elev-`, `--r-3`, `--r-4`, `--r-full` appear zero times.
- [ ] `gradient` appears zero times.
- [ ] `text-transform: uppercase` appears zero times.
- [ ] `letter-spacing` never exceeds 0.012em.
- [ ] `-webkit-font-smoothing` and `text-rendering: optimizeLegibility` appear
      zero times.
- [ ] No `fetch`, no `XMLHttpRequest`, and no reference to `state.json`
      anywhere in the file.
- [ ] Every path shown is complete and matches a real path under `work/`.
- [ ] Every path ending in `/` is a directory and every path not ending in `/`
      is a file.
- [ ] The hierarchy is a nested `<ul>`, one level deep, inside one `<main>`,
      under one `<h1>`.
- [ ] Zero `<div>` with a click handler. Every row is an `<a>`.
- [ ] The focus ring is an `outline`, visible on `--bg` and on `--surface-1` in
      both themes.
- [ ] The `prefers-reduced-motion` block substitutes something real and is not
      dead code.
- [ ] Zero em-dashes, zero en-dashes, zero emoji in any visible string.
- [ ] A grep of the rendered page for a space followed by a period or a comma
      returns nothing.

And the one that needs a person: **read the page as somebody who has never seen
this repository.** If after ten seconds you cannot say how many projects there
are and which of them has been reviewed, the entry is not doing its job.

---

## 11. Decided rather than asked

Three judgments I made instead of leaving open, flagged so they can be
overturned cheaply:

1. **`agent-console-check/` hangs under the console** rather than standing as a
   fourth entry. It loads exactly one build and measures it.
2. **`work/README.md` gets shortened to match this page** and stays, so the
   list survives in git for anyone reading the repository rather than the
   server.
3. **The fonts are copied into `work/fonts/`** rather than referenced up and
   across into `agent-console/fonts/`. It costs 285KB of duplicated bytes on
   disk and removes a coupling between two builds.

Two genuine questions, neither blocking:

1. **The title.** `Builds` is the README's own word. `Contents` is the form's
   word and is quieter. I picked `Builds` because it says what is inside.
2. **The console link.** The page gloss points at `127.0.0.1:8790`, the running
   tool, while the `agent-console/` entry points at the build on this server,
   which shows sample data. Two destinations for one artifact, and the gloss
   says which is which. If that is one link too many, drop the entry's own path
   and keep the live one.
