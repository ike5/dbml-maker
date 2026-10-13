# AGENTS.md: DBML Maker

This file gives the high-level orientation for each person or agent that works in this repository. It tells what the
system is, how its parts connect, and which decisions you must not break by accident. The details are in
[`DESIGN.md`](DESIGN.md). That file is large, and it has numbered sections. **Read only the sections for your task.**
The pointers below (→ §N) give the applicable sections.

## What DBML Maker is

DBML Maker is an open source replacement for [dbdiagram.io](https://dbdiagram.io). A user writes DBML in a text editor
and sees the database diagram next to it. The user can save diagrams, share them, restore old versions, and import and
export them. (→ §1)

**Status:** release 1 is built. The code agrees with `DESIGN.md`.

## Technology stack

| Layer | Technology |
|-------|------------|
| Backend | Django 5.2 + DRF, Python 3.14, uv (`backend/`) |
| Auth | django-allauth in headless mode, with the browser client |
| Jobs | Procrastinate, on PostgreSQL |
| Frontend | React 19 + Vite 8 SPA, JavaScript with JSX (`frontend/`) |
| Editor and canvas | CodeMirror 6, React Flow, elkjs |
| DBML | `@dbml/core`, in the browser only |
| Data | PostgreSQL 18. It is the only data store. |

Django serves the SPA and the API from the **same origin**. For this reason, auth uses a Django session cookie and
CSRF. There is no CORS, and there is no token in the browser. (→ §4)

## Architecture in one page

**Modular monolith.** There is one Django app for each domain, in `backend/apps/`. The apps are in layers. An app can
call only the apps below it. (→ §3)

```
diagrams     Diagrams, versions, shares, public links, trash      → §7
workspaces   Workspaces and members                               → §6
accounts     Users, login, email verification, password reset     → §5
comms        Outbound email                                       → §8
core         Shared kernel: base model, errors, jobs, health      → §9
```

**Inside an app:** `api.py` is the public interface. Other apps import only `api.py`. `services.py` contains the
business workflows, and `selectors.py` contains the read queries. Views and serializers stay thin. (→ §3.2)

**The most important domains:**

- `diagrams` is the product. It contains the access policy for diagrams. (→ §4.3, §7)
- `accounts` contains the security flows. django-allauth does the work, and `accounts` configures it. (→ §5)

**Frontend:** the SPA has one folder for each feature in `frontend/src/features/`. The browser parses DBML, draws the
diagram, and does all import and export. Only `src/lib/dbml/` imports `@dbml/core`. Only `src/lib/api/` calls the
backend. (→ §12, §13)

## Main design decisions

1. **Explicit cross-app calls, no signals.** An app calls a different app through a function in its `api.py`. Do not
   use Django signals for business logic. If a side effect must not block the request, enqueue a job. (→ §3.1)
2. **The browser is the only DBML parser.** The backend keeps the source as text and never parses it, because two
   parsers can disagree. (→ §13.1)
3. **PostgreSQL is the only data store.** Sessions, the cache, and the job queue use PostgreSQL. There is no Redis.
   (→ §14)
4. **Saves use a change number.** Each save sends `If-Match` with the change number that the client read. An old
   number gets HTTP 412. The system never overwrites a change without a message to the user. (→ §7.3)
5. **Infrastructure is behind replaceable boundaries:** (→ §3.6)
   - email delivery: `apps/comms/api.py`
   - the job queue: `apps/core/jobs.py`
   - the auth flows: `apps/accounts/`
   - the DBML parser: `frontend/src/lib/dbml/`
   - the canvas and the code editor: `frontend/src/features/editor/canvas/` and `.../code/`
6. **Background jobs fail loudly and must be idempotent.** A job can run two times with the same result. A job does
   not catch an error and then continue. (→ §10.2)
7. **No access gives 404.** If a user has no access to a diagram, the API returns 404, not 403. The API must not tell
   that user that the diagram exists. (→ §4.4)
8. **The vocabulary is a decision.** Use these terms, and do not replace them: (→ §19.1)
   - "diagram", not "project". `Project` is a DBML keyword.
   - "version" only for a saved copy of a diagram. For software, write "release".
   - "parse result", not "model". "Model" is a Django model.
   - "change number", "share", "public link", "layout", "source", and "trash".
9. **All text uses ASD-STE100.** See "Text rules (ASD-STE100)" below.

## Work in the repository

**The gates that CI runs.** Run these gates before you say that the work is complete:

```bash
# Backend: run from backend/. Start the database first: docker compose up -d db
uv run ruff format --check .
uv run ruff check .
uv run mypy .
uv run lint-imports
uv run python manage.py makemigrations --check --dry-run
uv run pytest

# Frontend: run from frontend/
npm ci
npm run lint
npm run format:check
npm run test -- --run
npm run build

# End-to-end: run from frontend/ after you start the full stack (docker compose up -d)
npx playwright test
```

Notes on these commands:

- The backend tests use PostgreSQL, not SQLite. Start the `db` service before you run `pytest`.
- `npm run test` starts Vitest in watch mode. Add `-- --run` for one run.
- Playwright must have its browsers. Run `npx playwright install` one time.
- `makemigrations --check` fails when a model change has no migration. Make the migration. Do not skip the check.
- Run the `uv` commands from `backend/`. The repository root has no `pyproject.toml`.

**Conventions:**

- Comments tell why the code is as it is. They do not repeat what the code does.
- Cite requirement IDs (for example `DGM-002`) in comments and tests. The list is in §19.2.
- Name the spec tests `test_spec_*.py` (backend) or `*.spec.test.jsx` (frontend). Each test name starts with its
  requirement ID. (→ §15.4)
- All text obeys the text rules in the next section.

## Text rules (ASD-STE100)

All text in this repository uses ASD-STE100 Simplified Technical English. This includes documents, code comments,
docstrings, commit messages, pull request text, UI text, error messages, and log messages.

Obey these rules:

1. **Words.** Use the words of the ASD-STE100 dictionary, with their approved meaning. You can also use technical
   names (for example `Django`, `endpoint`, `migration`) and technical verbs (for example `parse`, `deploy`,
   `commit`).
2. **One word, one meaning.** Use the same term for the same thing each time. Use the glossary terms (→ §19.1).
3. **Noun clusters.** Do not put more than three nouns in a row. Write "the token of the public link", not "public
   link token value".
4. **Verbs.** Use only the simple tenses: present, past, and future. Use the imperative for instructions. Do not use
   the "-ing" form of a verb, except in a technical name.
5. **Active voice.** Use the active voice. Use the passive voice only in descriptions, and only when it is not
   important who does the action.
6. **Sentence length.** An instruction has 20 words or fewer. A description has 25 words or fewer.
7. **One instruction in each sentence.** The exception: two actions that you do at the same time.
8. **Condition first.** Put the condition before the instruction. Example: "If the test fails, examine the log."
9. **Paragraphs.** Each paragraph has one topic and 6 sentences or fewer. The first sentence gives the topic.
10. **Articles.** Use "a", "an", and "the" where possible. Do not remove them to make the text short.
11. **Lists.** Use a vertical list for steps, and for three or more items.
12. **Warnings.** Start with a clear command, then give the risk. Example: "Do not edit an applied migration. Other
    databases will not get the change."

Replace these words:

| Do not write | Write |
|--------------|-------|
| ensure | make sure |
| require, need | must, is necessary |
| should, shall | must (for a rule), can (for an option) |
| may, might | can, it is possible that |
| allow | let, can |
| provide | give |
| utilize | use |
| perform | do |
| verify (except for email verification), check (as a verb) | make sure, examine |
| create | make |
| modify | change |
| display | show |
| via | through, with |
| in order to | to |
| prior to | before |
| however | but |
| e.g., i.e., etc. | for example, that is, and the full list |

Text hygiene:

- Use US English spelling.
- Do not use contractions. Write "do not", not "don't".
- Wrap Markdown text at 120 characters.
- Do not leave whitespace at the end of a line. End each file with one newline.
- Do not use emoji in code, documents, or UI text.

**Before a large feature**, write these three items:

1. the owner app
2. the apps that it depends on
3. how these apps communicate

**Branches and deploys:**

- Branch flow: `feat/*`, `fix/*`, or `chore/*`, then `staging`, then `main`.
- Commit or push only when a person tells you to.
- The deploy steps are in §16.5.

## Other references

| Necessary data | Go to |
|----------------|-------|
| The `DESIGN.md` section for a task | `CLAUDE.md`, section "Design reference" |
| Architecture details | [`DESIGN.md`](DESIGN.md) |
| Setup for a developer, and how to send a change | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| How to run the application on a server | [`README.md`](README.md) |
| Terms and requirement IDs | `DESIGN.md` §19 |
| The DBML language | https://dbml.dbdiagram.io/docs |
| The source of `@dbml/core` | https://github.com/holistics/dbml |
| ASD-STE100 | https://www.asd-ste100.org |
| django-allauth | https://docs.allauth.org |
| Procrastinate | https://procrastinate.readthedocs.io |
| React Flow | https://reactflow.dev |
| CodeMirror 6 | https://codemirror.net |
