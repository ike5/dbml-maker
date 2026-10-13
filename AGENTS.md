# AGENTS.md — PERCH

High-level orientation for anyone, human or agent, working in this repository. It covers what the system is,
how it is shaped, and the decisions you must not break by accident. Details live in
[`DESIGN.md`](DESIGN.md), which is large and split into numbered sections. **Read only the sections your task
needs.** The pointers below (→ §N) name them.

## What DBML Maker is

It is an open source replacement of https://dbdiagram.io

## Stack at a glance

| Layer    | Technology                                       |
|----------|--------------------------------------------------|
| Backend  | Django 5.2 + DRF, Python 3.14, `uv` (`backend/`) |
| Frontend | React 19 + Vite 8 SPA (`frontend/`)              |
| Data     | Postgres 18;                                     |

The SPA and the API are served **same-origin**, so auth is a Django session cookie plus CSRF. There is no CORS
and no token in the browser.

## Architecture in one page

**Modular monolith.** There is one Django app per domain

Inside an app:

**The domains that matter most:**

**Frontend**

## Key design decisions

1. **Explicit cross-app calls, no signals.**

5. **Infrastructure sits behind replaceable boundaries:**

6. **Background jobs fail loudly and must be idempotent.**

8. **Some vocabulary is deliberate.** Each of these is decided, not an oversight:

## Working in the repo

**The gates CI runs.** Run these before you call work done:

```bash

```

Gotchas with these commands:

**Conventions:**

- Comments explain *why*.
- Cite requirement IDs in comments and tests.
- Spec-tracing tests are named `test_spec_*.py` (backend) or `*.spec.test.jsx` (frontend).
- Text-hygiene rules

**Before a significant feature**, state:

1. the owning module
2. what it depends on
3. how they communicate

**Branches and deploys:**

- Branch flow: `feat/*` / `fix/*` / `chore/*` → `staging` → `main`.
- Commit or push only when asked.

## Where else to look

| Need | Go to |
|------|-------|

