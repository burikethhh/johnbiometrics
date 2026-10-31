# GreenValley — AI instructions

Read `B:\Projects\AGENTS.md` first for workspace-wide rules, tooling and the vibe-coding workflow.

## Project

- Path: `B:\Projects\GreenValley`
- Type: Git repo + Node
- Workspace member: no (standalone)
- Git repo: yes

## Run it

# GreenValley

Detected type: **Git repo + Node**

```powershell
cd B:\Projects\GreenValley
npm run install:all
npm run dev
```

Or from the workspace root:

```powershell
cd B:\Projects
npm run dev -- GreenValley
npm run build -- GreenValley
```

## Scripts

- `start`
- `dev`
- `db:init`
- `build`
- `test`
- `eject`

## Packages

- `GreenValley/backend` (fingergate-backend) - needs npm install
- `GreenValley/frontend` (fingergate-frontend)

## AI Memory (mandatory contribution)

This project is part of `B:\Projects`. The central brain is `B:\Projects\.ai-hub`.

- READ FIRST: `.ai-hub/README.md` and your card `.ai-hub/projects/GreenValley.md`.
- You MUST contribute to the central memory: update your card (bump `Last updated`, append a dated line under `## Memory / Changelog`), and add lessons/artifacts/learnings when you find gotchas, make decisions, or learn something reusable.
- Run `npm run memory:sync` after contributing (creates missing cards, refreshes INDEX.md/memory.json).
- NEVER store secrets in the hub (env *names* only).

## Conventions

- Prefer editing existing files over creating new ones; match the style already in the repo.
- Never commit `.env`, secrets, API keys or `node_modules`.
- After changing code run the project's `lint` / `build` / `test` before declaring done.
- Report the exact commands you ran and their output.
