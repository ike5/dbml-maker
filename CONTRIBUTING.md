# Contribute to DBML Maker

This guide tells you how to set up the project on your computer, how to change the code, and how to send your change.
If you only want to run the application, read the [README](README.md).

## Before you start

You must have these tools:

- Docker with Compose. It runs PostgreSQL 18 and Mailpit.
- [uv](https://docs.astral.sh/uv/). It installs Python 3.14 and the backend packages.
- Node 24 LTS with npm. They build and test the frontend.
- git.

## Set up

Do these steps one time.

1. Get the code. Then start the services. Run these commands in the directory where you want the code:

   ```sh
   git clone https://github.com/ike5/dbml-maker.git
   cd dbml-maker
   docker compose up -d db mailpit
   ```

   PostgreSQL listens on the host port 5433, not 5432. Mailpit listens on the host ports 1025 (SMTP) and 8025 (web).

2. Set up the backend:

   ```sh
   cd backend
   uv sync
   uv run python manage.py migrate
   uv run python manage.py createcachetable
   ```

3. Set up the frontend:

   ```sh
   cd ../frontend
   npm ci
   ```

If the host port 5433 is busy, use another port. For example, run `DB_PORT=5434 docker compose up -d db mailpit`. Then
set `DATABASE_URL=postgres://dbml:dbml@localhost:5434/dbml` in the shell before you run the backend commands.

## Start the application

Open three terminals.

| Terminal | Directory | Command | Function |
|----------|-----------|---------|----------|
| 1 | `backend/` | `uv run python manage.py runserver` | The Django API on port 8000. |
| 2 | `backend/` | `uv run python manage.py procrastinate worker` | The job worker. It sends the email. |
| 3 | `frontend/` | `npm run dev` | Vite on port 5173. It sends API calls to Django. |

Open http://localhost:5173. Vite sends `/api`, `/_allauth`, `/admin`, and `/static` to Django. For this reason, the
browser sees one origin, as in production.

A new user must verify the email address. Mailpit catches each email. Open http://localhost:8025 to read it.

## Learn the structure of the code

The backend has one Django app for each domain, in `backend/apps/`. The apps are in layers. An app calls only the apps
below it in this table:

| App | Function |
|-----|----------|
| `diagrams` | Diagrams, versions, shares, public links, and trash. |
| `workspaces` | Workspaces and members. |
| `accounts` | Users, login, email verification, and password reset. |
| `comms` | Outbound email. |
| `core` | The shared kernel: base model, errors, jobs, and health. |

Obey these rules:

- Another app imports only the file `api.py` of an app. It does not import `models.py` or `services.py`.
- A view or a serializer stays thin. The business workflow goes in `services.py`. The read queries go in
  `selectors.py`.
- Do not use Django signals to call a different app. Call a function in its `api.py`.

`lint-imports` examines these rules. The details are in [`DESIGN.md`](DESIGN.md), section 3.

The frontend has one folder for each feature in `frontend/src/features/`: `auth`, `diagrams`, `editor`,
`import-export`, `shares`, and `versions`. Only `src/lib/dbml/` imports `@dbml/core`. Only `src/lib/api/` calls the
backend. The details are in `DESIGN.md`, section 12.

`DESIGN.md` is large. Read only the sections for your task. [`AGENTS.md`](AGENTS.md) gives the overview.

## Run the gates

CI runs these gates on each push and each pull request. Run them on your computer before you open a pull request.

Backend. Run these commands from `backend/`. The `db` service must run.

```sh
uv run ruff format --check .
uv run ruff check .
uv run mypy .
uv run lint-imports
uv run python manage.py makemigrations --check --dry-run
uv run pytest
```

Frontend. Run these commands from `frontend/`.

```sh
npm ci
npm run lint
npm run format:check
npm run test -- --run
npm run build
```

End-to-end. Run these commands from the root of the repository, then from `frontend/`.

```sh
docker compose up -d --build --wait
cd frontend
npx playwright install     # one time
npx playwright test
```

Notes on the gates:

- To fix the format, run `uv run ruff format .` in `backend/` and `npm run format` in `frontend/`.
- If you change a model, the command `makemigrations --check` fails until you make the migration. Run
  `uv run python manage.py makemigrations`. Do not edit a migration that other databases already applied. Those
  databases will not get the change.
- `npm run test` starts Vitest in watch mode. Add `-- --run` for one run.

## Send your change

1. Make a branch with the name `feat/<name>`, `fix/<name>`, or `chore/<name>`.
2. Change the code. Add tests for the change.
3. Run the gates.
4. Push the branch. Open a pull request to the branch `staging`. If the repository has no `staging` branch, open the
   pull request to `main`.

Spec tests show that the code obeys one requirement. The file name of a spec test is `test_spec_<area>.py` (backend) or
`<name>.spec.test.jsx` (frontend). The name of each test starts with the requirement ID, for example `DGM-002`. The
list of IDs is in `DESIGN.md`, section 19.2. The rules for tests are in section 15.

If you add a large feature, write these three items in the pull request first:

- the owner app,
- the apps that it depends on,
- how these apps communicate.

## Text rules (ASD-STE100)

All text in this repository uses ASD-STE100 Simplified Technical English. This rule applies to:

- documents,
- code comments and docstrings,
- commit messages and pull request text,
- user interface text,
- error messages and log messages.

A reviewer asks for a change if your text breaks a rule.

These five rules are the most important:

1. Use short sentences. An instruction has 20 words or fewer. A description has 25 words or fewer.
2. Use one word for one meaning. Use the terms of `DESIGN.md`, section 19.1. Write "diagram", not "project".
3. Use the active voice and the simple tenses. Do not use the "-ing" form of a verb, except in a technical name.
4. Put the condition before the instruction. Example: "If the test fails, examine the log."
5. Do not use contractions. Write "do not", not "don't".

The full rules and the table of words to replace are in [`AGENTS.md`](AGENTS.md), section "Text rules (ASD-STE100)".

## AI agents

[`CLAUDE.md`](CLAUDE.md) has the instructions for Claude Code. [`AGENTS.md`](AGENTS.md) gives the overview for each
agent and each person.
