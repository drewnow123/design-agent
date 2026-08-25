# Front End Agents

A local console for one person to see where the design pipeline stopped, and
to release it. It reads `.handoff/state.json` and writes real responses back.

The board is a flow diagram: three stage columns, one project per row, and each
project drawn as a horizontal thread across those columns. The thread stops
where the project's record stops, and doubles back under the row where the
reviewer sent work back.

**The tool is called Front End Agents on screen only.** Every file path, route,
Python identifier and browser storage key still says `handoff`. That is
deliberate: the console is deployed from a systemd unit, so a path rename
breaks a live service, and renaming a `localStorage` key silently discards the
operator's saved theme and every draft of typed feedback.

## Running it

```
python scripts/console.py
```

Run it from the repository root. It prints two URLs: `127.0.0.1:8790` and the
LAN address, which is the one to open on a phone. Stop it with Ctrl+C.

There is no build step, no npm, and no dependency beyond the Python standard
library. The fonts are self hosted in `fonts/`.

Opening `index.html` through `static-preview` (port 8788) also works, but the
API is not there, so the console falls back to `state.sample.json` and prints
`sample data. the server is not running.` in the footer.

## Keyboard

Printed next to the controls it applies to. `j` and `k` move down and up the
board, `Enter` opens the project under the cursor, `a` takes the primary action
on the open ask, `c` requests changes, `1` to `4` pick a question option, and
`Esc` goes back to the board.

Shortcuts never fire while a text field has focus. Typing `a` into the
feedback box types the letter a.

## Writing state

Do not hand edit `.handoff/state.json`. `scripts/handoff.py` is the writer, and
it takes the same cross process lock the server takes, so a stage transition
recorded while the operator is answering an ask cannot clobber the answer.

```
python scripts/handoff.py start  <slug> <stage>
python scripts/handoff.py finish <slug> <stage> --detail "12 files"
python scripts/handoff.py hold   <slug> --kind direction --headline "..." --doc FILE
python scripts/handoff.py ready  <slug>
python scripts/handoff.py clear  <slug>
python scripts/handoff.py stop   <slug> --stage <stage>
python scripts/handoff.py note   <slug> "you sent it back" --quote "..."
python scripts/handoff.py drain  --archive
python scripts/handoff.py show
```

`hold --kind` takes `direction` (`--doc FILE`), `build` (`--preview URL`,
repeatable `--changed`), `findings` (`--findings FILE`, a json array of
`{severity, text, where}`) or `question` (`--question`, two to four repeatable
`--option`). **Re-holding an open ask of the same kind keeps its id and bumps
its `revision`**, rather than minting a new id. That is what keeps the
operator's typed draft alive, because a draft is saved against the ask id, and
it is what lets the server's 409 fire on a revision that actually changed.
Holding a different kind mints a new id, as it should.

`drain` prints the answers waiting in `.handoff/responses/`, oldest first, and
`--archive` moves them into `responses/processed/` once acted on. Files ending
`.partial` are skipped by name.

## The state file

`.handoff/state.json`. Written by `scripts/handoff.py` after every stage
transition, and by the server when an ask is answered. It is git ignored,
because it is runtime state rather than source.

```json
{
  "version": 1,
  "generated": "2026-08-24T21:58:00Z",
  "projects": [ ... ]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `version` | number | yes | Schema version. Currently `1`. |
| `generated` | string | no | UTC instant this file was last written. |
| `projects` | array | yes | Every project the console shows. Designed for 3 to 12. |

### A project

| Field | Type | Required | Meaning |
|---|---|---|---|
| `slug` | string | yes | The project's directory name under `work/`. Used as its display name and as the key `POST /api/respond` matches on. |
| `state` | string | yes | One of `held`, `running`, `ready`, `clear`, `stopped`. Nothing else renders. |
| `stage` | string | yes | The agent this project is at, for example `component-builder`. Use the real agent name: it selects the column the thread is drawn to. |
| `since` | string | yes | UTC instant the project entered `state`. Drives the elapsed time on `running` and the timestamp on `stopped`. |
| `stageCount` | number | no | How many stages have run. Shown only when `state` is `clear`. |
| `ask` | object or null | yes | The open ask. Must be present when `state` is `held` or `stopped`, and `null` otherwise. |
| `history` | array | yes | What happened, oldest first. Never reordered by the console. This is what the thread is drawn from. |
| `askSeq` | object | no | Per kind counter behind the `<slug>/<kind>/<n>` ask ids. Written by `handoff.py`, ignored by the console. Do not renumber it: browser drafts are keyed on the ask id it produces. |

The five states, and the terminus each one draws at the end of its thread:

| `state` | Means | The mark at the end of the thread | The word |
|---|---|---|---|
| `held` | Parked at a handoff, needs a decision | A 12px vertical cross tick | `needs you` |
| `running` | A stage is executing right now | No terminus. A segment travels forward inside the running stage's column | `running` |
| `ready` | Answered, next stage not started | The thread ends flush at the column boundary, unmarked | `answered` |
| `clear` | Every stage ran and was signed off | A filled 6px square | `done` |
| `stopped` | A stage failed, or the project was closed | A diagonal cut through the thread | `stopped` |

**A `stopped` project needs you exactly as much as a `held` one does.** Both
carry an open ask, both share the attention hue, and `handoff.py show` has
always counted both as waiting. So does the console: the count in the top
right, the `document.title` and the list of what else needs answering all
include stopped projects.

Only the oldest of them renders its ask in full at the top of the board.
The rest appear as compact cards under it. A `stopped` project carries its ask
too, reachable from its own page.

At 375px a row is two lines rather than three: the project name, the stage and
the status word share line one, and the thread has line two to itself. Above
that breakpoint the stage name is visually hidden but stays in the box, so it
still reaches assistive technology. That matters more than it looks: the
column headers and the whole drawing are `aria-hidden`, so it is the only
thing telling a screen reader which stage a project is at.

### A history entry

| Field | Type | Required | Meaning |
|---|---|---|---|
| `at` | string | yes | UTC instant, or a bare `YYYY-MM-DD` when the clock time genuinely was not recorded. A bare date prints as `Aug 23` rather than a made up time. |
| `kind` | string | yes | `stage` for something the machine did, `decision` for something the operator did. Decisions are set in the document face. |
| `text` | string | yes | One line, lower case, in the console's voice. For example `component-builder finished`. |
| `stage` | string | no | The agent name this entry is about, for example `component-builder`. See below. |
| `event` | string | no | `started`, `finished` or `failed`. See below. |
| `detail` | string | no | A measured value shown hard right. For example `12 files` or `2,840 words`. |
| `quote` | string | no | Written feedback, verbatim. Set in the document face under the entry. |

Only three kinds of event belong here: a stage started, a stage finished, and a
decision the operator made. Not tool calls, not file reads, not token counts.

#### `stage` and `event`

These two are optional, and they are the machine readable form of what `text`
already says in prose. The console draws each project's thread from its
history, and deriving that thread by parsing free-form English is brittle: one
reworded message and a project's line disappears from the board. Writing both
fields makes the drawing exact.

```json
{
  "at": "2026-08-25T06:01:00Z",
  "kind": "stage",
  "text": "component-builder finished",
  "stage": "component-builder",
  "event": "finished",
  "detail": "4 files"
}
```

`scripts/handoff.py` writes them on `start`, `finish` and `stop`. They are
**purely additive**:

- `text` is still written, and is still what a person reads.
- When they are absent, the console parses `text` against the known agent names
  and the words `started`, `finished` and `stopped`. Every state file produced
  before these fields existed still draws a complete thread. `state.sample.json`
  ships one project in the old shape on purpose, so the fallback is exercised
  by the shipped file rather than only by a test.
- An entry with neither field and no parseable text is skipped by the drawing
  rather than guessed at. It still renders in the project's history list.
- A `decision` entry carries neither field. Returns are read from the decision
  text instead: `you sent it back`, or `you sent 3 of 8 back to the builder`.

How a thread is built from these:

| Recorded | Where the thread reaches |
|---|---|
| `started` | The middle of that stage's column |
| `finished` | The right boundary of that stage's column |
| `failed` | The middle of that stage's column, where it died |
| a return decision | The thread restarts from the builder column, and a repeat mark is added |

**A row draws one pass: the current one.** The thread runs from where this
pass began to where the record stops, on the same baseline as every other row
on the board. A project that has been sent back carries a **repeat mark**, one
short tick per return up to three, hanging below the point work came back to,
which is where the current pass begins. The pass count prints in the time
column whenever that cell has nothing else to say, and always once there have
been more than three.

Earlier passes are not drawn. Two rounds were spent stacking them as parallel
hairlines joined by return arcs, and on screen that is a hollow rectangle
rather than a thread: the eye segments the closed shape before it reads any
line weight, so widening the spacing and receding the tone did not rescue it.
This gives up the claim in `DIRECTION-2.md` section 6 that a thread can be
physically longer than the track. That loss was authorised at review. The
count carries the fact the drawing was trying to carry, and it carries it
legibly.

**The status word never leaves the column its state refers to.** It prints
after the terminus when the whole word fits inside that column, and before it
when it does not, so the mark and its label stay together and neither strays
into a column the project has not reached. A word may extend leftward past its
column edge when the column is too narrow to hold it, because everything to the
left is ground the project has already covered. `running` has no terminus at
all, so its word is right aligned inside the running column and the travelling
segment stops where the word begins. The only exception is a terminus that has
reached the end of the usable track, where there is no column to the right to
be confused with, and the word prints after it.

That rule replaced one that printed every word after the terminus. For a
terminus sitting on a column boundary it put the word one pixel into the next
column, and for `running` it put the word a whole column away from the only
mark naming it: a project running its first stage showed the segment inside
`design-strategist` and the word inside `component-builder`.

**Nothing is ever drawn behind the status word.** A terminus that stops mid
track, which is every project held or answered before the reviewer, would
otherwise have the track running straight through its own label, which is not
a label but a strikethrough. The track and the thread break around the word
with five pixels of clear space either side. They break rather than the word
being plated with a background colour, because a plate stops matching the
moment the row takes its hover fill, and a break is what a technical drawing
does where a dimension line meets its own number.

A history entry naming a stage outside the three pipeline agents appends a
fourth column at the right rather than being dropped. Silently discarding a
recorded event is worse than an odd looking board.

### An ask

Common to all four shapes:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Stable and unique. Drafts are saved against it, so changing it discards typed feedback. Convention: `<slug>/<kind>/<n>`. |
| `revision` | number | yes | Bump whenever the ask's content changes. The console sends back the revision it displayed, and the server refuses the write with a 409 if it no longer matches. |
| `kind` | string | yes | `direction`, `build`, `findings` or `question`. Anything unrecognised renders as `question`. |
| `headline` | string | yes | The one line at the top of the field. |
| `from` | string | no | The agent that produced it. |
| `at` | string | no | When it was produced. |
| `meta` | string | no | One short fact under the headline, for example `2,840 words`. It gets its own cell rather than being joined to anything. |

By `kind`:

| `kind` | Extra fields |
|---|---|
| `direction` | `document`: a markdown string. Rendered by the hand written renderer, which supports h1 to h3, paragraphs, lists including one level of nesting, thematic breaks, tables, fenced code, blockquotes, bold, italic, inline code and links. Anything else degrades to the characters that were written, never to silence. A table is as wide as its widest row, a pipe inside inline code is a character rather than a column boundary, and a column of hex values gets real square swatches. |
| `build` | `previewUrl`: http or https, embedded in a sandboxed iframe on desktop and offered as a link on a phone. `changed`: an array of strings describing what changed. |
| `findings` | `findings`: an array of `{ id, severity, text, where }`. `severity` must be `must-fix`, `worth fixing` or `nitpick`. `where` is a path and line, set in the machine face. `to`: who they go back to, default `the builder`. |
| `question` | `question`: the question text. `note`: an optional second line. `options`: two to four `{ id, label }`. Omit `options` for a free text answer. |

Every string in an ask is treated as untrusted and is rendered as text. Markup
inside a document, a finding or a label appears as characters on the page, and
a `javascript:` link renders as its label with no anchor.

## What a response produces

`POST /api/respond` takes:

```json
{
  "project": "career-site",
  "askId": "career-site/direction/1",
  "revision": 3,
  "decision": "approve",
  "payload": {}
}
```

`decision` is one of `approve`, `changes`, `send-findings`, `close-review` or
`answer`. `payload` carries `note` for written feedback, `findings` and `of`
for a triage, and `answer` and `label` for a question.

Responses:

| Status | When |
|---|---|
| 200 | Written. The body is the new complete state, which the console renders immediately. |
| 409 | `revision` does not match the ask in `state.json`, the ask carries no `revision`, or the project has no open ask. Nothing is written. |
| 404 | No `.handoff/state.json`, or no project by that slug. |
| 400 | Body missing, too large, not a JSON object, or missing a required field. |
| 403 | The `Host` header is neither `localhost` nor a literal IP address. |
| 500 | `state.json` exists and could not be parsed. The body carries the reason, and the console prints it rather than claiming the server is down. |

On success two things happen.

**A response file** lands in `.handoff/responses/`, named
`<utc-timestamp>-<project>.json`, for example
`20260825T031515Z-career-site.json`:

```json
{
  "at": "2026-08-25T03:15:15Z",
  "project": "career-site",
  "askId": "career-site/direction/1",
  "askKind": "direction",
  "revision": 3,
  "decision": "changes",
  "payload": { "note": "The rail should list h2 only, not h3." }
}
```

This directory is the orchestrator's inbox. Drain it, act on it, and write the
next `state.json`. The console never deletes from it.

**Ignore any file ending `.partial`.** A response is staged under that name,
then `state.json` is moved, then the response is renamed into place. A
`.partial` left behind means the process died mid-write, and the project it
belongs to is still `held`, so nothing was lost and nothing needs replaying.

**`state.json` is rewritten atomically**, through a temp file in the same
directory and an `os.replace`, so a reader never sees a partial file. The
answered project moves from `held` to `ready`, its `ask` becomes `null`, its
`since` becomes now, and one `decision` entry is appended to its `history`.

## Fonts

Four latin subset woff2 files in `fonts/`, all SIL OFL 1.1, all variable, all
self hosted. Three voices: the system speaks in one, documents speak in
another, and machine literals speak in a third.

| File | Family | Axes as shipped | Voice | Size |
|---|---|---|---|---|
| `instrument-sans-var-latin.woff2` | Instrument Sans | `wght` 400 to 700, `wdth` 75 to 100 | Interface | 56KB |
| `newsreader-var-latin.woff2` | Newsreader | `wght` 380 to 700, `opsz` 6 to 72 | Documents | 115KB |
| `newsreader-italic-var-latin.woff2` | Newsreader italic | `wght` 380 to 620, `opsz` 14 to 22 | Notes, captions, quotes | 99KB |
| `geist-mono-var-latin.woff2` | Geist Mono | `wght` 400 to 500 | Paths, slugs, hex values, code | 15KB |

285KB in total. Only the first two are preloaded, which is 170KB on the
critical path. The italic and the mono load lazily and neither is reached by
the board: the italic is first needed by a rendered direction document, and
the mono by a path or a hex value inside one.

### Where they came from, and what was changed

All four were fetched from the Google Fonts CSS2 API, latin subset, and are
unmodified in outline. Three of them were then **instanced** to the axis
ranges this build actually asks for, using `fontTools.varLib.instancer`:

| File | Original | Instanced to | Result |
|---|---|---|---|
| Newsreader italic | 143KB | `wght` 380:620, `opsz` 14:22 | 99KB |
| Newsreader roman | 129KB | `wght` 380:700 | 115KB |
| Geist Mono | 23KB | `wght` 400:500 | 15KB |

Nothing the stylesheet can reach was removed. The italic keeps 380 so the
dark mode weight grade still applies to it, and 620 so an italic inside a
bold heading still renders at its own weight; it keeps `opsz` 14 through 22
so optical sizing still works across every size italic appears at. Geist Mono
is instanced to exactly the two weights the type spec names. Instrument Sans
was left at full range, because the width axis is the point of that choice
and narrowing it would save seven kilobytes for a real loss of headroom.

Vertical metrics are identical before and after instancing, which matters
because each family also declares a metric matched local fallback with
`size-adjust`, `ascent-override` and `descent-override` so that a font swap
does not move any row. Those numbers were read out of the `head`, `hhea` and
`OS/2` tables of the real font files rather than estimated.

Weights are set through `font-variation-settings` on the `wght` axis rather
than through `font-weight` keywords, so they are continuous and exact, and
every weight steps down by 20 units in dark mode. Light text on a dark ground
reads optically heavier, and a variable axis is the honest way to pay for
that rather than jumping to the next named weight. Because
`font-variation-settings` inherits, every mono element states its own axis
value; a `font-weight` declaration on those elements would be ignored.

### Licences

The SIL Open Font Licence requires the licence to travel with redistributed
fonts, and this repository is public, so it travels here:

| Licence | Family | Upstream |
|---|---|---|
| `fonts/OFL-Instrument-Sans.txt` | Instrument Sans | [Instrument/instrument-sans](https://github.com/Instrument/instrument-sans) |
| `fonts/OFL-Newsreader.txt` | Newsreader, roman and italic | [productiontype/Newsreader](https://github.com/productiontype/Newsreader) |
| `fonts/OFL-Geist-Mono.txt` | Geist Mono | [vercel/geist-font](https://github.com/vercel/geist-font) |

All three are SIL OFL 1.1. None of the three declares a Reserved Font Name,
so the instanced files above keep their family names.

## A note on the size of app.js

`app.js` runs to roughly 2146 lines, over the 700 line tripwire in amendment
I. **This was reviewed and accepted rather than overlooked, twice, and is
deliberate.** That was reviewed and accepted rather than overlooked. Three things account
for most of it and none is optional: the hand written markdown renderer, which
exists because agent authored text is untrusted and no library is allowed; the
four ask shapes, which are four genuinely different layouts rather than one
layout with a switch in it; and the flow model and its drawing, which is the
signature of the tool. The tripwire was there to catch over-building, and
cutting any of those would mean doing less rather than building less.

## Checking the markdown renderer

```
node scripts/check-markdown.js
```

Seventy nine assertions against the renderer, run from the repository root,
including one pass that renders every direction document in this repository and
checks that nothing was altered. They
slice the functions out of the shipping `app.js` rather than copying them, so
they test what actually ships. Node standard library only, no packages.

They exist because two renderer bugs have shipped and both had the same shape:
the console silently altering the text of a document it was asking a person to
approve. The first turned `DESIGN_VARIANCE` into italics. The second split any
hard wrapped list item into a listitem plus a stray paragraph and restarted the
next list at one, which fired on essentially every list in this repository,
because every direction document here is wrapped at about eighty characters.
A third and a fourth followed: a thematic break was appended to whatever list
was open, because `---` had no branch of its own, and every nested list was
flattened to one level while a nested ordered list broke its parent and
renumbered itself from one. A fifth was quieter and worse: a table row carrying
more cells than its header had the surplus dropped, and a pipe inside inline
code split a cell in half.

The assertions cover all of them, plus wrapped ordered items, numbering across
a blank line, the block types that must end a list, hex swatches, link forms
that are deliberately not supported, and every scheme `safeHref` has to
refuse.

## Checking the drawing

```
python -m http.server 8788 --directory work
open http://localhost:8788/agent-console-check/
```

`work/agent-console-check/` loads this console in an iframe at 1440, 1240,
900, 720 and 375 and measures what it actually drew. It is the other half of
the markdown checks: those run in node against the source, and these need a
layout engine, real fonts and the shipped sample data.

It asserts that nothing is drawn behind a status word, that every word stays
inside the column its state refers to or past the end of the track, that no
drawn line is shorter than twelve pixels, that every axis aligned coordinate
sits on a half pixel, that no two paths close a circuit, that the header grid
and the row grid divide the same width, and that the fragment floor swallowed
no terminus or repeat mark.

Every one of those is there because the defect it checks for reached a
shipped build and none of them could be seen by reading the code:

- the track ran straight through the status word, which renders as a
  strikethrough on the one phrase you are looking for;
- the word for a running project sat in the next column, so a project running
  its first stage announced itself as running at the second;
- cutting the hole for the word left five pixel offcuts between the word and
  its terminus, which render as stray dashes;
- the header grid was sixteen pixels narrower than the row grid, so every
  column label sat about eleven pixels left of the column it named.

## The other two routes

`GET /api/state` returns the file, 404 when it does not exist, or 500 when it
exists and will not parse. Both API routes send `Cache-Control: no-store`.
Static types served include `.html`, `.css`, `.js`, `.json`, `.woff2`, `.svg`
and `.txt`, the last so the font licences render in a browser rather than
downloading.
Everything else is served from this directory only, and a path that resolves
outside it returns 404.

The server binds `0.0.0.0` so a phone can reach it, and it answers only when
the `Host` header is `localhost` or a bare IP address. That costs nothing for
the two real ways in and takes away the hostname a DNS rebinding attack needs.

After `GET /api/state` 404s, the console backs the poll off rather than asking
again every five seconds for the rest of the session. It keeps retrying, so
starting the server later is picked up without a reload.

## Views

The board is `#/`, a project is `#/p/<slug>`. Both are real URLs: Back returns
to the board, and a reload at a project lands on that project.
