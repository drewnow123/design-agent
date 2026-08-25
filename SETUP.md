# Setup: Frontend Design Agent with Subagents

## 1. Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

(Or use the Code tab in the Claude desktop app, if you have it installed.)

Verify it installed:
```bash
claude --version
```

## 2. Get the project files onto your machine

You've been given a folder structure:

```
my-design-agent/
├── CLAUDE.md
├── SETUP.md
└── .claude/
    └── agents/
        ├── design-strategist.md
        ├── component-builder.md
        └── design-reviewer.md
```

Download it, unzip it, and `cd` into it:
```bash
cd path/to/my-design-agent
```

If you'd rather start fresh and paste the files in yourself, just
recreate that same folder structure — the `.claude/agents/` path is
what Claude Code scans for subagent definitions.

## 3. Initialize git (optional but recommended)

```bash
git init
git add .
git commit -m "Initial design agent scaffold"
```

## 3.5. Confirm the three skills are installed

The subagents load these by name. Without them, each agent falls back
to generic training defaults and the whole point of the pipeline is
lost. Ask in any Claude Code session:

```
What skills do I have for frontend design?
```

You need `frontend-design`, `design-taste-frontend`, and
`redesign-existing-projects`. All three are installed and enabled on
this machine already (verified 2026-08-23). If you set this repo up on
another machine, install them there before running the pipeline.

## 4. Open the project as the working directory

This matters more than it sounds. `CLAUDE.md` is only loaded when the
session's working directory IS the project folder — running from
`C:\Users\handr` will discover the subagents but silently skip the
orchestrator instructions, so the handoff rules never apply.

- **Desktop app:** use the directory picker to open
  `C:\Users\handr\Documents\Agents\my-design-agent`, or just ask the session to switch to that directory.
- **Terminal:**

```bash
claude
```

Claude Code then reads `CLAUDE.md` and discovers the three subagent
files in `.claude/agents/`.

## 5. Verify the subagents are recognized

Inside the Claude Code session, ask:
```
What subagents do you have available?
```
It should list `design-strategist`, `component-builder`, and
`design-reviewer` with their descriptions.

## 6. Run your first test brief

Give it something concrete, e.g.:
```
I need a landing page for a coffee subscription service. 
Modern, warm, not corporate-feeling.
```

Expected behavior:
1. The orchestrator invokes `design-strategist` and stops, showing
   you a direction doc.
2. You approve, tweak, or reject it.
3. Only after you say "go ahead," it invokes `component-builder`.
4. It stops again and shows you the built code.
5. Only after you say "go ahead," it invokes `design-reviewer`.
6. It stops and shows you findings for you to act on.

Builds land in `work/<project-slug>/`, and the builder and reviewer
both preview them at http://localhost:8788 via the `static-preview`
config in `.claude/launch.json`.

If it ever tries to chain two stages without waiting on you, that's
a sign the "stop at every handoff" instruction in `CLAUDE.md` needs
to be made more forceful — you can bold it, repeat it in the specific
subagent file, or explicitly say "wait for my approval" in your own
prompt each time until it's reliable.

## 7. Iterate

Once the basic pipeline works, natural next steps:
- Tighten each subagent's prompt based on where it actually drifts
- Add a 4th subagent (e.g. `accessibility-checker`) if the reviewer's
  job feels too broad
- Drop real reference files (brand assets, style guides, screenshots
  of work you admire) into `references/` and name them in your brief
