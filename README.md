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

## Recording what the pipeline does

The orchestrator calls `scripts/handoff.py` at every stage transition, which is
what keeps the board honest:

```bash
python scripts/handoff.py start  <slug> <stage>
python scripts/handoff.py hold   <slug> --kind direction --headline "..." --doc FILE
python scripts/handoff.py drain  --archive
python scripts/handoff.py show
```

`CLAUDE.md` carries the full instructions the orchestrator follows.

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
