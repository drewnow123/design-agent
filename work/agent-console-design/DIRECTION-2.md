# Visual direction 2: Front End Agents

Revision of `DIRECTION.md` for the shipped console at `work/agent-console/`.
Where this document and `DIRECTION.md` conflict, **this document wins**.
`DECISIONS.md` amendments A through I all still stand.

**Superseded in part by `DIRECTION-3.md`**, which replaces the visual language
(colour, type, radius, elevation, motion) on the owner's explicit instruction.
Everything structural below — the flow form, the vocabulary, the defect fixes,
the responsive behaviour — remains authoritative.

Dials: DESIGN_VARIANCE 5 · MOTION_INTENSITY 2 · VISUAL_DENSITY 6.

Mode: **redesign, preserve.** One element changes form, and it is the signature.

## 0. The three asks

> "The site can be updated to a flow style chart site. I don't like the handoff
> name. Make it 'Front End Agents'. Why does it say nothing is held? Axe that."

| Ask | What it costs |
|---|---|
| Flow chart | The vertical spine, which was the signature. Replaced, not deleted. |
| Rename | Nothing visual. Wordmark and plumbing now differ, which is normal. |
| Kill the calm block | One sentence, which the flow now carries better. |

## 1. Rename

The tool is **Front End Agents**. "Handoff" is removed from every visible
string: wordmark, `document.title`, meta description, README first line. It
stays in the repo name, `scripts/handoff.py`, `.handoff/state.json`,
`handoff.service`, and every route and file path.

**Do not rename the browser storage keys.** `handoff.theme` and the draft keys
are plumbing in the same sense as file paths. Renaming them discards the
owner's theme choice and every saved draft of typed feedback that amendment D
exists to protect. This is the most likely well-meant mistake in this build.

## 2. The flow

### 2.1 The tension

`DIRECTION.md`'s strongest rule was **the rule never draws the future**. A flow
chart draws a whole shape. The old rule conflated two different unknowns:

> **The topology is known. The path through it is not.**
>
> Three stages in the order strategist, builder, reviewer is not a prediction.
> It is written into `CLAUDE.md` and is the same for every project. Drawing it
> is drawing a fact.
>
> What is genuinely unknown is whether the reviewer sends the build back, and
> how many times. That is the only real uncertainty, and the one thing a
> progress stepper structurally cannot express.

Refined rule:

> **The board draws the track. A project draws only where it has been.**

Different elements draw each. The three columns are furniture belonging to the
board, present on an empty board. The thread belongs to the project and ends
where its record ends. No ghosted segment, no dimmed upcoming column, no
"2 of 3", no percentage anywhere.

### 2.2 The form

**Three stage columns across, one project per row, each project a horizontal
thread drawn across the columns.**

The thread is drawn from the project's history, left to right, stopping where
the record stops. Its terminus is the glyph; the status word prints immediately
after the terminus.

**A thread can be longer than the track.** A project round the review loop twice
has a physically longer line, because the return is drawn as a real doubling
back under the row and a second forward pass at a small vertical offset. A
stepper is bounded by its step count and can only say "step 2 of 3" again. This
says: this one has cost you three builds.

### 2.3 No nodes

No circles. Nothing on the track is a dot, pill, chip or badge. A stepper puts
its information in its nodes; here the information is the line's extent and the
shape of its end.

The one node-like mark is the terminus, five of them:

| State | Terminus | Word |
|---|---|---|
| `held` | thread stops, 12px vertical cross-tick | needs you |
| `running` | no terminus; a segment travels forward in the current column | running |
| `ready` | ends flush at the column boundary, unmarked | answered |
| `clear` | filled square | done |
| `stopped` | a diagonal cut through the thread | stopped |

### 2.4 Arrowheads

None, with one exception. Direction is carried by reading order. The exception
is **the return arc**, which gets one arrowhead where it lands back at the
builder column, because it runs against the reading order and against every
other line on the page.

### 2.5 Inline SVG or CSS grid

**Both: CSS grid owns layout and every word, one inline SVG per row owns that
row's line geometry.**

- Grid cannot draw a path that doubles back.
- SVG cannot lay out type. The SVG is `aria-hidden`, contains zero text, and
  every visible word is real HTML in a grid cell.
- `vector-effect: non-scaling-stroke` keeps one hairline exactly 1px at every
  width with no media queries.
- One SVG per row is the fix to the broken-spine defect.

### 2.6 What must not happen

- The three columns do not get three colours.
- No swimlane fills, no alternating column tints, no zebra rows.
- No minimap, no zoom, no pan, no draggable canvas.
- No pipeline health summary, throughput count, or stage duration averages.
- No node-graph library aesthetic, no dagre auto-layout look, no bezier
  spaghetti.

## 3. The two defects, fixed structurally

### 3.1 Spaces before punctuation

Live page renders `at 00:11 . 2 stages are running .` and `running , 24 min`.

**Rule 1. A sentence is one template, not a join.** Every sentence is authored
as a single string with named slots and rendered by one shared helper.
Punctuation lives inside the template. Concatenating rendered fragments with a
separator is banned.

| Where | Template |
|---|---|
| running | `{stage} has been running for {elapsed}.` |
| stopped | `stopped at {stage}, {time}. Nothing was written.` |
| done | `done. {n} stages, last on {date}.` |
| needs you | `waiting on you at {stage}.` |
| answered | `answered. The next stage starts from the terminal.` |
| ask changed | `this was updated at {time}. reload to see it.` |
| no projects | `Projects start in the terminal, by giving the orchestrator a brief.` |
| sample footer | `sample data. the server is not running.` |

**Rule 2. Nothing that carries a gap may contain a sentence.** A container with
`gap` inserts visual space between inline children, which is how a comma
acquires a space in front of it. Prose containers are plain blocks.

**Rule 3. Two facts need two cells, not a comma.** `running, 24 min` is two
independent facts glued with punctuation. The status word prints at the
terminus; the time prints in its own right-aligned column. **After this pass no
comma and no middle dot exists in any composed metadata string.**

Standing check: a grep of the rendered page for a space followed by a period or
comma returns nothing.

### 3.2 The broken spine

Cause is architectural. Every block is its own grid row with its own gutter cell
drawing its own rule. Non-band wrappers carry no gutter cell, so their padding
is a gap. A `held` row's rule stops at its own midpoint by design, punching a
half-row hole.

**A continuous line cannot be assembled from segments owned by independent
blocks.** Rotating the signature to horizontal means **each thread lives
entirely inside one row's own SVG**. One element owns one line, end to end. The
bug class is gone rather than patched.

Consequently **the 48px left gutter is deleted**. There is no vertical rule
anywhere. The thread starts at the right edge of the project name column.

### 3.3 The empty wide window

**Width buys history.** At 1240px and up, each thread prints the recorded time
under each completed segment, inside its own column, in tabular figures. A row
grows from a single line into a band carrying the facts the project page
carries. At 720px the per-stage times drop and only the current time survives.

## 4. Killing the calm block

Both instances go. When nothing needs the owner, **nothing occupies the top of
the page.** The page begins at the column headers.

> A board where no thread ends in a cross-tick is a board with nothing for you.

The one thing the calm sentence carried that the picture did not is "what
happened most recently", now visible as position and per-row times.

**The top-right count** renders nothing at zero, and `2 need you` otherwise.
`document.title` is `2 need you · Front End Agents`, or `Front End Agents`.

**The no-projects state stays:**

> No projects yet.
> Projects start in the terminal, by giving the orchestrator a brief.

## 5. Vocabulary

The five values in `state.json` do not change; they are the contract. Only the
words shown to a person change.

**"Held" came out of railway block signalling. So did "clear" and "the line".
The concept can keep its logic. It cannot keep its dictionary.**

| Value | Was | Now | Why |
|---|---|---|---|
| `held` | held, waiting on you | **needs you** | Second person, says whose move it is. |
| `running` | running, 4 min | **running** + time column | Ordinary English, and what his terminal says. |
| `ready` | ready to run | **answered** | "Ready to run" reads as about to happen, the opposite of true. |
| `clear` | clear | **done** | Plainest word in English for this. |
| `stopped` | stopped 03:12 | **stopped** + time column | Already plain, correctly neutral. |

| Was | Now |
|---|---|
| `Handoff` | `Front End Agents` |
| `2 held` / `nothing held` | `2 need you` / nothing |
| `1 more held` | `1 more needs you` |
| `The line` heading | deleted |
| `← the line` | `← all projects` |
| `Skip to the board` | `Skip to the projects` |
| `this ask changed at 22:41` | `this was updated at 22:41` |
| `sample data. the api is not running.` | `sample data. the server is not running.` |
| `must-fix` / `worth fixing` / `nitpick` | unchanged, his own vocabulary |

**Standing rule:** the concept's reference is a private tool for reasoning about
the design. If a word from it reaches the screen, that is a bug.

## 6. Signature element: the thread

**One horizontal hairline per project, drawn left to right across a permanent
three-column track, stopping where the record stops, doubling back where the
reviewer sent work back.**

1. **It has no nodes.** Information is extent and the shape of the end.
2. **It never draws ahead.** Track and thread are different elements.
3. **It can be longer than the track.** The length of a project's thread is the
   only honest measure on the page of what that project has cost.

And an engineering property that is also a design property: **it lives inside
one element.**

### The return arc

Drawn under the row, right to left, landing at the left edge of the column it
returns to, with the one arrowhead in the interface. The second forward pass
runs at a 4px vertical offset. Offsets stack to three passes; beyond that the
row prints the pass count instead of stacking further.

## 7. Layout

Content cap **1240px**, centred. Below that, fluid.

### The row grid

`name | design-strategist | component-builder | design-reviewer | time`

- Name column 200px at 1240, 160px at 720.
- Three stage columns equal, sharing the remainder.
- Time column 120px, right aligned, tabular. **One** fact only: elapsed for
  running, clock time for stopped, date for done, empty otherwise.
- **The usable track stops 48px short of the reviewer column's right edge**, so
  a finished thread always leaves room to print `done` after its square.

### The status word at the terminus

Prints immediately after the terminus, inline. **The word can only ever overrun
into columns the project has not used**, so it cannot collide with anything at
any width. The cost is that status words are not vertically aligned; accepted,
because the position of the word is the information.

### 720px, the primary case

Rows roughly 40px. Per-stage times drop. Column headers shorten to the last
segment of the agent name (`strategist`, `builder`, `reviewer`). Nothing hidden,
nothing scrolls sideways, the ask below still renders in full.

### 375px

- Column headers dropped.
- **The track becomes one full-width rule with two hairline ticks** at the third
  positions. Topology survives as proportion.
- Rows become two lines, roughly 64px. Name and status word on line one, the
  full-width thread on line two with the current stage name beneath.
- **The status word leaves the terminus** at this width only.
- **The return arc still draws.** On a phone he is answering asks, and "this
  build has been back twice" is context that changes the answer.

Everything from `DIRECTION.md`'s phone section survives: findings and questions
render in full and are answerable, checkboxes 24px, controls 48px tall, response
bar pinned, direction doc at 15.5px with tables scrolling, build preview links
out rather than embedding.

### The ask block

**The open ask carries its own project's thread at the top of the field**, above
the headline, with no column headers. Cut at 375px.

**The ask and the flow never sit side by side.** The ask is above, the flow
below. Two columns would narrow the reading measure, the one thing in this tool
that must not be compromised.

## 8. Motion

1. **The travelling segment.** A segment travels forward along the thread inside
   the running stage's column, looping. It now travels in the direction the work
   is travelling.
2. **The thread extending.** When a decision lands, the thread grows to the
   right past the answered stage, the cross-tick lifts, the field drains.
   Releasing the pipeline now looks like the pipeline advancing.
3. **The return arc drawing.** When a build is sent back, the arc draws right to
   left as part of the same moment. This earns its place because "send back with
   notes" is the decision whose consequence is otherwise invisible.
4. **Control press.**

Only the row he just acted on ever animates. Elapsed times update every 15
seconds.

**Banned by name:** drawing the track in on load, drawing threads in on load,
any `stroke-dasharray` reveal, hover effects on threads, a pulsing terminus, and
any transition on the flow when a poll returns unchanged data.

## 9. What deliberately does not change

- All four ask shapes, and the entire direction-document treatment: measure,
  tables breaking right, hex swatches, the h2 rail, the pinned response foot.
- No modals, no toasts. State changes show in place.
- No activity feed. History is per project, three event kinds.
- Status never carried by colour alone: word, terminus glyph, and position.
- No sidebar, no search, no settings gear, no avatar.
- Real buttons, real checkboxes, landmarks, a real fieldset for findings,
  visible focus in both themes, no div with a click handler.
- Every `DECISIONS.md` amendment.
- Zero em-dashes in any visible string.

## 10. Decide before the build

1. **Can a thread be drawn from the current contract?** `history` entries carry
   free-form lowercase `text`. Parsing it against the three agent names plus
   "started" and "finished" is brittle. **Recommendation:** add optional `stage`
   and `event` fields in `handoff.py`, purely additive, parser kept as fallback.
2. **Is the column set hard-coded to three?** Recommendation: yes, with a
   fallback that appends a fourth column rather than dropping an unknown stage.
3. **How many stacked passes before the row stops growing?** Three, then print
   the pass count.
4. **Content cap 1240px**, against a 1541px window.
5. **The mini thread inside the open ask.** Worth 22px?
6. **Storage keys stay as they are.**
7. **Does `answered` read right?** Fallback: `waiting on the terminal`.

## 11. Reference points

**The signal box line diagram** — the illuminated track diagram on the wall
above the register. It draws the permanent way, always, in full, including track
no train is on. Trains are marks that appear on it. It predicts nothing, because
a diagram of track is not a prediction. Take the logic, leave the decor and the
vocabulary.

**Marey's train graph** — one line per train across a fixed set of stations,
where the entire content is the extent, the slope and the doubling back of the
lines. No nodes, no labels on the lines, no legend, hairline weight throughout.
Take the drawing quality and the no-nodes discipline.

**Anti-references:** the four circles and arrows progress stepper in every form.
The default Mermaid flowchart. The CI pipeline view with green, red and grey
stage pills. The BPMN swimlane. The node-graph canvas with pan, zoom and a
minimap.
