# CLAUDE.md

This file gives guidance to Claude Code (claude.ai/code) for work in this repository.

## Language: ASD-STE100

Write all text in ASD-STE100 Simplified Technical English. This rule applies to:

- your replies to the user,
- documents, code comments, and docstrings,
- commit messages and pull request text,
- UI text, error messages, and log messages.

The rules are in `AGENTS.md`, section "Text rules (ASD-STE100)". If a file that you change contains text that does
not obey these rules, correct that text.

## Agent orchestration

Opus 5.5 (the main session) plans, designs, and orchestrates the development. Sonnet 5.5 agents write the code.

1. Opus 5.5 divides the work into tasks. Each task has one owner app or one frontend feature.
2. For each task, Opus 5.5 writes a specification. The specification gives:
   - the owner app or the frontend feature,
   - the `DESIGN.md` sections to read,
   - the requirement IDs,
   - the files to change,
   - the gates to run.
3. A Sonnet 5.5 agent writes the code for the task. Start the agent with the Agent tool and `model: "sonnet"`. Code
   includes source, tests, migrations, configuration, and scripts.
4. Two agents must not change the same files. If agents run in parallel, give each agent `isolation: "worktree"`.
5. Opus 5.5 examines each result against `DESIGN.md` and the CI gates. It tells the user that the work is complete
   only after this examination.
6. If a task changes a boundary, Opus 5.5 changes `DESIGN.md` in the same change.
7. A worktree of the Agent tool starts from `main`, not from the current branch. The first step of each task
   specification moves the worktree to the current commit (`git reset --hard <commit>`). The agent then makes one
   commit. Opus 5.5 applies it with `git cherry-pick -n`, examines it, runs the gates, and commits.
8. Parallel agents use the same `db` container. Each backend agent sets its own database name in `DATABASE_URL`, so
   that the test databases do not collide.

Opus 5.5 writes the design documents (`CLAUDE.md`, `AGENTS.md`, and `DESIGN.md`), because they are design work.

## Project status

Release 1 is built. The code agrees with `DESIGN.md`.

- `backend/` has the five apps of `DESIGN.md` §3.3, with their tests and the import rules (`backend/.importlinter`).
- `frontend/` has the SPA with the six features of `DESIGN.md` §12.10, the unit tests, and the Playwright tests in
  `frontend/e2e/`.
- `Dockerfile`, `docker-compose.yml`, `.github/workflows/`, and `README.md` (the operator guide) exist.
- `AGENTS.md` gives the overview. `DESIGN.md` is the architecture reference.

If the code and `DESIGN.md` do not agree, correct one of them in the same change.

## Tools

- **Backend.** uv manages the Python packages and the environments. The project uses Python 3.14 or later. The
  PyCharm interpreter is "uv (dbml-maker)".
- The backend is not a package. Keep `backend/pyproject.toml` without a `[build-system]` table. Then `uv sync`
  installs only the dependencies. Django finds the apps through `manage.py` in `backend/`. pytest finds them through
  `pythonpath = ["."]`.
- **Frontend.** npm manages the packages. Use Node 24 LTS.
- **Services.** Docker Compose runs PostgreSQL 18 and Mailpit for local work (`DESIGN.md` §16.1).
- Commit `uv.lock` and `package-lock.json`. Git ignores `.venv`, `.idea`, `.env`, `__pycache__`, `node_modules/`,
  `frontend/dist/`, the tool caches, and `.claude/worktrees/`.

## Commands

```sh
# Services
docker compose up -d db mailpit                 # Start PostgreSQL 18 (host port 5433) and Mailpit (port 8025).
docker compose up -d --build --wait             # Start the full stack at http://localhost:8000.

# Backend: run from backend/
uv sync                                         # Make or change .venv from pyproject.toml and uv.lock.
uv add <pkg>                                    # Add a runtime dependency.
uv add --dev <pkg>                              # Add a dev dependency, for example pytest or ruff.
uv run python manage.py migrate                 # Apply the migrations.
uv run python manage.py createcachetable        # Make the cache table. The rate limits need it.
uv run python manage.py runserver               # Start Django on port 8000.
uv run python manage.py procrastinate worker    # Start the job worker.
uv run pytest                                   # Run the backend tests.

# Frontend: run from frontend/
npm ci                                          # Install the packages from package-lock.json.
npm run dev                                     # Start Vite on port 5173, with a proxy to Django.
npm run test -- --run                           # Run Vitest one time.
npx playwright test                             # Run the end-to-end tests against the full stack.
```

The full list of CI gates is in `AGENTS.md`, section "Work in the repository". Run all the gates before you say that
the work is complete.

## Architecture rules

Build the backend as a Django modular monolith with clear domain boundaries. Each domain has its own Django app
(`DESIGN.md` §3). Keep the features independent. Then you can add new apps later without a tight connection to the
current apps.

For each feature, obey these rules:

1. Give the feature one owner app.
2. Keep views and serializers thin. Put the business workflows in services.
3. Do not use the internal code of a different app. Use only its public interface (`api.py`).
4. Give each interaction between apps an explicit function in `api.py`.
5. Do not make circular dependencies between apps.
6. Write direct and clear code. Do not add an abstraction that no current feature uses.
7. Do not use Django signals for business logic or for calls between apps. If a side effect is fully independent,
   enqueue a job from the service (`DESIGN.md` §10).
8. Put infrastructure behind a replaceable boundary. This includes WebSockets, email, notifications, file storage,
   the job queue, and external APIs.
9. Make each app testable alone.

Before you start a large feature, write these three items:

1. The owner app.
2. The apps that it depends on.
3. How these apps communicate.

Design for features that will come later. Example: real-time edit (`DESIGN.md` §17.1) will be a new `collab` app. It
must connect to diagrams through `apps/diagrams/api.py`. It must not cause a change to the tables of `diagrams`, and it
must not use the internal code of `diagrams`.

Make the code easy to maintain and easy for a new developer to learn. Let many developers work on different features
at the same time. These goals are more important than maximum abstraction.

## Project overview

@AGENTS.md

## Design reference: read the section, not the file

`DESIGN.md` is the full architecture reference. It is too large to load each time. Before you work in an area, read
**only** the sections that this table gives. The section numbers are stable. Your change can affect a boundary, a
public interface, a state machine, a role, or a deploy step. If it does, change the applicable section in the same
change.

| Task | Read |
|------|------|
| Add an app. Change a public interface or an import rule. | §3 |
| Login, sign-up, sessions, CSRF, roles, permission checks | §4, §5 |
| Workspaces and members | §6 |
| Diagram save, versions, shares, public links, trash | §4.3, §7 |
| Email | §8 |
| Shared helpers in `core` | §9 |
| Background jobs | §10 |
| A new endpoint | §11, and the section of the owner app |
| A frontend page or feature | §12 |
| The code editor, the parser, the canvas, import, or export | §12.6, §12.7, §13 |
| Models and migrations | §14 |
| Tests | §15 |
| CI, Docker, deploy, or release | §16 |
| Plan a new module (real-time edit, comments, teams, tokens) | §3.8, §17 |
| Code that does not agree with the design | §18 |
| Terms and requirement IDs | §19 |
