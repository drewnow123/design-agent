# Visual direction: Handoff, the agent console

Status: approved by PM with amendments. See `DECISIONS.md` for the resolved
open questions and the amendments that override this document where they
conflict.

Dials: DESIGN_VARIANCE 4 (a rail, not a composition) · MOTION_INTENSITY 2 (four behaviors, three of them one-shot) · VISUAL_DENSITY 6 (a register, and it should read like one).

Design read: single-operator control surface for the person who is the bottleneck in his own pipeline, with a ruled-register language, leaning toward native CSS on a two-voice type system and a one-hue color system.

---

## 1. Concept

**This pipeline's normal condition is stopped. The console is built to show where it stopped and to let one person release it.**

Every dashboard I have been asked not to build is a dashboard about *throughput*: how much is moving, how fast, how many agents are hot. This system is the opposite. It has a hard rule that it never chains two agents back to back, so it spends most of its life parked, and the only thing that unparks it is a person reading something and deciding. A console that celebrates activity would be lying about what the system does.

So the organizing idea is borrowed from **absolute block signalling**: a line divided into sections, where a train cannot enter the next section until a person confirms the section is clear. Being *held at danger* is not a failure in that system. It is the system working. The signalman is one person, usually alone, usually at night, and his real instrument is a ruled register in which he writes what happened and when.

That gives me three things the generic agent dashboard cannot give me:

1. **Held is a normal state, not an error state.** It gets the design's attention without getting its alarm vocabulary. No red, no warning triangle, no "action required" banner.
2. **The record only contains what happened.** A signalman's register has no column for what the train intends to do next. Neither does this console. It never draws future stages as ghosted steps.
3. **The whole thing is one line.** Not cards, not tiles, not a grid of agent avatars. A line, with breaks in it.

I am taking the logic, not the decor. No brass, no wood, no lever frames, no semaphore arms, no bell-code sounds, no railway typeface pastiche. If a person can tell this was "themed" as anything, it is wrong.

Signature element: **the held line** (section 6).

---

## 2. Typography

Three families, and the reason there are three is a semantic rule, not a style preference:

> **The system speaks in one voice, the documents speak in another, and machine literals speak in a third. If you cannot say which voice a string belongs to, you have used the wrong face.**

That rule matters because the hardest content problem in this brief is rendering a 3,000-word direction doc with type-scale tables inside a console shell. The answer is not "style the markdown nicely." The answer is that the document is a **different material** from the console around it, and the type is what makes that legible before you read a word.

| Voice | Family | License | What it sets |
|---|---|---|---|
| Console | **Schibsted Grotesk** | OFL, Schibsted Media | Nav, project names, status words, register columns, timestamps, button labels, section headings of the console itself |
| Document | **Literata** | OFL, TypeTogether | Direction docs end to end, finding descriptions, question text, the brief, and anything you type |
| Machine literal | **Spline Sans Mono** | OFL, Eben Sorkin and Lisa Huang | File paths, line numbers, project slugs, agent names (`design-strategist`), hex values, code blocks |

**Why Literata for documents.** It was engineered for long-form reading on screens at small sizes, with sturdy stems that survive dark backgrounds. This console is used at night, and its primary content is a document you have to actually read before deciding. A UI sans at 16px for 3,000 words is the thing that makes people skim and approve without reading, which is the exact failure mode this whole pipeline exists to prevent. Literata is not a decorative serif choice; it is the reading instrument.

**Why Schibsted Grotesk for the console.** It comes out of a news publisher's digital products, so it was built for dense metadata sitting next to prose, it has real tabular figures, and it is essentially unused in developer tooling. It has enough character at 13px that the register does not read as generic UI chrome.

**Why a mono at all, and why almost nowhere.** Monospace as a general interface voice is terminal cosplay and it is the single fastest way to make this look like every AI console of 2026. It appears only where the string is a literal that a machine will consume: a path, a slug, a hex, an agent name. Never a label. Never a heading. Never a status word.

### Scale

Console voice, Schibsted Grotesk:

| Role | Size / leading | Weight | Tracking |
|---|---|---|---|
| Ask headline | 27 / 33px | 600 | -0.015em |
| View heading | 20 / 26px | 600 | -0.01em |
| Project name, board row | 17 / 22px | 550 | -0.005em |
| Control label | 14 / 16px | 550 | 0 |
| Register column, status, timestamp | 13 / 18px | 500 | 0.005em |
| Micro: counts, key hints | 11.5 / 14px | 550 | 0.015em |

Document voice, Literata:

| Role | Size / leading | Weight | Notes |
|---|---|---|---|
| Doc h1 | 26 / 32px | 600 | Once per doc |
| Doc h2 | 21 / 28px | 600 | Hairline above, 36px clear space |
| Doc h3 | 17 / 24px | 700 | No rule |
| Doc body | 16.5 / 1.62 | 400 | Measure capped 66ch |
| Doc table cell | 14.5 / 1.45 | 400 | Tabular lining figures |
| Doc note, caption | 14 / 1.5 | 400 italic | |
| Blockquote | 16.5 / 1.62 | 400 italic | Left rule, no quote marks |

Machine literal, Spline Sans Mono: inline at `0.92em` of its surrounding context, 400. Code blocks 13.5 / 1.55 on `surface-sunk`.

### Rules

- **Three weights per family, maximum.** 400 / 500 / 600 in the console voice, 400 / 600 / 700 in Literata. `font-synthesis-weight: none` so the browser cannot invent a fourth.
- **No uppercase and no letter-spacing above 0.015em anywhere in the console.** Uppercase wide-tracked micro-labels are the badge look I have been told to avoid, and one of them undoes the whole direction.
- **No eyebrows.** Position on the page already says what a region is.
- Tabular figures everywhere a number sits in a column: timestamps, elapsed times, finding counts, word counts, and every numeric column inside a rendered doc table.
- Measure caps: doc prose 66ch, finding descriptions 72ch, question text 60ch.

### Solving the doc-inside-a-console problem

This is the part the brief says not to hand-wave, so:

1. **The doc gets a reading column, not a card.** 620px of prose measure on its own surface, with 40px of internal margin, left edge fixed. The console shell steps back when a doc is open: the board collapses to the spine and a narrow rail, and the doc takes the room.
2. **Tables break the measure to the right.** A type-scale table is 4 or 5 columns and will not fit in 66ch. Rule: prose is capped at 66ch, tables and code blocks may extend to the full doc column (up to 880px), always anchored on the same left text edge. The reader's left margin never moves. This is the standard editorial treatment for figures and it is why the doc stays readable at width.
3. **Table styling.** No vertical rules, ever. One rule under the header row. Row hairlines only when the table exceeds six rows; below that, leading alone separates. Header row in the console voice at 13px, cells in Literata at 14.5px. This is deliberate: the header is the document *labelling itself*, the cells are its content.
4. **Color tokens get swatches.** When a rendered table has a column of hex values, the console draws a 12px solid square from the actual value beside each one. The console understands the document type it is being asked to approve. It is small and it is the single most useful thing this tool can do for approving a direction doc.
5. **Long-doc navigation.** The rail holds a plain text list of the doc's h2 headings. Text only. No progress bar, no pips, no percentage read.
6. **Narrow and phone.** Prose drops to 15.5px at 60ch minimum. Tables scroll horizontally inside the doc column with a hairline shadow-free edge marker. Font size is never reduced to force a table to fit.

**Upgrade path with budget:** Untitled Sans or ABC Diatype for the console voice, Tiempos Text for the document voice, MD IO for machine literals. Refinement, not requirement. The OFL set is genuinely good.

**Self-hosting:** four woff2 files into `work/agent-console/fonts/` (Literata roman variable, Literata italic variable, Schibsted Grotesk variable, Spline Sans Mono variable), latin subset, `font-display: swap`, preload Schibsted and Literata roman. Roughly 200 to 240KB subset. If that is too much, the cut is Literata italic first.

---

## 3. Color

**One hue exists in this interface and it means exactly one thing: something here needs you.**

That is the aesthetic risk in this direction and I want to be explicit about it. Running, ready, clear, stopped, must-fix, worth fixing, nitpick: none of them get a color. They are carried by glyph, ink weight, and position. The moment status is a rainbow of pill badges, the console stops being scannable at a glance and becomes a thing you have to parse, and it becomes indistinguishable from every other agent dashboard.

The hue is **yellow**. Not amber, not gold, not orange. Pure yellow, around 52 degrees. Three reasons:

1. In real control rooms, yellow means *a condition requiring operator attention*. Not failure, which is red. Not normal, which is green. That is precisely the semantics of `held`.
2. It has enormous luminance separation from a dark green-black ground, so a yellow region is visible in a background tab at the edge of vision.
3. It is hard to use, which is why almost nobody uses it, which is why it will not look like anything else. It fails as text on light backgrounds, and I solve that below rather than dodging it.

**Yellow is never a glow and never a dot.** It is a **field**. A held item's entire block sits on a chromatic surface. You see a region of the page change material, not a badge light up. That structural difference is what separates this from the glowing-pill dashboard.

### Dark mode, designed first

The tool is used at night next to a terminal. Every decision below was made in dark and then translated to light, not the other way round.

| Token | Value | Use |
|---|---|---|
| `surface` | `#0E1210` | Page. Cool green-black. Not slate, no blue cast |
| `surface-raised` | `#151A18` | Register block, doc surface, rail |
| `surface-sunk` | `#0A0D0C` | Spine channel, input wells, code blocks |
| `ink` | `#E8EDEA` | Primary text, project names, doc body (14.9:1) |
| `ink-2` | `#A3ADA8` | Secondary, register metadata (7.6:1) |
| `ink-3` | `#7B8681` | Timestamps, cleared projects (4.8:1) |
| `rule` | `#232A27` | Hairlines, table rules |
| `rule-live` | `#38423E` | The spine where the line has run |
| `hold-field` | `#211E0C` | The held region's surface. Warm, visibly a different temperature from everything else |
| `hold-ink` | `#F5D547` | The hue. On `hold-field` 11.6:1, on `surface` 13.1:1 |
| `hold-ink-dim` | `#A8901F` | Field border, rule terminus |
| `focus` | `#F5D547` | Focus ring, 2px, 2px offset |

### Light mode

| Token | Value | Use |
|---|---|---|
| `surface` | `#EFF3F1` | Page. Cool green-tinted paper. Not cream |
| `surface-raised` | `#FAFCFB` | Register block, doc surface |
| `surface-sunk` | `#E4EAE7` | Spine channel, input wells, code blocks |
| `ink` | `#131715` | Primary (15.8:1) |
| `ink-2` | `#4E5854` | Secondary (8.2:1) |
| `ink-3` | `#79837F` | Tertiary (4.6:1) |
| `rule` | `#D8E0DC` | Hairlines |
| `rule-live` | `#B4BFBA` | Live spine |
| `hold-field` | `#FFE873` | The held region's surface, saturated |
| `hold-ink` | `#1A1400` | Ink **on** the yellow field (14.2:1) |
| `hold-mark` | `#8A6D00` | The held glyph where it sits on the normal surface (5.2:1) |

**The light-mode inversion is the point, not a compromise.** In dark, the held field is a warm dark panel with yellow ink. In light, it is a saturated yellow panel with near-black ink, which is how every caution panel in the physical world works. Same idea, correctly expressed for each ground. In both modes the held region is the only chromatic surface on the page.

### What color is allowed to mean

- **Only** "this needs you." Held asks and stopped runs both get the field, because both need him.
- Links are not colored. They are `ink` with a 1px underline at 0.12em offset.
- Focus is the one other yellow, which is consistent: focus marks where your action goes.
- Severities are not colored. Order and weight carry them.
- Nothing else, anywhere, is chromatic.

**Bonus this buys:** when a build preview loads in the iframe, it is full of somebody else's colors. An achromatic console makes the boundary between the console and the artifact under review completely obvious, with no chrome, no border treatment, no label needed.

### Status encoding, and why color alone never carries it

Five states. Named, closed set. Each is carried by **three** signals: a glyph cut into the spine rule, a word in the console voice, and, for the two that need a person, the field.

| State | Means | Spine glyph | Word shown | Field |
|---|---|---|---|---|
| `held` | Parked at a handoff, needs your decision | Rule stops, 12px cross-bar terminus | "held, waiting on you" | yes |
| `running` | A stage is executing right now | Rule continues, 2px segment travels down it | "running, 4 min" | no |
| `ready` | You answered, the orchestrator has not started the next stage | Rule continues solid, no terminus | "ready to run" | no |
| `clear` | Every stage ran and you signed off | Rule runs to the end, terminates in a filled 6px square | "clear" | no |
| `stopped` | A stage failed, or you closed the project | Rule ends in a diagonal cut | "stopped at component-builder" | yes |

`ready` exists because it is real: he approves at 22:00 and the orchestrator runs when he next types in the terminal. Without that state he will wonder why nothing is happening. `held` and `stopped` are kept distinct because a stop that the system designed is not the same event as a stop that went wrong, and the generic "blocked" badge collapses exactly that distinction.

Defaults to `prefers-color-scheme`, with a plain text toggle at the foot of the board that persists in `localStorage`. Not a floating sun-and-moon icon button in the header.

---

## 4. Layout and information architecture

### Shell

There is **no sidebar**. One person, four views, nothing to navigate to.

A **48px gutter** runs the full height of the left edge, and it carries the spine rule. It contains no icons, no logo, no controls. On phone it narrows to 20px and keeps the rule.

The top bar is 52px, one line, and contains exactly two things: the tool name at the left, and the held count at the right. Nothing else. No search field with nothing to search. No settings gear. No avatar. Settings live as plain text links at the bottom of the board.

Content column caps at 1080px and centers. It is never full-bleed on a wide monitor.

**The half-width window is the primary layout.** This gets designed at 720px first and 1440px second, because the brief says it lives next to a terminal. At 720px everything works with no rail and no compromises. Above 1100px the rail appears beside the doc column. There is never a three-column layout.

### The board

```
+--------------------------------------------------------+
| Handoff                                        2 held  |
+-+------------------------------------------------------+
| |                                                      |
|#| +--------------------------------------------------+ |
|#| | Approve the direction for vireo-landing          | |
|#| | design-strategist finished 21:14 · 2,840 words   | |
|-| |                                                  | |
| | |   [ direction doc, Literata, 66ch,               | |
| | |     tables break right, hexes get swatches ]     | |
| | |                                                  | |
| | | ------------------------------------------       | |
| | |  Approve direction  a     Request changes  c     | |
| | +--------------------------------------------------+ |
| |                                                      |
|#|  1 more held                                         |
| |  hall-archive   triage 7 findings from design-reviewer|
| |                                                      |
| |  The line                                            |
| | -------------------------------------------------    |
|#|  career-site     running, 4 min      component-builder|
|#|  brew-balance    ready to run        design-reviewer  |
|#|  hall-archive    held                design-reviewer  |
|#|  meridian-books  stopped 03:12       component-builder|
|#|  archive-2024    clear               3 stages · Aug 19|
| |                                                      |
| |  light / dark · fonts · about                        |
+-+------------------------------------------------------+
```

**Zone 1, your move.** If anything is held, the topmost held ask renders **in full and answerable right on the board**. Not a link to an ask. The actual document, the actual findings, the actual controls. The brief says reading and responding must happen in one place without hunting, and this is the whole answer to that: there is nowhere to hunt to. Additional held items sit beneath as compact single lines and promote into place when the first is answered.

**Zone 2, the line.** Every project as a register row: name, state, current stage, and for cleared projects the stage count and date instead. Sorted by state in the order held, stopped, running, ready, clear. Cleared projects sit in `ink-3` and recede.

**The calm state is a shorter page.** When nothing is held, Zone 1 does not become an empty container or a celebration card. It disappears, and the board starts at the line. Above the line, two sentences of true fact in the console voice:

> Nothing is held.
> design-reviewer finished career-site at 21:14. You signed off nine minutes later.

That is the whole calm state. It closes.

**The empty state, no projects at all**, tells the truth about what this tool is:

> No projects yet.
> This console reads and answers. Projects start in the terminal, by giving the orchestrator a brief.

No illustration, no arrow to a button that does not exist.

**The tab.** `document.title` becomes `2 held · Handoff` when something waits, and `Handoff` when not. The favicon carries the same two states. This tool lives in a background tab beside a terminal, and the tab strip is where "unmissable" actually has to work.

### The four ask shapes

Each is a distinct layout. None of them is a modal. **There are no modals in this tool**, and no toasts either: state changes are shown in place.

**1. Approve a direction doc.** Reading column, per section 2. The response bar is pinned to the bottom of the doc column, not floating over the text. Two controls: `Approve direction` and `Request changes`, the second of which opens a Literata textarea inline directly beneath, with the doc still visible above it. Your written feedback is a document too, so you write it in the document face.

**2. Review a build.** Live preview in an iframe, with a plain text width switch reading `375 / 720 / full`. Text, not device icons. Beside it, `Open in a tab`, because an iframe is not a browser and he will want the real thing. Same response bar: `Approve build` / `Send back with notes`.

**3. Triage review findings.** The findings list is the content. Each finding is a register row:

```
 [ ]  must-fix      The hero headline wraps to three lines at 1280.
                    work/vireo/index.html:88
 [ ]  must-fix      Focus ring is invisible on the yellow field.
                    work/vireo/styles.css:214
 [ ]  worth fixing  Section spacing drifts from the six-step scale in
                    three places, which reads as arbitrary at speed.
                    work/vireo/styles.css:301
 [ ]  nitpick       Two hairline weights in the footer.
```

Severity in the console voice, description in Literata, path and line in mono. Severities use his own vocabulary from `design-reviewer`: must-fix, worth fixing, nitpick. Never high, medium, low. Real checkboxes at the left, aligned to the spine, 20px. Heterogeneous lengths are handled by the two-column register: the severity column is fixed width, the description column flows to whatever height it needs, and one-line findings simply take one line. Submit reads the live count: `Send 3 of 7 to the builder`.

**4. Answer a question.** The smallest shape. Question in Literata at doc h2 size, 60ch. Then either a single text field, or two to four options as a **vertical** list of full-width controls. Never a horizontal row of pills. Options are numbered 1 to 4 and the number key picks them.

### Keyboard

He is sitting at a terminal. `j` and `k` move the line, `Enter` opens, `a` approves, `c` requests changes, `1` through `4` pick an option, `Esc` goes back, `/` focuses nothing because there is no search.

**The shortcuts are printed in the interface** as micro-type hints beside their controls, not hidden behind a `?` overlay. If a shortcut is not worth printing, it is not worth having.

### History, without an activity feed

The brief is right that this is where consoles go noisy. Three rules:

1. **There is no global activity feed.** The board shows current state only. History is per-project and lives in the project view.
2. **Only three kinds of event are recorded:** a stage started, a stage finished, and a decision you made. Never "agent read file X." Never "12 tool calls."
3. **Your lines are set in Literata.** Machine lines are in the console voice. Your decisions and your written feedback are the only entries in the document face, so you can see your own hand in the record without reading it.

```
 21:14   design-strategist finished        2,840 words
 21:23   you approved the direction
 21:23   component-builder started
 22:01   component-builder finished        14 files
 22:40   you sent it back
         "The tier stack reads as an ambient network
          graphic. Either it argues something or it goes."
 22:41   component-builder started
```

A project accumulates maybe a dozen of these in its lifetime, so the project view shows all of them, always. Nothing collapses.

### Half-width and phone

At **720px**: rail gone, doc column takes the full content width at its 66ch measure, register rows drop the stage column into a second line, controls stay side by side. Nothing is hidden and nothing scrolls sideways.

At **375px**:
- Board rows become two lines: name on the first, state and stage on the second. The spine stays at 20px, and the held field still reads as a different material.
- **Answer a question** and **triage findings** render in full and are genuinely answerable. These are the asks he will actually clear from a phone, and they are designed for it: checkboxes at 24px, controls 48px tall, submit pinned to the bottom of the viewport.
- **Approve a direction doc** renders the doc readably at 15.5px with tables scrolling in place, and the response bar pins to the bottom.
- **Review a build** does not embed an iframe. It shows the build's title, what changed, and an `Open the preview` link, plus the same response controls. An iframe of a desktop layout inside a 375px phone is a misleading way to approve a design, and letting him approve from it would be a bug in the tool, not a feature.

### Spacing, radius, elevation

- **Six spacing steps: 4 / 8 / 14 / 22 / 36 / 56.** Every margin, padding and gap is one of these or stated arithmetic on them. Do not add a seventh.
- **Two radii.** `0` for rules and table structure, because lines are lines. `5px` for anything you can click and anything that holds content. That is the whole rule.
- **Zero box-shadows in the stylesheet.** No exceptions, no elevation layer, no glass. Layering is carried by surface tone and rule alone. This is the constraint that keeps the direction from drifting into the thing I was told to avoid, and it is worth defending literally: a grep for `box-shadow` should return nothing but the focus ring, and the focus ring should be `outline`.

---

## 5. Motion

Four behaviors on the whole console. Three of them fire once.

1. **The running segment.** A 2px segment travels down the spine inside the running stage's span, 2s loop, linear. This is the only perpetual motion in the interface and it earns the loop because it is the only genuinely live thing. Everything else holds still.
2. **The rule closing.** When you answer, the open rule draws downward past the answered stage over 450ms on `cubic-bezier(0.16, 1, 0.3, 1)`, and the held field drains to the normal surface over the same interval. This is the payoff. You released the line, and you see it release. It happens once per decision and it is the reason a decision feels like it landed rather than like a form submitted.
3. **Promotion.** When you clear the top ask and another held item exists, it rises into Zone 1 over 180ms so you do not lose your place. Continuity, not decoration.
4. **Control press.** `translateY(1px)` over 60ms on `:active`. Feedback.

**Elapsed times update every 15 seconds, not every second.** "running, 4 min" is coarse on purpose. A ticking counter is a flicker in peripheral vision and it makes a calm tool feel anxious.

What deliberately does not move: no page transitions, no fade-in on load, no skeleton shimmer, no count-ups on any figure, no scroll reveals (this is an app, not a page), no toast slide-ins because there are no toasts, no hover lift, no ambient anything, no confetti or checkmark flourish on completion, no animated gradient border on anything to signal "AI."

**Reduced motion.** Under `prefers-reduced-motion: reduce`, the running segment becomes a static half-filled span, the rule close and the field drain become instant state swaps, promotion is instant, and the press feedback becomes a background tone change rather than a transform. Nothing is lost, because in every case a word already carries the meaning.

Implementation: CSS transitions and one CSS keyframe animation. No scroll listeners, no `requestAnimationFrame`, no libraries.

---

## 6. Signature element: the held line

**A single hairline runs down the left gutter of the entire console, at every scale, and it is drawn only where the pipeline has already been.**

On the board it runs through every project. In a project view it runs through the stages. In an ask it runs alongside the response controls. It is always the same rule.

Where the system is waiting on you, **the rule stops**. Not fades, not dashes, not pulses. Stops, with a 12px cross-bar terminus, and beside the break sits the warm field. Where a project is clear, the rule runs to the end and terminates in a filled square. Where a project stopped, the rule ends in a diagonal cut.

Two consequences make this worth building:

**The break is the message.** Every other status system adds something to say "waiting": a badge, a dot, a glow. This one removes something. A line that does not continue is legible from across the room and does not require reading. **A board with an unbroken rule is a board with nothing for you.** That is the calm state, expressed structurally.

**The rule never draws the future.** No ghosted upcoming steps, no greyed circles, no "3 of 4 complete." Below the break there is nothing, because the system genuinely does not know what comes next: the reviewer may send the build back, and then the rule simply continues with another `component-builder` stage. The rule is a record, not a plan. That is what separates it from the progress stepper it would otherwise be mistaken for, and it is the same reason a signalman's register has no column for intentions.

---

## 7. Reference points

**Absolute block signalling and the signal box train register.** Take: a person confirms the section before anything enters it; "held at danger" is normal operation and not an alarm; the register is a terse ruled record of what happened, kept by one person, at night. Leave: every piece of the decor. No brass, no wood, no lever colors, no semaphore glyphs, no bell codes as notification sounds, no railway type pastiche.

**Reading software that respects a measure, specifically iA Writer and Instapaper's reader.** Take: a real measure, a reading face, and no chrome wrapped around the text. This is the calibration for the direction-doc surface, and it is why the doc gets its own material rather than being styled markdown inside a card. Leave: the app around it, and the minimalist-blog look that comes with it.

**Anti-reference, stated so the builder cannot drift into it:** the 2026 agent dashboard. Dark slate at `#0F172A`, purple or blue gradient headers, glassmorphic panels, glowing pill badges, a left sidebar of stroke icons, an "Agents" nav item with a robot glyph, a global activity feed, a stat row reading "3 active agents," animated gradient borders on anything labelled AI, and a completion animation. If any element of this build could be lifted onto a different SaaS product without anyone noticing, that element is wrong.

---

## 8. Anti-patterns

- **Badges.** No pills, no chips, no rounded status capsules, no colored dots. State is a glyph in the rule plus a word.
- **A sidebar.** One person, four views. A gutter, not a nav.
- **Modals and toasts.** Neither exists. Asks are answered in place and state changes are shown in place.
- **An activity feed.** History is per-project, three event kinds, complete, never global.
- **A second hue.** Not for severity, not for failure, not for success. If a builder wants green for `clear`, the answer is no: finished things recede, they do not glow.
- **Uppercase micro-labels.** Zero. One `text-transform: uppercase` eyebrow and this becomes every AI console of 2026.
- **Monospace as a voice.** Only literals. Never labels, headings, or status words.
- **Ghosted future steps.** The rule draws what happened.
- **A shadow.** Zero `box-shadow` declarations.
- **Emoji.** Anywhere, including in the calm state.
- **Em-dashes.** Zero in any visible string. Hyphen or restructure.
- **Fake activity.** No invented agent names, no "thinking..." text, no simulated token counts, no fabricated timestamps in the empty state.
- **Apologetic failure copy.** "stopped at component-builder, 03:12. Nothing was written." Then `Retry stage` and `Close project`. No "Oops," no "Something went wrong."
- **Cards around everything.** The board is a register with rules and space. The only bounded surface in the console is the held field, and that boundary means something.

---

## 9. Open questions

Resolved in `DECISIONS.md`. Kept here for the record.

1. **Where does state come from?** File-watch on `work/`, a JSON status file the orchestrator writes after each stage, or manual entry? This determines whether `running` is real or theatre. If it cannot be real, I would cut `running` from the state set rather than fake it, and the design changes.
2. **Does the console write responses back, or do you still answer in the terminal?** If it is read-only, the entire ask surface becomes a display and the four ask shapes collapse into one. This is the single biggest fork in the direction and it needs answering before a build.
3. **Serif for documents.** Are you comfortable reading direction docs in Literata, or do you want the whole console in one sans? I think the two-voice split is the strongest idea in here, but it is the one most likely to be a matter of personal taste. Fallback if you want a serif you like better: Source Serif 4.
4. **One hue, no failure color.** `stopped` currently shares the yellow field with `held`, on the argument that both need you. Do you want a distinct color for failure, or does the glyph plus the word carry it?
5. **Name.** I have used "Handoff" throughout, because it is the system's own word for the thing this tool is about. Your call.
6. **Phone access.** Is this served on localhost only, so a phone needs a tunnel or LAN, or will it be deployed somewhere? If phone access is not actually going to happen, I would rather spend the effort on the 720px case.
7. **Notification.** Do you want a browser notification, or a title and favicon change only? A notification would change how hard the interface has to work to be unmissable, and would let me make the held field quieter.
8. **Build preview.** Embed the iframe, or link out only? Embedding is more convenient and slightly more likely to make you approve something you have not really looked at.
9. **Three families or two.** Roughly 200 to 240KB of subset woff2. If that is too much for a local tool, the first cut is Literata italic, the second is Spline Sans Mono with mono falling back to a system stack.
10. **Number of projects in flight.** The board is designed for roughly 3 to 12 rows. If you expect 40, the line needs grouping and I should revisit before a build.
