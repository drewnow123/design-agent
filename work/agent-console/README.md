# Handoff

A local console for one person to see where the design pipeline stopped, and
to release it. It reads `.handoff/state.json` and writes real responses back.

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
`sample data. the api is not running.` in the footer.

## Keyboard

Printed next to the controls it applies to. `j` and `k` move down and up the
line, `Enter` opens the project under the cursor, `a` takes the primary action
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
`--option`). Re-holding the same ask bumps `revision` instead of minting a new
id, which keeps the operator's typed draft alive.

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
| `stage` | string | yes | The agent this project is at, for example `component-builder`. Set in the machine face, so use the real agent name. |
| `since` | string | yes | UTC instant the project entered `state`. Drives the elapsed time on `running` and the timestamp on `stopped`. |
| `stageCount` | number | no | How many stages have run. Shown only when `state` is `clear`. |
| `ask` | object or null | yes | The open ask. Must be present when `state` is `held` or `stopped`, and `null` otherwise. |
| `history` | array | yes | What happened, oldest first. Never reordered by the console. |
| `askSeq` | object | no | Per kind counter behind the `<slug>/<kind>/<n>` ask ids. Written by `handoff.py`, ignored by the console. Do not renumber it: browser drafts are keyed on the ask id it produces. |

The five states:

| `state` | Means | What the console draws |
|---|---|---|
| `held` | Parked at a handoff, needs a decision | Rule stops with a cross bar, and the ask renders in full on the board |
| `running` | A stage is executing right now | Rule continues, a segment travels down it |
| `ready` | Answered, next stage not started | Rule continues solid |
| `clear` | Every stage ran and was signed off | Rule terminates in a filled square, the row recedes |
| `stopped` | A stage failed, or the project was closed | Rule ends in a diagonal cut, and the field carries a border |

Only `held` projects appear in the top zone of the board. A `stopped` project
carries its ask too, reachable from its own page.

### A history entry

| Field | Type | Required | Meaning |
|---|---|---|---|
| `at` | string | yes | UTC instant, or a bare `YYYY-MM-DD` when the clock time genuinely was not recorded. A bare date prints as `Aug 23` rather than a made up time. |
| `kind` | string | yes | `stage` for something the machine did, `decision` for something the operator did. Decisions are set in the document face. |
| `text` | string | yes | One line, lower case, in the console's voice. For example `component-builder finished`. |
| `detail` | string | no | A measured value shown hard right. For example `12 files` or `2,840 words`. |
| `quote` | string | no | Written feedback, verbatim. Set in the document face under the entry. |

Only three kinds of event belong here: a stage started, a stage finished, and a
decision the operator made. Not tool calls, not file reads, not token counts.

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
| `meta` | string | no | One line under the headline, for example `2,840 words`. |

By `kind`:

| `kind` | Extra fields |
|---|---|
| `direction` | `document`: a markdown string. Rendered by the hand written renderer, which supports h1 to h3, paragraphs, lists, tables, fenced code, blockquotes, bold, italic, inline code and links. Anything else degrades to a paragraph. A table column of hex values gets real swatches. |
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

## A note on the size of app.js

`app.js` runs to roughly 1,200 lines, over the 700 line tripwire in amendment
I. That was reviewed and accepted rather than overlooked. About half the file
is two things the amendments require outright: the hand written markdown
renderer, which exists because agent authored text is untrusted and no library
is allowed, and the four ask shapes, which are four genuinely different
layouts rather than one layout with a switch in it. The tripwire was there to
catch over-building, and cutting either of those would mean doing less, not
building less.

## The other two routes

`GET /api/state` returns the file, 404 when it does not exist, or 500 when it
exists and will not parse. Both API routes send `Cache-Control: no-store`.
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
