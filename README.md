# Design agent

A frontend design pipeline run by Claude Code subagents, and **Handoff**, the
console for watching it and answering what it asks you.

The pipeline is three agents in sequence, with a human decision between each:

1. `design-strategist` proposes a visual direction. No code.
2. `component-builder` builds an approved direction into real HTML, CSS and JS.
3. `design-reviewer` audits the result for generic patterns, accessibility and
   consistency with the direction.

It never chains two agents back to back, which means it spends most of its life
parked, waiting on a person. That property is what the console is built around.

## Handoff

```bash
python scripts/console.py
```

Then open http://localhost:8790, or the LAN address it prints, which is the one
to use from a phone.

The console reads `.handoff/state.json` and writes real answers back. Approving
a direction, sending a build back with notes, triaging reviewer findings and
answering a question all happen in the page and all move the pipeline. It is not
a status display.

There is no build step, no npm and no dependency beyond the Python standard
library. Fonts are self hosted.

## Running a project, end to end

Start Claude Code in this directory, as the account that owns it, and give it a
design brief. That is the whole trigger; there is no other entry point.

What happens next, and where you come into it:

1. The orchestrator records the stage and spawns `design-strategist`. The board
   shows the project **running**.
2. The strategist returns a direction document. The orchestrator parks the
   project and the board shows **needs you**, with the document rendered in
   full on the page, tables and colour swatches and all.
3. You read it and press Approve, or Request changes and write why. Your answer
   is written to `.handoff/responses/` and the project becomes **answered**.
4. The orchestrator drains that answer, runs `component-builder`, and parks
   again with a preview of what was built.
5. Same for `design-reviewer`, whose findings you triage by checkbox, choosing
   which ones go back to the builder.
6. When you sign off, the project is **done**.

You can answer from a phone. Questions and finding triage are built for it, and
a build review deliberately links out rather than showing you a desktop layout
squeezed into a phone-sized frame.

### The one thing to understand

**The console records your decision. It does not wake the agent up.**

Nothing watches the responses inbox. If you approve a direction at ten at night
and Claude Code is not running, nothing happens until you are back at the
terminal and it drains the answer. That is exactly what **answered** means, and
it is why the word is not "ready to run", which would be a lie.

This is a pull system. It fits the way the pipeline already works, since the
pipeline was always going to stop and wait for you anyway.

## Recording what the pipeline does

`CLAUDE.md` tells the orchestrator to call `scripts/handoff.py` at every stage
transition. That is the only thing keeping the board honest: a stage that is not
recorded did not happen, as far as the board knows.

```bash
python scripts/handoff.py start  <slug> <stage>
python scripts/handoff.py hold   <slug> --kind direction --headline "..." --doc FILE
python scripts/handoff.py drain  --archive
python scripts/handoff.py show
python scripts/handoff.py forget <slug>
```

`hold --kind` takes `direction`, `build`, `findings` or `question`, which are
the four shapes of decision this pipeline asks for. `drain` reads what you
answered and `--archive` files it once acted on.

`forget` removes a project from the board and is the only command that
un-records something, so it asks you to type the slug before it acts, and
discards any unread answers along with it. Use it for the throwaway projects
every board collects. `clear` is the one you want for real work: it marks a
project done and keeps its record.

### Starting from a clean board

`.handoff/state.json` is the whole board. To empty it, forget the projects on
it, or delete the file and let the next `start` recreate it. Deleting it throws
away the record of everything that ever ran, which is usually not what you want.

## Layout

| Path | What |
|---|---|
| `CLAUDE.md` | Orchestrator instructions. The pipeline's rules live here. |
| `SETUP.md` | Installing Claude Code and the subagents. |
| `scripts/console.py` | The console server. Serves the page, `/api/state`, `/api/respond`. |
| `scripts/handoff.py` | The CLI the orchestrator records activity with. |
| `scripts/handoff_state.py` | Shared state read, write and cross process lock. |
| `work/<slug>/` | Builds, one directory per brief. |
| `work/agent-console/` | Handoff itself. It was built by this pipeline. |
| `work/agent-console-design/` | Its direction document and the amendments to it. |
| `references/` | Brand assets and style guides to calibrate subagents against. |
| `deploy/` | Running the console as a service, including on Proxmox. |

`.handoff/` is runtime state and is not tracked. Each machine keeps its own.

## Running it on a server

See `deploy/PROXMOX.md` for a full walk through, and `deploy/README.md` for the
general case. The short version: the page and the API are one process that reads
the repository working tree, so the repository has to live on the box you serve
from. There is no authentication, so keep it on a trusted network.
