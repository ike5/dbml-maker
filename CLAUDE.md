# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is a newly scaffolded project, and there is no source code yet. So far the repo holds only `pyproject.toml` (with no dependencies) and `.gitignore`. There is no README, no test suite, and no lint or format config. Update this file once those are added.

## Tooling

- Python packaging and environments are managed with **uv** (the PyCharm interpreter is "uv (dbml-maker)", and `.venv` was created by uv). The project needs Python **>= 3.14**.
- `pyproject.toml` has no `[build-system]` table, so uv treats this as a non-packaged project: `uv sync` installs the dependencies but not the project itself. To make the code importable as an installed package or to expose CLI entry points, first add a build backend (for example, `hatchling`) and a `[project.scripts]` table.

## Commands

```sh
uv sync                    # create or update .venv from pyproject.toml / uv.lock
uv add <pkg>               # add a runtime dependency (updates pyproject.toml and uv.lock)
uv add --dev <pkg>         # add a dev-only dependency (e.g. pytest, ruff)
uv run python <script.py>  # run inside the project venv
```

Commit `uv.lock` once it exists. `.venv`, `.idea`, `.env`, and `__pycache__` are gitignored.


Claude Project Rules


Build this Django application as a modular monolith with clear domain boundaries.

Keep features decoupled and organize code by domain so new modules can be added later without tightly coupling them to
existing ones.

For each feature:

* Give it a clear owning Django app/module.
* Keep views and serializers thin; put business workflows in services.
* Avoid cross-app access to internal implementation details.
* Expose explicit public interfaces for interactions between modules.
* Avoid circular dependencies.
* Prefer direct, understandable code over unnecessary abstractions.
* Use events/signals only for genuinely decoupled side effects, not core business logic.
* Keep infrastructure such as WebSockets, notifications, storage, and external APIs behind replaceable boundaries.
* Make modules independently testable.

Before implementing a significant feature, briefly state:

1. Which module owns it.
2. What modules it depends on.
3. How those modules communicate.

Design with future features in mind. For example, adding chat later should not require restructuring the tables/records
system, and chat should be able to integrate with records through a defined boundary rather than depending on their
internals.

Optimize for maintainability, developer onboarding, and multiple developers working on separate features—not maximum
abstraction.

## Project overview

@AGENTS.md

## Design reference: read the section, not the file

`DESIGN.md` is the full architecture reference. It is too large to load every time, so before you work in an
area, read **only** the sections listed for it below. Section numbers are stable. If your change alters a
boundary, a public interface, a state machine, a role, or a deploy step, update the matching section in the same
change.

Always in ASD-STE100 