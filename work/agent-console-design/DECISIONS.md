# Decisions and amendments: Handoff

PM review of `DIRECTION.md`. Where this document and the direction conflict,
**this document wins**. Everything not mentioned here is approved as written.

---

## Verdict

Approved. The concept earns itself: absolute block signalling is a real answer
to a real property of this system (it is parked most of the time), not a theme
bolted onto a dashboard. The held line is a genuine signature - a status system
that *removes* something to say "waiting" instead of adding a glowing pill.
Single hue, no badges, no sidebar, no modals, no shadows: all held.

Two things in the direction are the strongest ideas in it and are not up for
negotiation during the build: **the two-voice type split** (console sans vs
document serif) and **the rule that never draws the future**. A builder that
softens either has broken the design.

---

## Resolved open questions

**1. Where state comes from.** A JSON file at `.handoff/state.json`, written by
the orchestrator after every stage transition. `running` is real, not theatre -
the orchestrator writes `running` when it spawns a subagent and rewrites on
completion. The console polls `GET /api/state` every 5 seconds. No websockets,
no file-watch in the browser.

**2. Does the console write back. Yes.** This is the fork the strategist flagged
and the answer is the harder one. `POST /api/respond` writes a response file
into `.handoff/responses/` and atomically updates `state.json` to move the
project from `held` to `ready`, appending the decision to its history. The
orchestrator drains that inbox. All four ask shapes stay, and they are real.

This requires a server, so: `scripts/console.py`, Python standard library only,
no dependencies, matching the precedent set by `scripts/build.py`. It serves the
static console and adds exactly two API routes. Binds `0.0.0.0:8790` so a phone
on the LAN can reach it.

**3. Literata for documents. Keep.** The two-voice split is the best idea in the
document. Ship it.

**4. `stopped` shares the yellow field with `held`. Accepted, with a
requirement.** The argument holds - both need a person, and a second hue would
undo the whole color system. But the two must be separable *before* reading the
word. The terminus glyph does that work: `held` is a cross-bar, `stopped` is a
diagonal cut, and the `stopped` field additionally carries a 1px
`hold-ink-dim` border where `held` has none.

**5. Name. "Handoff." Approved.** It is the system's own word.

**6. Phone. Real, build it.** The server binds on the LAN, so the 375px case is
not hypothetical. Both the 720px and 375px cases ship.

**7. Notification. Title and favicon only.** No `Notification.requestPermission`
on a local tool. The favicon is an inline SVG data URI with two states: rule
continuous, and rule broken. The held field stays as loud as specified.

**8. Build preview. Embed the iframe and link out**, both, as specified. The
iframe must be sandboxed - see amendment F.

**9. Three families. Keep all three**, latin subset only.

**10. Projects in flight. 3 to 12 rows.** No grouping.

---

## Amendments, all mandatory

**A. Markdown rendering is hand-written and escapes everything.** No library.
Support exactly: h1-h3, paragraphs, ul/ol, tables, fenced code, blockquote,
bold, italic, inline code, links. Everything else degrades to a paragraph.
Every agent-authored string in `state.json` is untrusted input: escape it, and
build the DOM with `createElement` and `textContent`. **Zero `innerHTML` on any
value that came from state.** This is not a nicety; the console renders text
written by an agent that read the open internet.

**B. Never swap an open ask out from under the reader.** If a poll returns a
state where the open ask's `revision` changed, keep showing what he is reading
and print one line in the console voice at the top of the ask: `this ask changed
at 22:41. reload to see it.` The `POST` carries the revision; the server returns
409 on a mismatch and the console shows the same line. Silently replacing a
document someone is halfway through reading is how a tool loses trust.

**C. Focus ring needs two tokens.** `--focus` yellow works on dark surfaces and
fails completely on the light-mode `hold-field` (`#FFE873`). Add
`--focus-on-field`: `#1A1400` in light, `#F5D547` in dark. Every focusable
element inside a held field uses it. The direction's own sample finding jokes
about this exact bug - do not ship it.

**D. Typed feedback survives everything.** Draft text in any textarea persists
to `localStorage` keyed by ask id, restores on load, and clears only on
successful submit. A background poll or an accidental reload must never eat a
paragraph of written feedback.

**E. Keyboard shortcuts do not fire in text fields.** `a` must type the letter a
when the feedback textarea has focus, not approve the direction. Guard on
`event.target` being an input, textarea, or `contenteditable`, and on modifier
keys. This is the single most likely bug in the build and it is a data-loss bug.

**F. The preview iframe is sandboxed.** `sandbox="allow-scripts"` without
`allow-same-origin`. The console is rendering another project's JavaScript
inside itself.

**G. Accessibility floor, non-negotiable.** Real `<button>` elements, real
`<input type="checkbox">`, `<main>` and `<nav>` landmarks, a visible focus ring
on every interactive element in both modes, and the checkbox list is a real
fieldset with a legend. The board rows are links or buttons, not divs with
click handlers.

**H. Two data sources, both honest.** `.handoff/state.json` is live and is
seeded from this repo's actual history - `career-site` really did run all three
stages and really is clear. `work/agent-console/state.sample.json` ships
alongside and is used only when the API is not reachable (someone opened the
build over `static-preview`). In that case the footer prints one line:
`sample data. the api is not running.` No invented activity in the live file,
and no pretending the sample is live.

**I. File budget.** `index.html`, `styles.css`, `app.js`, `state.sample.json`,
`fonts/`. No build step, no npm, no bundler. `app.js` stays readable - if it
crosses roughly 700 lines, something is being over-built.

---

## What gets rejected on sight at review

Anything on the direction's section 8 anti-pattern list. Plus: a loading
spinner, a "0 held" empty container where the calm state should simply be
shorter, a `<div>` with an `onclick`, `high/medium/low` severity words, and any
string containing an em-dash.
