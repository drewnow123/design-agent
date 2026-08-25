# Decisions: the Front End Agents rebuild

PM decisions for the redesign. Reading order and precedence, highest first:

1. **This document.**
2. `DIRECTION-3.md` — the visual language. Type, colour, elevation, radius,
   motion, how the diagram is drawn, 4K rendering.
3. `DIRECTION-2.md` — the structure. The flow form, vocabulary, sentence
   templates, responsive behaviour, defect fixes.
4. `DECISIONS.md` — amendments A through I. **All nine still stand.**
5. `DIRECTION.md` — the original. Superseded except where the above defer to it,
   chiefly the direction-document reading treatment.

---

## The owner is asleep

He asked for this to be finished autonomously and said he wants no further
input. So: no questions, no "confirm before I proceed", no options left open.
Every decision below is made. If something is genuinely ambiguous, pick the
better answer, implement it, and say what you picked in your report.

He also said "iterate and then iterate". This will go through a review pass and
a fix pass after you. Build it to survive that, not to squeak past it.

---

## The seven questions `DIRECTION-2.md` left open, answered

**1. Can a thread be drawn from the current contract? Not reliably, so extend
it.** Add two optional fields to history entries, written by
`scripts/handoff.py`:

```json
{ "at": "...", "kind": "stage", "text": "component-builder finished",
  "stage": "component-builder", "event": "finished" }
```

`stage` is the agent name. `event` is `started`, `finished` or `failed`. Both
optional. **Keep the text parser as a fallback** so existing state files and the
shipped sample still render. Update `handoff.py` to write them, and document
both fields in `work/agent-console/README.md`. Purely additive: nothing that
reads the old shape may break.

**2. Column set is hard-coded to the three agents**, in pipeline order. A
history entry naming a stage outside that set appends a fourth column at the
right rather than being dropped. Silently discarding a recorded event is worse
than an odd-looking board.

**3. Three stacked passes**, then the row stops growing and the pass count
prints in the time column.

**4. Content cap 1240px.** Approved as specified.

**5. Keep the mini thread inside the open ask.** Cut at 375px, per
`DIRECTION-2.md`.

**6. Storage keys do not change.** `handoff.theme` and every draft key stay
exactly as they are. Renaming them eats the owner's saved feedback drafts, which
is the whole point of amendment D. This is the most likely well-meant mistake in
this build.

**7. `answered` is the word.** Keep it.

---

## Mandatory, beyond the directions

**J. The rename is cosmetic only.** `Front End Agents` is a display string.
`scripts/handoff.py`, `scripts/handoff_state.py`, `scripts/console.py`,
`.handoff/state.json`, `handoff.service`, every route, every file path and every
`localStorage` key keep their names. The console is deployed and running from a
systemd unit; a path rename breaks a live service.

**K. Do not regress anything already verified.** These were checked against the
running build and must still hold:

- Keyboard shortcuts do not fire while a text field has focus. Typing `a` in the
  feedback box types an `a`.
- Textarea drafts persist to `localStorage` keyed by ask id and survive a poll
  and a reload.
- Zero `innerHTML` on anything sourced from state. The markdown renderer is hand
  written, escapes everything, and forbids intraword `_` emphasis so
  `DESIGN_VARIANCE` renders intact.
- `safeHref` rejects `javascript:`, `data:`, `vbscript:` and protocol-relative
  `//host`.
- The revision guard: a poll never replaces an ask being read, and a stale
  `POST` gets a 409.
- The preview iframe is sandboxed `allow-scripts` without `allow-same-origin`.
- Findings checkboxes carry the finding text in their accessible name, not just
  a severity word, and sit in a real fieldset with a legend.
- One `h1`, one `main`, one `nav`, zero `div` with a click handler.

**L. The server keeps working.** `scripts/console.py` serves this directory and
its API. If you change a filename, the server must still serve it. Do not touch
the API contract, the atomic write, the cross-process lock or the `Host` gate.

**M. Both data sources stay honest.** Live state from `/api/state`; the bundled
`state.sample.json` only when the API is unreachable, with the footer saying so.
Refresh the sample so it exercises the new flow: at least one project that has
been round the review loop twice, so the return arc and the stacked offset are
visible without contriving anything.

**N. No new dependencies.** Vanilla HTML, CSS and JS. No build step, no npm, no
CDN. Fonts self-hosted as woff2 in `work/agent-console/fonts/`. The three new
faces are on Google Fonts; fetch the woff2 files with `curl` and verify each
starts with `wOF2` and exceeds 5KB before shipping it. If one cannot be
fetched, do not ship a dead `@font-face` — fall back to a system stack for that
voice and say so.

**O. Delete the old fonts you no longer use.** Do not leave four orphaned woff2
files in the repository.

---

## What gets rejected at review

Everything on `DIRECTION-3.md` section 9's pre-flight list, which is mechanical
and which you should run yourself before reporting.

Plus the one that is not mechanical, quoted because it is the thing most likely
to go wrong:

> Look at the board and ask whether the drawing still looks drawn. If the thread
> has picked up a shadow, a rounded cap, a hover state or a bounce, section 0
> has been broken and the rest of the work does not matter.
