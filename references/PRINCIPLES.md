# Design principles

Andrew's standing taste, and the defects that keep coming back.

**Every stage reads this before it starts.** The strategist reads it before
proposing, the builder before writing, the reviewer before auditing. It exists
because the subagents start cold on every brief: without it they re-derive the
same taste from scratch each time, and you re-approve or re-correct the same
things. Two projects in, the reviewer was already finding the same class of
defect twice.

Nothing here is theoretical. Every line came out of a real direction document,
a real review, or a ruling Andrew made, and the source is named so a future
reader can go and check rather than take it on faith. **Where a rule and a
brief genuinely conflict, say so and stop.** Do not quietly pick one.

---

## The standing bar

> Don't accept AI slop, and don't accept the easiest route if a higher quality
> one exists.

That is the whole thing, and the rest of this file is what it has meant in
practice. Two corollaries that have earned their place:

- **Where a constraint makes an easy answer possible, take the harder real
  one and say why.** The console was nearly a static mockup. The read-only
  version would have collapsed four different kinds of ask into one display.
  Building the real one is what made it a tool.
- **Verify load-bearing claims rather than relaying them.** A stage reporting
  its own work is not evidence. A reviewer caught a markdown renderer silently
  deleting underscores from identifiers, which would have altered the text of
  documents the tool was asking Andrew to approve.

---

## Rejected on sight

No argument needed, no review time spent. From `agent-console-design/DECISIONS.md`
and `DIRECTION-3.md` section 9.

- Uppercase anywhere. Letter-spacing above `0.012em`.
- An eyebrow: a small wide-tracked label sitting above a heading.
- Coloured dots, badges, pills, or `high` / `medium` / `low` severity words.
- A loading spinner.
- An empty-state container where the calm state should simply be shorter.
- A `<div>` with an `onclick`. Interactive things are `<a>` or `<button>`.
- Em-dashes and en-dashes, in any visible string, including `aria-label`.
- Emoji.
- A card grid, a bento, or any container wrapped around a one-line entry.
- A gradient. A shadow on anything that is a line.

The uppercase ban is the load-bearing one. **One wide-tracked uppercase
eyebrow undoes the whole thing** and is the single fastest way to make a page
look like every AI console of 2026.

---

## What the reviewer keeps finding

Ranked by how often it has actually happened across `tool-library` and
`work-index`. If you are the builder, check these before reporting. If you are
the reviewer, start here.

### 1. Declarations that reach nothing

The most common defect by a wide margin, and it has appeared in every build so
far in a different disguise:

- a `prefers-reduced-motion` block disabling transitions the stylesheet never
  declared
- `a { color: inherit }` on a page with one link that overrides it anyway
- `data-theme-pref="system"` on `<html>`, read and written by nothing
- 99KB of an italic font face nothing on the page could reach
- `.lede a` styled while a link in a gloss fell back to browser blue

**Dead code is not free.** It reads as intent, so the next person preserves it,
and it hides the fact that the real case was never handled. Before shipping a
rule, ask what selects it. Before shipping a file, ask what requests it.

Where the answer is checkable by machine, check it by machine: a set
difference between what is served and what is asked for found the font in one
line, after two humans had read past it.

### 2. Meaning carried in only one channel

Both directions count, and both have happened:

- a strike-through distinguishing past from future, with no text equivalent
- `aria-current="page"` with no visual counterpart, so screen reader users
  were told which row they were on and sighted users were not

If a thing means something, it means it in both channels.

### 3. Landmarks and reachability

- no `<main>`, so assistive tech has no primary region
- a `<header>` nested inside `<main>`, which is an invalid arrangement
- a horizontally scrolling container that could not be reached by keyboard
- 48px touch targets everywhere except the two controls that were not links

### 4. The band between the breakpoints

A narrow layout was written and tested, a wide layout was written and tested,
and the bug lived in the gap. In `work-index` a dangling leader ran from 621px
to 758px: fine at 620, fine at 800.

**Test the band, not the breakpoint.** And fix it structurally rather than
moving the breakpoint until the one row you tested happens to fit.

### 5. Quietly wrong beats loudly broken, and both beat silence

- a misspelled key in a data file ignored, so a sentence vanished from a
  generated page nobody re-reads
- a nested directory silently dropped by the very generator written to stop
  silent drops
- a count labelled "directories" that was actually counting documents

**A page that is sometimes right is worse than one that is always written.**
Fail loudly, or state the limit in the page's own voice. What you must not do
is produce plausible output that is wrong.

### 6. Depending on the host instead of deciding

- ordering keyed on file modification time, which no git clone preserves
- `.md` served as whatever the machine's MIME database happened to think,
  which on a different Python would have made half the links download
- a prompt naming `python` on a box that only had `python3`

If behaviour differs between two machines, the repository has not decided yet.

---

## How to decide, not what to draw

These are method rulings from `work-index-design/DECISIONS.md`, and they
generalise past that project.

**Encode the condition, not the conclusion.** A check that records an answer is
wrong the first time the situation changes, and nobody re-reads a check that
passes. `work-index` has no reduced-motion block, which is correct *while
nothing on the page moves* — so the check tests whether anything moves, and
fails the moment that stops being true.

**Generate it if staleness is structural.** A hand-maintained page is fine
until the thing it describes changes on a schedule. This pipeline adds a
directory on every brief, so an index maintained by hand is stale by the next
one. Structure gets discovered from disk; prose gets written by a person.

**Elevation belongs to pages that hold objects.** The console has documents,
controls, a preview frame, a response bar, so it has cards and shadows. The
index holds nothing — you read it and leave — so it has neither. Putting
`--elev-1` on a ten-line list raises objects that are not there.

**Furniture may be quiet; anything carrying information may not.** A leader, a
track, a rule carries nothing the labels either side do not already carry, so
it can sit below text contrast. Everything that informs holds 4.5:1 or better.

**A rule should do a job.** A divider between two groups already separated by
space is a rule doing nothing.

---

## Type, colour, motion

The defaults, unless a brief argues otherwise.

**Three voices, and they do the taxonomy work no icon should be doing.** The
system speaks in one face, documents in another, machine literals in a third.
A path is mono because it is a literal, not because mono looks technical.

**Sharp, not friendly.** The temptation with "premium" is a geometric with
circular bowls. That is a marketing register. A tool's register is neutral and
tight. Rounding is spent on radius and elevation, never on the letterforms.

**Weights step down by 20 units in dark mode.** Light text on a dark ground
reads optically heavier; a variable axis pays for that honestly rather than
jumping a named weight.

**One accent, spent rarely.** In `tool-library`, red exactly twice. An accent
that means "your move" is devalued by appearing where nothing is your move.

**Motion is 140ms colour, or nothing.** No load animation, no stagger, no
reveal on scroll, no lift on hover, no scale on press. Reduced motion means
reduced movement: colour transitions at 140ms may survive it.

---

## How this file grows

After a project is signed off, promote its durable rulings here and leave the
project-specific ones in that project's `DECISIONS.md`. The test is whether the
ruling would help on an unrelated brief.

Keep it short enough to be read every time. A principles file nobody finishes
is worse than a shorter one that gets followed, so when adding, look first for
something to cut or merge.

Cite where each thing came from. The reason is the durable part; the rule
without its reason is the thing that gets "improved" by accident later.
