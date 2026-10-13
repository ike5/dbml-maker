# DBML Maker: Design Reference

**Status:** target design. No code exists yet. When you write the code, make it agree with this document. If the code
must be different, change this document in the same commit.

This is the full architecture reference for DBML Maker. It is long because it must be complete. **Do not read it from
start to end.** Start with [`AGENTS.md`](AGENTS.md), which gives the overview. Then go to the section for your task.
`CLAUDE.md` has a table that gives the applicable section for each type of task.

Section numbers are stable. Refer to a section as `DESIGN.md §7.3`. All paths are relative to the root of the
repository. `path::symbol` identifies a function or a class in a file. Do not use line numbers, because they change.

**Keep this document correct.** Your change can affect a boundary, a public interface, a state machine, a role, or a
deploy step. If it does, change the applicable section in the same commit. A design document with incorrect data is
worse than no document.

**Language.** All text in this document uses ASD-STE100 Simplified Technical English. The text rules are in
`AGENTS.md`.

## Contents

1. [System context](#1-system-context)
2. [Repository structure](#2-repository-structure)
3. [Backend: the modular monolith](#3-backend-the-modular-monolith)
4. [Access control and security](#4-access-control-and-security)
5. [accounts: users and sessions](#5-accounts-users-and-sessions)
6. [workspaces: workspaces and members](#6-workspaces-workspaces-and-members)
7. [diagrams: diagrams, versions, shares, and public links](#7-diagrams-diagrams-versions-shares-and-public-links)
8. [comms: outbound email](#8-comms-outbound-email)
9. [core: the shared kernel](#9-core-the-shared-kernel)
10. [Background jobs](#10-background-jobs)
11. [API conventions](#11-api-conventions)
12. [Frontend](#12-frontend)
13. [DBML in the browser](#13-dbml-in-the-browser)
14. [Data, schema, and migrations](#14-data-schema-and-migrations)
15. [Tests](#15-tests)
16. [Build, deploy, and release](#16-build-deploy-and-release)
17. [Future modules](#17-future-modules)
18. [Known gaps, deviations, and sharp edges](#18-known-gaps-deviations-and-sharp-edges)
19. [Glossary and requirement IDs](#19-glossary-and-requirement-ids)

---

## 1. System context

DBML Maker is an open source replacement for [dbdiagram.io](https://dbdiagram.io). A user writes DBML in a text
editor. Next to the text, the application shows the database diagram. It changes the diagram while the user types.
The user can save diagrams, share them, restore old versions, and import and export them.

### 1.1 External systems

| System | Function | Boundary in code |
|--------|----------|------------------|
| Web browser | Runs the SPA. Parses DBML, draws the diagram, and does all import and export. | `frontend/src/lib/dbml/`, `frontend/src/features/editor/canvas/` |
| PostgreSQL 18 | Keeps all persistent data: application data, sessions, cache, and the job queue. | Django ORM, `backend/config/settings/` |
| SMTP server | Sends email: verification, password reset, and share notices. | `backend/apps/comms/` (§8) |
| Reverse proxy of the operator | Terminates TLS. Sends the requests to the `web` process. | Outside the repository. Django trusts `X-Forwarded-Proto` (§4.6). |
| GitHub Actions, GHCR | Run CI. Keep the release images. | `.github/workflows/` (§16) |

### 1.2 Processes

The system has three processes:

- `web`: Django under gunicorn (WSGI). It serves the API, the SPA files, and the Django admin.
- `worker`: a Procrastinate worker. It runs background jobs and periodic jobs (§10).
- `db`: PostgreSQL 18.

`web` and `worker` use the same Docker image with a different command. Because `web` keeps no state in memory between
requests, you can run more than one `web` process.

```
                    HTTPS, same origin
  Browser (SPA) ------------------------> reverse proxy ---> web: gunicorn + Django
                                                               |
                                                               v
              worker: Procrastinate ----------------------> PostgreSQL 18
                       |                                   (data, sessions, cache, jobs)
                       v
                  SMTP server
```

The browser does all the DBML work. The backend never parses DBML (§13.1).

---

## 2. Repository structure

```
backend/                     Django project (§3)
  pyproject.toml, uv.lock    Python dependencies (uv)
  manage.py
  .importlinter              Import rules between apps (§3.4)
  config/                    Settings, root URLs, WSGI and ASGI entry points, SPA view
    settings/                base.py, dev.py, test.py, prod.py
  apps/                      One Django app for each domain (§3.3)
    core/
    comms/
    accounts/
    workspaces/
    diagrams/
frontend/                    React 19 + Vite 8 SPA (§12)
  package.json, package-lock.json
  vite.config.js, eslint.config.js, playwright.config.js
  src/                       app/, features/, lib/, ui/, text/, styles/
  e2e/                       Playwright tests (§15.3)
.github/workflows/           ci.yml, release.yml (§16.6)
Dockerfile                   Two-stage build: frontend files, then the Python image (§16.2)
docker-compose.yml           db, web, worker, and mailpit for local work (§16.1)
README.md                    Operator guide: install, configure, upgrade
AGENTS.md                    Overview for persons and agents
CLAUDE.md                    Rules for Claude Code
DESIGN.md                    This document
```

The root `pyproject.toml` is a placeholder. The first backend change moves it to `backend/pyproject.toml`.

---

## 3. Backend: the modular monolith

### 3.1 Rules

1. **One app for each domain.** Each Django app has its own models, tables, and business rules. No other app writes
   to these tables.
2. **Public interface only.** An app can import only the `api` module of a different app. `api.py` gives functions
   and frozen dataclasses. It does not give model instances or querysets.
3. **One direction.** Dependencies go down the layers in §3.4. A circular dependency is a defect.
4. **Thin views.** Views and serializers validate the input and format the output. Services contain the business
   workflows. Selectors contain the read queries.
5. **Explicit calls, no signals.** An app calls a different app through a function in `api.py`. Apps do not use
   Django signals for business logic. If a side effect must not block the request, the service enqueues a job (§10).
6. **Replaceable infrastructure.** Each infrastructure part is behind one module (§3.6).
7. **Testable alone.** You can test each app with its own tests. Where necessary, replace the `api.py` functions of
   other apps with test doubles.
8. **Direct code.** Do not add an abstraction that no current feature uses.

### 3.2 Parts of an app

```
apps/<app>/
  api.py            Public interface. The only module that other apps can import.
  models.py         Private. Django models.
  services.py       Private. Business workflows (write operations). One transaction for each function.
  selectors.py      Private. Read queries.
  policy.py         Private. Permission decisions, if the app has them.
  serializers.py    Private. DRF input validation and output format.
  views.py          Private. Thin DRF views.
  urls.py           URL routes of the app. config/urls.py includes them.
  tasks.py          Background jobs (§10).
  errors.py         Domain errors. Each one is a subclass of core.errors.DomainError.
  testing.py        Test helpers that the tests of other apps can use (§15.1).
  admin.py          Django admin registration.
  migrations/
  templates/<app>/  Email templates and other templates.
  tests/            test_*.py, test_spec_*.py, factories.py
```

If a file becomes too large, change it into a package (for example, `services/__init__.py` and
`services/versions.py`). Keep the public names the same.

Rules for each part:

- A view does not query models. It calls a selector or a service.
- A service gets IDs and plain values. It never gets a `request` object.
- A service opens the transaction (`transaction.atomic`). A view never opens a transaction.
- A service enqueues jobs in `transaction.on_commit`, so that each job sees only committed data.
- `api.py` functions call the services and selectors of the same app. They return frozen dataclasses that `api.py`
  defines.
- `api.py` re-exports the errors that its functions raise. Other apps catch these errors through `api.py`.

### 3.3 List of apps

| App | Contents | Depends on | Public interface (`api.py`) | Section |
|-----|----------|------------|-----------------------------|---------|
| `core` | Shared kernel: base model, errors, job app, pagination, health views | Nothing | All `core` modules are public. | §9 |
| `comms` | Outbound email, and a record of each email | `core` | `send_email` | §8 |
| `accounts` | Users, login, sessions, email verification, password reset, account delete | `core`, `comms` | `UserRef`, `get_user`, `get_users` | §5 |
| `workspaces` | Workspaces and members | `core`, `accounts` | `WorkspaceRef`, `WorkspaceRole`, `get_or_create_personal_workspace`, `get_role`, `list_roles_for_user` | §6 |
| `diagrams` | Diagrams, versions, shares, public links, the trash, and the access policy for diagrams | `core`, `comms`, `accounts`, `workspaces` | `DiagramRef`, `DiagramRole`, `get_access`, `get_diagram` | §7 |

### 3.4 Layers and import rules

An app can call only the apps below it:

```
diagrams
workspaces
accounts
comms
core
```

`config/` is above all apps. It can import `apps.<app>.urls`.

`backend/.importlinter` has these contracts. `lint-imports` runs them in CI.

1. A `layers` contract with the order above.
2. A `forbidden` contract for each app. Other apps must not import its private modules: `models`, `services`,
   `selectors`, `policy`, `serializers`, `views`, `tasks`, and `errors`.
3. A `forbidden` contract for `apps.core`. It must not import any other app.

A ForeignKey to a model in a lower app is permitted. Use the string form (`settings.AUTH_USER_MODEL`,
`"workspaces.Workspace"`), so that the import rules stay true. But a query must not go across the relation into the
tables of a different app. Call the `api.py` of that app.

Example: to list the diagrams of a user, `diagrams` calls `workspaces.api.list_roles_for_user(user_id)`. Then it
filters `Diagram.workspace_id` with the IDs that it gets. It does not join `workspaces_member`.

### 3.5 Data across a boundary

- Pass IDs (UUID) and frozen dataclasses. Do not pass model instances or querysets.
- If an `api.py` function returns data for many objects, it takes a list of IDs. This prevents N+1 calls. Example:
  `accounts.api.get_users(user_ids)`.
- An `api.py` function raises only the errors that `api.py` re-exports.

### 3.6 Infrastructure boundaries

| Infrastructure | Boundary | To replace it, change |
|----------------|----------|-----------------------|
| Email delivery (SMTP) | `apps/comms/api.py::send_email` | `EMAIL_BACKEND`, or `apps/comms/tasks.py` |
| Job queue (Procrastinate) | `apps/core/jobs.py` | `apps/core/jobs.py` and the job decorators in each `tasks.py` |
| Auth flows (django-allauth) | `apps/accounts/adapter.py`, `apps/accounts/api.py` | `apps/accounts/` only |
| Cache (PostgreSQL table) | Django cache API | The `CACHES` setting |
| DBML parser (`@dbml/core`) | `frontend/src/lib/dbml/` | That folder only (§13) |
| Diagram canvas (React Flow) | `frontend/src/features/editor/canvas/` | That folder only |
| Code editor (CodeMirror 6) | `frontend/src/features/editor/code/` | That folder only |
| WebSockets (future) | `apps/collab/transport.py` | §17.1 |

### 3.7 Errors and transactions

- `apps/core/errors.py::DomainError` has three attributes: `code`, `message`, and `http_status`. `code` is a stable
  string, for example `diagram_conflict`. `message` is STE text for the user.
- `apps/core/exceptions.py::api_exception_handler` is the DRF exception handler. It changes a `DomainError` into the
  error envelope (§11.3).
- Any other exception gives HTTP 500. The log record contains the traceback. The response contains no internal data.
- Each service function is one transaction. If a workflow must change data in two apps, the upper app calls the
  `api.py` of the lower app inside its own transaction.

### 3.8 Procedure: add an app

1. Write the three items: the owner app, the apps that it depends on, and how they communicate.
2. Make `backend/apps/<app>/` with the parts in §3.2.
3. Add the app to `INSTALLED_APPS` in `config/settings/base.py`.
4. Add the app to the `layers` contract in `.importlinter`. Put it above each app that it calls.
5. Add a `forbidden` contract for its private modules.
6. Add a row to §3.3. Add a section for the app at the end of this document. Do not change the current section
   numbers.
7. Add the requirement IDs of the app to §19.2.

---

## 4. Access control and security

### 4.1 Authentication

- Login gives a Django session. The session ID is in the `sessionid` cookie. Sessions are in PostgreSQL
  (`django.contrib.sessions`, database backend).
- django-allauth does the login flows (§5.1).
- There is no API token in the browser, no JWT, and no CORS. API tokens for scripts are a future app (§17.4). The SPA
  never uses them.
- Cookie settings (SEC-003): `SESSION_COOKIE_HTTPONLY = True`, `SESSION_COOKIE_SECURE = True` in production,
  `SESSION_COOKIE_SAMESITE = "Lax"`, and `SESSION_COOKIE_AGE` of 14 days.

### 4.2 CSRF

- The Django CSRF middleware is on for all views (SEC-001). DRF `SessionAuthentication` also examines the CSRF token
  for logged-in users.
- `CSRF_COOKIE_HTTPONLY = False`. The SPA reads the `csrftoken` cookie. It sends the value in the `X-CSRFToken`
  header on each `POST`, `PUT`, `PATCH`, and `DELETE`.
- At start, the SPA calls `GET /api/v1/csrf`. This view has `ensure_csrf_cookie`, so that the cookie is always set.
- `CSRF_TRUSTED_ORIGINS` contains only `PUBLIC_BASE_URL`.

### 4.3 Roles and permissions

A user gets a role on a diagram from three sources:

| Source | Roles | Section |
|--------|-------|---------|
| Workspace member | `owner`, `admin`, `editor`, `viewer`. In v1, a personal workspace has only `owner`. | §6 |
| Share | `editor`, `viewer` | §7.5 |
| Public link | `viewer`, only for requests to `/api/v1/public/<token>` | §7.6 |

The workspace role gives this diagram role: `owner` and `admin` give `owner`. `editor` gives `editor`. `viewer` gives
`viewer`.

The effective role is the highest role from all sources. The order is `owner`, then `editor`, then `viewer`.

| Action | `viewer` | `editor` | `owner` |
|--------|----------|----------|---------|
| Read the source, the layout, and the versions. Export. | Yes | Yes | Yes |
| Duplicate into the personal workspace of the user. | Yes | Yes | Yes |
| Save the source and the layout. Rename. | No | Yes | Yes |
| Make a named version. Restore a version. | No | Yes | Yes |
| Add, change, and remove shares. Turn the public link on or off. Make a new token. | No | No | Yes |
| Move to the trash. Restore from the trash. Delete permanently. | No | No | Yes |

A person with a public link can read only the current source and layout, and export them. That person cannot read the
versions or the shares. If that person is logged in, the person can also duplicate the diagram.

### 4.4 Where the checks occur

- `apps/diagrams/policy.py::effective_role` is the only function that calculates the role of a user on a diagram.
- `apps/diagrams/policy.py::require_role` raises `DiagramNotFound` if the user has no role. The API then returns 404.
  It raises `DiagramForbidden` if the role is too low. The API then returns 403.
- Why 404: the API must not tell a user without access that the diagram exists (SEC-004).
- Each diagram service calls `require_role` first. Views do not examine roles.
- Other apps call `diagrams.api.get_access(user_id, diagram_id)`.
- A diagram in the trash is visible only to its owners, and only in the trash list. For all other users, the API
  returns 404.

### 4.5 Passwords, rate limits, and enumeration

- Passwords use Argon2 (`argon2-cffi`). `Argon2PasswordHasher` is the first item in `PASSWORD_HASHERS` (SEC-002).
- Password validators: `MinimumLengthValidator` (10), `CommonPasswordValidator`,
  `UserAttributeSimilarityValidator`, and `NumericPasswordValidator`.
- A user cannot log in before the user verifies the email address (AUTH-002).
- Sign-up and password reset give the same response for known and unknown addresses (AUTH-003).
- Rate limits (SEC-005): allauth `ACCOUNT_RATE_LIMITS` for login, sign-up, and password reset. DRF
  `ScopedRateThrottle` for our API. Both use the PostgreSQL cache.
- Before an account delete, the user must authenticate again (§5.4).

### 4.6 HTTP headers

- `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")`. The reverse proxy must set this header.
- In production: `SECURE_SSL_REDIRECT = True`, and `SECURE_HSTS_SECONDS` of 1 year.
- Content Security Policy, with `django-csp`:
  - `default-src 'self'`
  - `script-src 'self'`
  - `style-src 'self' 'unsafe-inline'` (deviation, §18.2)
  - `img-src 'self' data: blob:`
  - `worker-src 'self' blob:`
  - `connect-src 'self'`
  - `frame-ancestors 'none'`, `base-uri 'none'`, and `form-action 'self'`
- `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.
- `Referrer-Policy: same-origin`. This keeps the tokens of public links out of the `Referer` header to other sites.

### 4.7 Content safety

- The SPA shows all text from a diagram (names, notes, and comments) as plain text. It never inserts HTML from a
  diagram (EDT-005). The ESLint rule `react/no-danger` is an error.
- SVG export escapes all text.
- The services apply the size limits in §7.1.
- Do not write diagram source, passwords, tokens, or email addresses to the logs (SEC-006).

### 4.8 Secrets

All secrets are in environment variables (§16.4). Do not put a secret in the repository. `.env` is in `.gitignore`.

### 4.9 Django admin

The Django admin is at `/admin/`. Only staff users can use it. A staff user can read all diagrams. This is correct for
a self-hosted system, because the operator controls the database.

---

## 5. accounts: users and sessions

- **Contents:** the `User` model, the allauth configuration, email verification, password reset, password change,
  and account delete.
- **Depends on:** `core`, `comms`.
- **Communication:** the allauth adapter calls `comms.api.send_email`. Other apps call `accounts.api`.

### 5.1 django-allauth in headless mode

- `INSTALLED_APPS` contains `allauth`, `allauth.account`, and `allauth.headless`. `HEADLESS_ONLY = True`. The SPA uses
  the `browser` client.
- allauth sets the URL prefix `/_allauth/browser/v1/`. This prefix is outside `/api/v1/` (deviation, §18.2).
- Settings:
  - `ACCOUNT_LOGIN_METHODS = {"email"}`
  - `ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]`
  - `ACCOUNT_USER_MODEL_USERNAME_FIELD = None`
  - `ACCOUNT_EMAIL_VERIFICATION = "mandatory"`
  - `ACCOUNT_UNIQUE_EMAIL = True`
  - `ACCOUNT_CHANGE_EMAIL = True`
  - `ACCOUNT_PREVENT_ENUMERATION = True`
- `HEADLESS_FRONTEND_URLS` gives the SPA route for each URL in an email:
  - `account_confirm_email`: `/verify-email/{key}`
  - `account_reset_password_from_key`: `/reset-password/{key}`
  - `account_signup`: `/signup`
- `ACCOUNT_ADAPTER = "apps.accounts.adapter.AccountAdapter"`:
  - `send_mail` renders the allauth email template. Then it calls `comms.api.send_email`.
  - `is_open_for_signup` returns `settings.SIGNUP_ENABLED` (AUTH-006).
- Before you upgrade allauth, compare these setting names with the allauth release notes.

### 5.2 User model

`apps/accounts/models.py::User` is a custom user model (`AbstractBaseUser` and `PermissionsMixin`). It is in the first
migration, because a later change of the user model is very difficult in Django.

| Field | Type | Note |
|-------|------|------|
| `id` | UUIDv7 | Primary key |
| `email` | varchar(254) | Unique on `lower(email)`. This is the `USERNAME_FIELD`. |
| `display_name` | varchar(100) | Can be empty |
| `is_active`, `is_staff` | boolean | |
| `date_joined` | timestamptz | |

`User.email` of a logged-in user is always a verified address. A user cannot log in before verification. If a user
changes the address, allauth changes `User.email` only after the user verifies the new address. Shares (§7.5) use this
fact.

### 5.3 Flows

| Flow | Endpoint | Result |
|------|----------|--------|
| Sign up (AUTH-001) | `POST /_allauth/browser/v1/auth/signup` | Sends a verification email. No session yet. |
| Verify the email address | `POST /_allauth/browser/v1/auth/email/verify` | Starts a session. |
| Log in | `POST /_allauth/browser/v1/auth/login` | Starts a session. |
| Read the session | `GET /_allauth/browser/v1/auth/session` | The current user, or 401. |
| Log out | `DELETE /_allauth/browser/v1/auth/session` | Ends the session. |
| Ask for a password reset | `POST /_allauth/browser/v1/auth/password/request` | Sends a reset email. The response is the same for unknown addresses. |
| Reset the password (AUTH-004) | `POST /_allauth/browser/v1/auth/password/reset` | Sets the new password. |
| Change the password | `POST /_allauth/browser/v1/account/password/change` | Sets the new password. |
| Change the email address | `POST /_allauth/browser/v1/account/email` | Sends a verification email to the new address. |
| Authenticate again | `POST /_allauth/browser/v1/auth/reauthenticate` | Lets the user do a sensitive action for 5 minutes. |
| Delete the account | `DELETE /api/v1/accounts/me` | Our endpoint (§5.4). |

### 5.4 Account delete

`apps/accounts/services.py::delete_account(user_id)` does these steps in one transaction (AUTH-005):

1. It makes sure that the user authenticated again in the last 5 minutes. If not, it raises
   `ReauthenticationRequired` (HTTP 401).
2. It enqueues a confirmation email to the address of the user (§8).
3. It deletes the `User` row.

Django then deletes the dependent rows through `on_delete=models.CASCADE` on the foreign keys in the upper apps. These
rows are the personal workspace, its members, its diagrams, and their versions, shares, and public links. Diagrams in
other workspaces stay, and their `created_by` and `updated_by` become `NULL`. Shares to the address of the user stay
(§18.3).

### 5.5 Public interface

```python
@dataclass(frozen=True)
class UserRef:
    id: UUID
    email: str
    display_name: str

def get_user(user_id: UUID) -> UserRef: ...  # Raises UserNotFound.
def get_users(user_ids: Iterable[UUID]) -> dict[UUID, UserRef]: ...  # Unknown IDs are not in the result.
```

### 5.6 Closed sign-up

If `SIGNUP_ENABLED` is `false`, the system refuses each sign-up. A staff user then makes accounts in the Django admin.
With this setting, an operator can keep an installation private.

---

## 6. workspaces: workspaces and members

- **Contents:** workspaces and their members. In v1, each user has one personal workspace. Team workspaces are a
  future feature (§17.3), and the tables can already hold them.
- **Depends on:** `core`, and `accounts` (only for the foreign key to `User`).
- **Communication:** `diagrams` calls `workspaces.api`.

### 6.1 Models

`Workspace`:

| Field | Type | Note |
|-------|------|------|
| `id` | UUIDv7 | Primary key |
| `name` | varchar(100) | "Personal" for a personal workspace |
| `kind` | varchar(16) | `personal` or `team` |
| `personal_owner` | One-to-one to `User`, `CASCADE`, nullable | Set only if `kind` is `personal` |
| `created_at` | timestamptz | |

A check constraint makes sure that `personal_owner` is set if, and only if, `kind` is `personal`.

`Member`:

| Field | Type | Note |
|-------|------|------|
| `id` | UUIDv7 | Primary key |
| `workspace` | FK to `Workspace`, `CASCADE` | |
| `user` | FK to `User`, `CASCADE` | |
| `role` | varchar(16) | `owner`, `admin`, `editor`, or `viewer` |
| `created_at` | timestamptz | |

The pair (`workspace`, `user`) is unique. In v1, each personal workspace has one member, with the role `owner`.

### 6.2 The personal workspace

- `get_or_create_personal_workspace(user_id)` makes the workspace and its `owner` member at the first call (WSP-001).
  Each later call returns the same workspace.
- The unique constraint on `personal_owner` prevents a second workspace if two requests come at the same time. The
  service catches the `IntegrityError` and reads the row again.
- `accounts` does not call `workspaces` at sign-up, because `accounts` is in a lower layer. Instead,
  `list_roles_for_user` calls `get_or_create_personal_workspace` first. For this reason, a GET request can write a row
  (§18.3).

### 6.3 Public interface

```python
class WorkspaceRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"

@dataclass(frozen=True)
class WorkspaceRef:
    id: UUID
    name: str
    kind: str  # "personal" or "team"

def get_or_create_personal_workspace(user_id: UUID) -> WorkspaceRef: ...
def get_role(user_id: UUID, workspace_id: UUID) -> WorkspaceRole | None: ...
def list_roles_for_user(user_id: UUID) -> dict[UUID, WorkspaceRole]: ...  # Workspace ID to role.
```

---

## 7. diagrams: diagrams, versions, shares, and public links

- **Contents:** diagrams, versions, shares, public links, the trash, and the access policy for diagrams. This app is
  the core of the product.
- **Depends on:** `core`, `comms` (share notices), `accounts` (users), and `workspaces` (roles and the personal
  workspace).
- **Communication:** `diagrams` calls the `api.py` of each of these apps. Future apps (§17) call `diagrams.api`.

### 7.1 Diagram model

| Field | Type | Note |
|-------|------|------|
| `id` | UUIDv7 | Primary key. It is in the URL `/d/<id>`. |
| `workspace` | FK to `workspaces.Workspace`, `CASCADE` | |
| `name` | varchar(200) | Not empty |
| `source` | text | The DBML source, exactly as the client sent it (DGM-003) |
| `layout` | jsonb | Table positions (§7.2) |
| `change_number` | integer | Starts at 1. Goes up by 1 on each save (§7.3). |
| `created_by`, `updated_by` | FK to `User`, `SET_NULL`, nullable | |
| `created_at`, `updated_at` | timestamptz | |
| `trashed_at` | timestamptz, nullable | Set while the diagram is in the trash (§7.7) |

Limits (DGM-005). The services apply them. These settings control them:

| Setting | Default |
|---------|---------|
| `DIAGRAM_SOURCE_MAX_BYTES` | 1,048,576 (1 MiB of UTF-8) |
| `DIAGRAM_LAYOUT_MAX_BYTES` | 262,144 (256 KiB) |
| `DIAGRAM_NAME_MAX_CHARS` | 200 |
| `DIAGRAM_MAX_SHARES` | 100 for each diagram |
| `DIAGRAM_AUTO_VERSION_MINUTES` | 10 |
| `DIAGRAM_AUTO_VERSION_DAYS` | 90 |
| `DIAGRAM_TRASH_DAYS` | 30 |

The backend does not parse `source` (§13.1). For this reason, the backend can save DBML that has errors. The editor
shows the errors.

### 7.2 Layout format

```json
{
  "format": 1,
  "tables": {
    "public.users": { "x": 120, "y": 80 },
    "public.orders": { "x": 480, "y": 80 }
  }
}
```

- The key of each table is its table key: `<schema>.<table>`. If the DBML gives no schema, the schema is `public`.
- The layout keeps only positions. Colors are in the DBML source (`headercolor`). The pan and zoom of the canvas are
  not in the layout. The SPA keeps them for each user in `localStorage`.
- `apps/diagrams/layout.py` validates the layout. Each number must be finite. The service refuses unknown keys.
- If the format changes, increase `format`. When the SPA loads a diagram, it changes an old format to the new format.

### 7.3 Save and conflict control

Each diagram response has the header `ETag: "<change_number>"`. A save must send that value back in `If-Match`
(DGM-002).

`PATCH /api/v1/diagrams/<id>` has `If-Match: "<n>"`, and one or more of `name`, `source`, and `layout`:

1. If `If-Match` is not in the request, the API returns 428.
2. The service does one conditional update:
   `UPDATE ... SET ..., change_number = change_number + 1 WHERE id = <id> AND change_number = <n>`.
3. If no row changed, the API returns 412. The body gives the current `change_number`, `updated_by`, and
   `updated_at`.
4. If the row changed, the service applies the automatic version rule (§7.4). The API returns 200 and the new `ETag`.

After a 412, the SPA shows a conflict banner (§12.6). The system never overwrites a change without a message to the
user.

### 7.4 Versions

`Version`:

| Field | Type | Note |
|-------|------|------|
| `id` | UUIDv7 | Primary key |
| `diagram` | FK to `Diagram`, `CASCADE` | |
| `kind` | varchar(16) | `auto`, `named`, or `restore` |
| `label` | varchar(200) | Empty for `auto` |
| `source`, `layout` | text, jsonb | A copy of the diagram at that time |
| `change_number` | integer | The `change_number` of the diagram at that time |
| `created_by` | FK to `User`, `SET_NULL`, nullable | |
| `created_at` | timestamptz | |

Rules:

- **Named version (VER-001).** An editor sends `POST /versions` with a label. The service copies the current source
  and layout of the diagram on the server.
- **Automatic version (VER-002).** After each save, the service examines the newest version. If there is no version,
  or if the newest version is older than `DIAGRAM_AUTO_VERSION_MINUTES`, it makes an `auto` version. It does not make
  a version if the content is the same as the newest version.
- **Restore (VER-003).** `POST /versions/<vid>/restore` has `If-Match`. The service copies the version into the
  diagram with a normal save (§7.3). Then it makes a `restore` version with the label "Restored from <label or
  date>". A restore never deletes a version.
- **Retention (VER-004).** A daily job deletes `auto` versions older than `DIAGRAM_AUTO_VERSION_DAYS`. It never
  deletes the newest version of a diagram. It never deletes `named` or `restore` versions.
- The version list is newest first, without `source` and `layout`. `GET /versions/<vid>` returns the full version.

### 7.5 Shares

`Share`:

| Field | Type | Note |
|-------|------|------|
| `id` | UUIDv7 | Primary key |
| `diagram` | FK to `Diagram`, `CASCADE` | |
| `email` | varchar(254) | Lowercase |
| `role` | varchar(16) | `viewer` or `editor` |
| `created_by` | FK to `User`, `SET_NULL`, nullable | |
| `created_at` | timestamptz | |

The pair (`diagram`, `email`) is unique. There is an index on `email`.

- An owner adds an email address and a role (SHR-001). The API does not tell if an account exists for the address
  (SHR-005).
- The service sends a share notice to the address through `comms` (§8). If the person has no account, the person can
  sign up with that address. Then the share gives access.
- Access check: a share gives its role to the logged-in user whose `User.email` is the same as `Share.email`.
  `User.email` is always a verified address (§5.2).
- "Shared with me" lists the diagrams that have a share for the address of the user. It does not list diagrams in the
  trash.
- The owner can change the role or remove the share. The change has an effect on the next request.
- A share to the address of the owner has no effect. The API refuses it with 400 and the code `share_self`.

### 7.6 Public link

`PublicLink`:

| Field | Type | Note |
|-------|------|------|
| `id` | UUIDv7 | Primary key |
| `diagram` | One-to-one to `Diagram`, `CASCADE` | |
| `token` | varchar(64), unique | `secrets.token_urlsafe(32)` |
| `created_by` | FK to `User`, `SET_NULL`, nullable | |
| `created_at` | timestamptz | |

- `PUT /public-link` turns the public link on (SHR-002). If a link exists, the API returns it with no change.
- `POST /public-link/rotate` makes a new token. The old URL stops immediately (SHR-003).
- `DELETE /public-link` turns the link off. The old URL then gives 404 (SHR-004).
- The URL is `<PUBLIC_BASE_URL>/s/<token>`. `GET /api/v1/public/<token>` returns the name, the source, the layout, and
  `updated_at`. A login is not necessary. If the diagram is in the trash, the API returns 404.
- A logged-in person can duplicate the diagram with `POST /api/v1/public/<token>/duplicate`.
- The token is plain text in the database, not a hash. The token protects diagram content that is in the same
  database, so a hash gives no more protection. With plain text, the owner can see the URL again at any time.

### 7.7 Trash

```
           make
            |
            v
  +----> active ---- move to trash ----> trashed ---- after 30 days, or delete permanently ----> deleted
  |                                         |
  +---------------- restore ----------------+
```

- `DELETE /diagrams/<id>` moves the diagram to the trash. It sets `trashed_at` (DGM-004).
- `POST /diagrams/<id>/restore` sets `trashed_at` to `NULL`.
- `DELETE /diagrams/<id>/permanent` deletes the diagram, all its versions and shares, and its public link. The
  diagram must be in the trash. If it is not in the trash, the API returns 409.
- The daily job `diagrams.purge_trash` deletes the diagrams that are in the trash for more than `DIAGRAM_TRASH_DAYS`.
- Shares and the public link stay while the diagram is in the trash. They give no access until the owner restores the
  diagram.

### 7.8 Duplicate

`POST /diagrams/<id>/duplicate` makes a new diagram in the personal workspace of the caller. The name is "Copy of
<name>", cut to 200 characters. The new diagram gets the same source and layout. It gets no versions, no shares, and
no public link. Its `change_number` is 1. A `viewer` can duplicate a diagram.

### 7.9 Endpoints

All paths start with `/api/v1`. These endpoints apply DGM-001 and the other requirements of this section.

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/diagrams?scope=mine\|shared\|trash` | Logged in | Summaries without `source`. Newest `updated_at` first. Cursor pagination. |
| POST | `/diagrams` | Logged in | Makes the diagram in the personal workspace. `name` is necessary. `source` and `layout` are optional. |
| GET | `/diagrams/<id>` | `viewer` | The full diagram, the role of the caller, and the `ETag`. |
| PATCH | `/diagrams/<id>` | `editor` | `If-Match` is necessary. Changes `name`, `source`, or `layout`. |
| DELETE | `/diagrams/<id>` | `owner` | Moves the diagram to the trash. |
| POST | `/diagrams/<id>/restore` | `owner` | Restores the diagram from the trash. |
| DELETE | `/diagrams/<id>/permanent` | `owner` | Only for a diagram in the trash. |
| POST | `/diagrams/<id>/duplicate` | `viewer` | |
| GET | `/diagrams/<id>/versions` | `viewer` | Summaries. Newest first. |
| POST | `/diagrams/<id>/versions` | `editor` | Makes a named version. |
| GET | `/diagrams/<id>/versions/<vid>` | `viewer` | The full version. |
| POST | `/diagrams/<id>/versions/<vid>/restore` | `editor` | `If-Match` is necessary. |
| GET, POST | `/diagrams/<id>/shares` | `owner` | |
| PATCH, DELETE | `/diagrams/<id>/shares/<sid>` | `owner` | |
| GET, PUT, DELETE | `/diagrams/<id>/public-link` | `owner` | |
| POST | `/diagrams/<id>/public-link/rotate` | `owner` | |
| GET | `/public/<token>` | Anyone | Read only. Rate limit for each IP address. |
| POST | `/public/<token>/duplicate` | Logged in | |

### 7.10 Public interface

```python
class DiagramRole(StrEnum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"

@dataclass(frozen=True)
class DiagramRef:
    id: UUID
    workspace_id: UUID
    name: str
    change_number: int
    updated_at: datetime

def get_access(user_id: UUID | None, diagram_id: UUID) -> DiagramRole | None: ...
def get_diagram(diagram_id: UUID) -> DiagramRef: ...  # Raises DiagramNotFound.
```

Add a function only when a caller exists. Example: the future `collab` app (§17.1) adds `get_content` and
`save_content`.

---

## 8. comms: outbound email

- **Contents:** the delivery of email, and a record of each email. `comms` has no business rules about the content of
  an email. The caller gives the subject and the body.
- **Depends on:** `core`.
- **Communication:** `accounts` and `diagrams` call `comms.api.send_email`.

### 8.1 Flow

1. A service calls `send_email(to=..., subject=..., body=..., key=...)` inside its transaction.
2. `send_email` writes an `OutboundEmail` row with the status `queued`. It enqueues the job
   `comms.deliver_email(email_id)` in `transaction.on_commit`.
3. The worker runs the job. If the status is `sent`, the job stops. If not, the job sends the email with Django
   `send_mail` and sets the status to `sent`.
4. If the send fails, the job raises the error. Procrastinate tries again up to 5 times, with an exponential wait.
   After the last attempt, the job sets the status to `failed` and writes an `ERROR` log record.

`key` is an idempotency key, and it is unique. If a caller sends the same key two times, the second call has no
effect. Example: `share-notice:<share_id>`. For allauth emails, the adapter makes a new UUID for each email.

### 8.2 OutboundEmail

| Field | Type | Note |
|-------|------|------|
| `id` | UUIDv7 | Primary key |
| `key` | varchar(200), unique | Idempotency key |
| `to_address` | varchar(254) | |
| `subject` | varchar(200) | |
| `body` | text | Plain text |
| `status` | varchar(16) | `queued`, `sent`, or `failed` |
| `attempts` | integer | |
| `last_error` | text | |
| `created_at`, `sent_at` | timestamptz | `sent_at` is nullable |

A daily job deletes the rows that are older than 7 days, because a body can contain a password reset URL.

### 8.3 Templates

- All emails are plain text.
- The caller app keeps its templates in `apps/<app>/templates/<app>/email/`. Example:
  `apps/diagrams/templates/diagrams/email/share_notice.txt`.
- All email text uses ASD-STE100.

### 8.4 Local work

Docker Compose runs Mailpit. Mailpit gets SMTP mail on port 1025 and shows it at http://localhost:8025. The `dev`
settings send email to `localhost:1025`.

### 8.5 Public interface

```python
def send_email(*, to: str, subject: str, body: str, key: str) -> None: ...
```

---

## 9. core: the shared kernel

`core` holds code that all apps use and that has no domain rules. It imports no other app. If only one app uses a
helper, keep the helper in that app.

| Module | Contents |
|--------|----------|
| `models.py` | `BaseModel` (abstract): `id = UUIDField(primary_key=True, default=uuid.uuid7, editable=False)` and `created_at` |
| `errors.py` | `DomainError` and its general subclasses: `NotFound`, `Forbidden`, `Conflict`, `ValidationFailed`, `PreconditionFailed`, `PreconditionRequired` |
| `exceptions.py` | `api_exception_handler` for DRF (§11.3) |
| `jobs.py` | The Procrastinate app. It is the only module that imports `procrastinate` directly (§10). |
| `pagination.py` | Cursor pagination (§11.4) |
| `views.py` | `healthz`, `readyz`, and `csrf` |
| `logging.py` | The JSON log format |

Health views (OPS-001):

- `GET /healthz` returns 200 while the process runs.
- `GET /readyz` returns 200 only if the database answers `SELECT 1`. If not, it returns 503.

---

## 10. Background jobs

### 10.1 Runner

- Procrastinate runs the jobs. It keeps the queue in PostgreSQL (`procrastinate.contrib.django`). Its tables come from
  Django migrations.
- The worker command is `python manage.py procrastinate worker`.
- Each app puts its jobs in `apps/<app>/tasks.py`. The jobs use the decorators of `apps.core.jobs.app`.
- There are two queues: `email` and `maintenance`.

### 10.2 Rules

1. **Idempotent.** A job can run more than one time with the same arguments. Each run must give the same result. Use a
   status column or an idempotency key.
2. **Fail loudly.** Do not catch an exception and then continue. Let the job raise it. Procrastinate records the
   failure, and the job writes an `ERROR` log record with the job ID (OPS-002).
3. **Small arguments.** Pass IDs, not objects. The job reads the current data from the database.
4. **Enqueue after commit.** Use `transaction.on_commit(lambda: job.defer(...))`.
5. **Retry only temporary errors.** Example: an SMTP connection error. Use a Procrastinate `RetryStrategy` with a
   maximum number of attempts.
6. **One owner app.** A job belongs to the app whose data it changes.

### 10.3 List of jobs

| Job | App | Start | Idempotent because |
|-----|-----|-------|--------------------|
| `comms.deliver_email(email_id)` | `comms` | `send_email` | It stops if the status is `sent`. |
| `comms.purge_old_emails` | `comms` | Daily, 03:00 UTC | It deletes by age. |
| `diagrams.purge_trash` | `diagrams` | Daily, 03:10 UTC | It deletes by age. |
| `diagrams.purge_old_auto_versions` | `diagrams` | Daily, 03:20 UTC | It deletes by age and keeps the newest version. |
| `accounts.clear_expired_sessions` | `accounts` | Daily, 03:30 UTC | It calls `clearsessions`. |

Periodic jobs use `@app.periodic(cron=...)`. Procrastinate starts each periodic job one time for each period, also when
more than one worker runs.

### 10.4 Monitor

- The Procrastinate Django admin shows the jobs and their status.
- The operator must monitor the `ERROR` log records. A job with the status `failed` stays in the table until a person
  examines it.

---

## 11. API conventions

### 11.1 General rules

- All endpoints start with `/api/v1/`. The only exception is allauth: `/_allauth/browser/v1/` (§5.1).
- Requests and responses use JSON. Field names use `snake_case`.
- IDs are UUID strings. Times are ISO 8601 in UTC, with `Z`.
- The default DRF permission is `IsAuthenticated`. Only `/api/v1/csrf` and `/api/v1/public/*` use `AllowAny`.
- drf-spectacular makes the OpenAPI schema at `/api/v1/schema/` in the `dev` and `test` settings. The frontend API
  modules (§12.5) follow this schema.

### 11.2 Status codes

| Code | Use |
|------|-----|
| 200 | A GET, PATCH, or PUT is complete. |
| 201 | A POST made a new object. |
| 204 | A DELETE is complete. |
| 400 | `validation_failed`, or a different input error. |
| 401 | The user is not logged in. |
| 403 | The role is too low, or the CSRF token is not correct. |
| 404 | The object does not exist, or the user has no access (§4.4). |
| 409 | The state does not let the action occur. Example: a permanent delete of a diagram that is not in the trash. |
| 412 | `If-Match` does not agree with the current `change_number`. |
| 413 | The body is too large. |
| 428 | `If-Match` is not in the request. |
| 429 | There are too many requests (rate limit). |

### 11.3 Error envelope

```json
{
  "error": {
    "code": "diagram_conflict",
    "message": "Another person changed this diagram. Load the new version, or keep your version.",
    "fields": { "name": ["Type a name."] }
  }
}
```

- `code` is stable. The SPA uses only `code` in its logic.
- `message` is STE text that the SPA can show to the user.
- `fields` occurs only with `validation_failed`.

### 11.4 Pagination

Lists use cursor pagination: `?cursor=<c>&page_size=50`. The maximum `page_size` is 100. The response is
`{"results": [...], "next": "<cursor or null>"}`.

### 11.5 Release check

Each response has the header `X-App-Release`, with the release of the server. If it is different from the release of
the SPA, the SPA shows "A new release is available. Reload the page." This stops an old SPA tab before it sends
requests to a changed API.

### 11.6 Changes to the API

The SPA and the API are in the same image, and they deploy together. For this reason, `/api/v1` can change together
with the SPA. Add `/api/v2` only when clients outside this repository use the API (§17.4).

---

## 12. Frontend

### 12.1 Stack

| Function | Library |
|----------|---------|
| UI | React 19 |
| Build and dev server | Vite 8 |
| Language | JavaScript with JSX. No TypeScript. Use JSDoc types for the public functions in `src/lib/`. |
| Routes | React Router 7 (library mode) |
| Server state | TanStack Query 5 |
| Editor state | Zustand |
| Code editor | CodeMirror 6 |
| Canvas | React Flow (`@xyflow/react`) |
| Automatic layout | elkjs |
| DBML | `@dbml/core` |
| Image export | html-to-image |
| Tests | Vitest, React Testing Library, MSW, Playwright |
| Lint and format | ESLint (flat config), Prettier |

### 12.2 Folders

```
frontend/src/
  main.jsx          Entry point: router, QueryClient, CSRF start
  app/              Routes, app shell, error boundary, providers
  features/
    auth/           Log in, sign up, verify email, reset password, account settings
    diagrams/       Diagram list, trash, and the dialogs to make, rename, and delete a diagram
    editor/         Editor page: code pane, canvas, toolbar, autosave, conflict banner
      code/         CodeMirror wrapper and the DBML syntax mode
      canvas/       React Flow wrapper: table nodes, ref edges, automatic layout
      store.js      Editor store (Zustand)
    versions/       Version panel
    shares/         Share dialog, public link controls, public view page
    import-export/  Import dialog and export dialog
  lib/
    api/            The fetch client, and one module for each backend app
    dbml/           The only code that imports @dbml/core. The parser worker.
  ui/               Shared presentational components. No API calls and no store.
  text/en.js        All UI text (ASD-STE100)
  styles/
```

### 12.3 Module rules

- A feature gives its public parts in `features/<name>/index.js`. Other features import only from that file.
- `ui/` and `lib/` do not import from `features/`.
- Only `lib/dbml/` imports `@dbml/core`.
- Only `features/editor/canvas/` imports `@xyflow/react`.
- Only `features/editor/code/` imports CodeMirror packages.
- Only `lib/api/` calls `fetch`.
- The ESLint rule `no-restricted-imports` stops each import that breaks these rules.

### 12.4 Routes

| Path | Page | Access |
|------|------|--------|
| `/login`, `/signup`, `/verify-email/:key`, `/reset-password`, `/reset-password/:key` | Auth pages | Anyone |
| `/` | Diagram list: "My diagrams" and "Shared with me" | Logged in |
| `/trash` | Trash | Logged in |
| `/d/:diagramId` | Editor | `viewer` or higher |
| `/s/:token` | Public view (read only) | Anyone with the URL |
| `/settings` | Account settings | Logged in |

Django serves `index.html` for these paths (§16.3).

### 12.5 API client

- `lib/api/client.js` wraps `fetch`. It uses `credentials: "same-origin"`. On `POST`, `PUT`, `PATCH`, and `DELETE`,
  it adds `X-CSRFToken` with the value of the `csrftoken` cookie.
- It changes the error envelope (§11.3) into an `ApiError` with `status`, `code`, `message`, and `fields`.
- There is one module for each backend app: `lib/api/auth.js` (allauth), `lib/api/diagrams.js`, and the others.
- If a response is 401, the session query changes to "logged out". The router then sends the user to
  `/login?next=<path>`.
- TanStack Query keys: `["session"]`, `["diagrams", scope]`, `["diagram", id]`, `["versions", id]`,
  `["shares", id]`, and `["public-link", id]`.

### 12.6 Editor data flow

```
CodeMirror --(text, 250 ms after the last key)--> parser worker --(parse result, errors)--> editor store
editor store --(parse result + layout)--> canvas: nodes and edges
canvas: the user moves a table --> editor store: layout
editor store --(source + layout, 1 s after the last change)--> autosave: PATCH with If-Match --> API
```

- **Parse.** The parser runs in a Web Worker (`lib/dbml/worker.js`). The UI thread never runs the parser (EDT-001). If
  the source has errors, the canvas keeps the last correct parse result. The code pane shows each error at its line
  and column (EDT-002).
- **Autosave (EDT-003).** The editor saves 1 second after the last change. It also saves when the page becomes hidden
  (`visibilitychange`), with `fetch` and `keepalive: true`. Only one save is in progress at a time. Changes that occur
  during a save go into the next save.
- **Save status.** The toolbar shows "Saved", "Save in progress", or "Changes not saved".
- **Conflict.** After a 412, autosave stops. A banner shows two actions:
  - "Load the new version": the SPA discards the local changes and loads the diagram again.
  - "Keep my version": first, the SPA makes a named version of the server content, with the label "Before
    overwrite". Then it reads the new `ETag` and saves the local content. No content is lost.
- **Read only.** For a `viewer` and for a public link, the editor is read only and autosave is off.

### 12.7 Canvas

- Each table is one React Flow node. Each column has a handle on the left side and on the right side. Each ref is an
  edge with cardinality marks (one or many) at its two ends.
- A `TableGroup` is a background node around its tables.
- The positions come from the layout. If a table has no position, elkjs (layered algorithm) gives it a position. The
  other tables do not move (EDT-004). elkjs runs in a Web Worker.
- The "Arrange" action runs elkjs for all tables.
- If a diagram has more than 200 tables, the canvas renders only the visible nodes (`onlyRenderVisibleElements`).

### 12.8 UI text

- All UI text is in `src/text/en.js`, in ASD-STE100. Components do not contain literal sentences. The ESLint rule
  `react/jsx-no-literals` finds literal text in JSX.
- With one file, a reviewer can examine all UI text for STE. A later translation adds files and does not change the
  components.

### 12.9 Accessibility

- All actions are possible with the keyboard. A dialog keeps the focus inside until it closes.
- Each icon button has an `aria-label` from `src/text/en.js`.
- The code pane gives the full diagram as text. For this reason, the canvas is not the only view of a diagram.

---

## 13. DBML in the browser

### 13.1 Decision: the browser is the only parser

The frontend parses DBML with `@dbml/core`. The backend keeps the source as text and never parses it. Reasons:

1. One parser gives one set of rules. Two parsers (for example `@dbml/core` and PyDBML) can disagree about the same
   source.
2. The diagram must change while the user types. A server call for each change is too slow.
3. Import and export stay in the browser. The source never goes to a third party (IMX-004).

Cost: the server cannot validate DBML, find tables in a source, or export without a browser. §17.5 gives the boundary
for a later server-side renderer.

### 13.2 Interface of lib/dbml

```js
// All functions run in the parser worker and return a Promise.
parse(source)              // -> { result: ParseResult | null, errors: ParseError[] }
exportSql(source, dialect) // dialect: "postgres" | "mysql" | "mssql" | "oracle". Returns SQL text.
importSql(sql, dialect)    // dialect: "postgres" | "mysql" | "mssql". Returns DBML source.
```

The parse result (`lib/dbml/parse-result.js`):

```
ParseResult { project, tables, refs, enums, groups }
  project:  { name, note } or null
  Table:    { key: "<schema>.<name>", schema, name, alias, note, headerColor, columns, indexes }
  Column:   { name, type, pk, notNull, unique, increment, default, note }
  Ref:      { key, from: { tableKey, columns }, to: { tableKey, columns },
              cardinality: "1-1" | "1-n" | "n-1" | "n-n", onDelete, onUpdate }
  Enum:     { key, schema, name, values: [{ name, note }] }
  Group:    { name, tableKeys, color }
ParseError  { message, line, column, endLine, endColumn }
```

The canvas and all other code use only this shape. They never get `@dbml/core` objects. If `@dbml/core` changes its
output, change only `lib/dbml/`.

### 13.3 Import and export

| Format | Direction | Code |
|--------|-----------|------|
| SQL: PostgreSQL, MySQL, SQL Server, Oracle | Export (IMX-001) | `lib/dbml`, `exportSql` |
| SQL: PostgreSQL, MySQL, SQL Server | Import (IMX-003) | `lib/dbml`, `importSql` |
| DBML file (`.dbml`) | Export and import | Plain text file |
| PNG, SVG | Export (IMX-002) | `features/editor/canvas`, html-to-image |

- An import makes a new diagram with the result. It never replaces the source of a current diagram.
- The import and export dialogs load their code with a dynamic `import()`, because the SQL parsers are large.
- If a new release of `@dbml/core` adds a dialect, add the dialect to this table.

### 13.4 Procedure: upgrade @dbml/core

1. Change the exact release in `package.json`. Do not use a range.
2. Run the golden tests in `src/lib/dbml/__fixtures__/` (§15.2).
3. If the output changed, change the mapping in `lib/dbml/`. Do not change the canvas.
4. Write the result in the pull request.

### 13.5 Syntax colors

`features/editor/code/dbml-language.js` gives CodeMirror a `StreamLanguage` mode for the DBML keywords (`Table`,
`Ref`, `Enum`, `TableGroup`, `Project`, `Note`, and `indexes`). The syntax colors are independent of the parser. The
errors come only from the parser.

---

## 14. Data, schema, and migrations

### 14.1 Rules

- Use PostgreSQL 18 only. The tests also use PostgreSQL. Do not use SQLite.
- Primary keys are UUIDv7 values from `uuid.uuid7()` (Python 3.14). UUIDv7 values increase with time. For this
  reason, new rows go to the end of the index.
- All times are `timestamptz` in UTC (`USE_TZ = True`).
- Each app has its own tables. The table prefix is the app label. No app writes to the tables of a different app.
- Foreign keys between apps point only down the layers (§3.4).
- Email addresses are lowercase in all tables.

### 14.2 Schema

This is the schema in DBML. When you change a model, change this block in the same commit.

```dbml
Project dbml_maker {
  database_type: 'PostgreSQL'
}

Table accounts_user {
  id uuid [pk]
  email varchar(254) [not null, note: 'Unique on lower(email). Verified for each user who can log in.']
  display_name varchar(100) [not null, default: '']
  password varchar(128) [not null]
  is_active boolean [not null]
  is_staff boolean [not null]
  is_superuser boolean [not null]
  last_login timestamptz
  date_joined timestamptz [not null]
}

Table workspaces_workspace {
  id uuid [pk]
  name varchar(100) [not null]
  kind varchar(16) [not null, note: 'personal | team']
  personal_owner_id uuid [unique, ref: - accounts_user.id, note: 'Set only when kind = personal']
  created_at timestamptz [not null]
}

Table workspaces_member {
  id uuid [pk]
  workspace_id uuid [not null, ref: > workspaces_workspace.id]
  user_id uuid [not null, ref: > accounts_user.id]
  role varchar(16) [not null, note: 'owner | admin | editor | viewer']
  created_at timestamptz [not null]

  indexes {
    (workspace_id, user_id) [unique]
  }
}

Table diagrams_diagram {
  id uuid [pk]
  workspace_id uuid [not null, ref: > workspaces_workspace.id]
  name varchar(200) [not null]
  source text [not null]
  layout jsonb [not null]
  change_number integer [not null, default: 1]
  created_by_id uuid [ref: > accounts_user.id]
  updated_by_id uuid [ref: > accounts_user.id]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  trashed_at timestamptz

  indexes {
    (workspace_id, updated_at)
    trashed_at
  }
}

Table diagrams_version {
  id uuid [pk]
  diagram_id uuid [not null, ref: > diagrams_diagram.id]
  kind varchar(16) [not null, note: 'auto | named | restore']
  label varchar(200) [not null, default: '']
  source text [not null]
  layout jsonb [not null]
  change_number integer [not null]
  created_by_id uuid [ref: > accounts_user.id]
  created_at timestamptz [not null]

  indexes {
    (diagram_id, created_at)
  }
}

Table diagrams_share {
  id uuid [pk]
  diagram_id uuid [not null, ref: > diagrams_diagram.id]
  email varchar(254) [not null, note: 'Lowercase']
  role varchar(16) [not null, note: 'viewer | editor']
  created_by_id uuid [ref: > accounts_user.id]
  created_at timestamptz [not null]

  indexes {
    (diagram_id, email) [unique]
    email
  }
}

Table diagrams_publiclink {
  id uuid [pk]
  diagram_id uuid [not null, unique, ref: - diagrams_diagram.id]
  token varchar(64) [not null, unique]
  created_by_id uuid [ref: > accounts_user.id]
  created_at timestamptz [not null]
}

Table comms_outboundemail {
  id uuid [pk]
  key varchar(200) [not null, unique]
  to_address varchar(254) [not null]
  subject varchar(200) [not null]
  body text [not null]
  status varchar(16) [not null, note: 'queued | sent | failed']
  attempts integer [not null, default: 0]
  last_error text [not null, default: '']
  created_at timestamptz [not null]
  sent_at timestamptz
}
```

Django and the libraries add more tables. These are `django_session`, `django_migrations`, `django_content_type`,
`django_admin_log`, `auth_permission`, `auth_group`, `accounts_user_groups`, and `accounts_user_user_permissions`.
Also, `account_emailaddress` comes from allauth and is part of `accounts`. `core_cache` is the Django database cache,
made by `createcachetable`. The `procrastinate_*` tables are part of `core`.

### 14.3 Migration rules

1. Run `makemigrations <app>` for each model change. CI fails if a model change has no migration.
2. Do not edit a migration after it is on `staging` or `main`. Add a new migration.
3. The deploy runs the migrations before the new code starts (§16.5). For a short time, the old code runs on the new
   schema. For this reason, each migration must be backward compatible:
   - To add a column, make it nullable or give it a `db_default`.
   - To remove a column, stop all use of it in one release. Remove it in the next release.
   - To rename a column, add the new column, copy the data, change the code, and then remove the old column. This
     takes three releases.
4. Keep data migrations in files that are separate from schema migrations. A data migration must be idempotent. It
   must use `apps.get_model`.
5. For an index on a large table (for example `diagrams_version`), use `AddIndexConcurrently` in a migration with
   `atomic = False`.

---

## 15. Tests

### 15.1 Backend

- Use pytest and pytest-django. The settings module is `config.settings.test`.
- The tests use PostgreSQL 18. Start it with `docker compose up -d db`.
- Each app keeps its tests in `apps/<app>/tests/`. The factories (factory_boy) are in `tests/factories.py`.
- The tests of an app must not import the models or the factories of a different app. Use the `testing.py` module of
  that app. Example: `apps/accounts/testing.py::make_user`.
- API tests use DRF `APIClient`. Tests for CSRF use `APIClient(enforce_csrf_checks=True)`.
- To test a job, call its function directly. To test that a service enqueues a job, use the Procrastinate
  `InMemoryConnector`.
- `lint-imports` runs in CI (§3.4).
- CI fails if the line coverage of `backend/apps/` is less than 90%.

### 15.2 Frontend

- Use Vitest, React Testing Library, and jsdom. Each test file is next to its code: `*.test.js` or `*.test.jsx`.
- MSW gives the API responses in component tests.
- **Golden tests** for `lib/dbml`: each `src/lib/dbml/__fixtures__/<name>.dbml` file has an expected parse result
  (`<name>.result.json`). It also has the expected SQL for each dialect (`<name>.<dialect>.sql`).
- Test the conversion from a parse result to nodes and edges as pure functions. Do not test the internals of React
  Flow.

### 15.3 End-to-end

- The Playwright tests are in `frontend/e2e/`. They run against the full Docker Compose stack: `web`, `worker`, `db`,
  and `mailpit`.
- The tests read the verification emails through the Mailpit API.
- The tests cover these flows:
  - sign up, and verify the email address
  - make and change a diagram, with autosave
  - a conflict between two tabs (412)
  - a share with a second user
  - a public link
  - restore a version
  - import SQL and export SQL

### 15.4 Spec tests and requirement IDs

- A spec test shows that the code obeys one requirement from §19.2.
- Backend file names are `test_spec_<area>.py`, for example `apps/diagrams/tests/test_spec_dgm.py`. Each test name
  starts with the ID, for example `test_dgm_002_old_change_number_gets_412`.
- Frontend file names are `<name>.spec.test.jsx`. Each `it` text starts with the ID, for example
  `it("EDT-002 shows the parse error at its line", ...)`.
- Each spec test has the ID in its docstring or its text, in the form `DGM-002`. Then `grep -r "DGM-002"` finds the
  test and the code that applies the requirement.

### 15.5 Test data

Do not put real personal data in tests or fixtures. Use addresses at `example.com`.

---

## 16. Build, deploy, and release

### 16.1 Local work

Procedure:

1. Start the services: `docker compose up -d db mailpit`.
2. Go to `backend/`. Run `uv sync`.
3. Run `uv run python manage.py migrate`.
4. Run `uv run python manage.py createcachetable`.
5. Run `uv run python manage.py runserver`. Django listens on port 8000.
6. In a second terminal, run `uv run python manage.py procrastinate worker`.
7. Go to `frontend/`. Run `npm ci`.
8. Run `npm run dev`. Vite listens on port 5173.
9. Open http://localhost:5173.

Vite sends `/api`, `/_allauth`, `/admin`, and `/static` to Django on port 8000 (`server.proxy` in `vite.config.js`).
For this reason, the browser sees one origin, as in production.

### 16.2 Docker image

The `Dockerfile` has two stages:

1. The `node:24` stage runs `npm ci` and `npm run build`. The output is `frontend/dist/`.
2. The `python:3.14-slim` stage installs uv and runs `uv sync --frozen --no-dev`. It copies `backend/` and
   `frontend/dist/`. Then it runs `collectstatic`.

The image runs as a non-root user. The default command starts gunicorn. The `worker` service uses the same image with
the command `python manage.py procrastinate worker`.

### 16.3 How Django serves the SPA

- Vite builds with `base: "/static/"`. WhiteNoise serves `/static/`. Files with a hash in the name get
  `Cache-Control: max-age=31536000, immutable`.
- `config/spa.py::spa_index` returns `index.html` with `Cache-Control: no-cache`. It does this for each path that does
  not start with `/api/`, `/_allauth/`, `/admin/`, `/static/`, `/healthz`, or `/readyz`.

### 16.4 Environment variables

| Variable | Function | Default |
|----------|----------|---------|
| `DJANGO_SETTINGS_MODULE` | `config.settings.prod` in production | None |
| `DJANGO_SECRET_KEY` | The Django secret key | None. Necessary. |
| `DATABASE_URL` | `postgres://user:password@host:5432/name` | None. Necessary. |
| `PUBLIC_BASE_URL` | The public origin, for example `https://dbml.example.com`. Django calculates `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` from it. URLs in emails use it. | None. Necessary. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | The SMTP server | `localhost`, `25`, empty, empty, `false` |
| `DEFAULT_FROM_EMAIL` | The sender address | `noreply@` and the host of `PUBLIC_BASE_URL` |
| `SIGNUP_ENABLED` | Open or close the sign-up (AUTH-006) | `true` |
| `WEB_CONCURRENCY` | The number of gunicorn workers | `2` |
| `LOG_LEVEL` | The log level | `INFO` |
| `APP_RELEASE` | The release string for `X-App-Release` (§11.5). The build sets it. | `dev` |

### 16.5 Deploy procedure

1. CI builds the image and pushes it to GHCR.
2. Run `python manage.py migrate --noinput` in a one-time container from the new image.
3. Run `python manage.py createcachetable` in the same way. If the table exists, this step has no effect.
4. Restart `worker` with the new image. Do this before `web`, because an old worker does not have the new jobs.
5. Restart `web` with the new image.
6. Make sure that `/readyz` returns 200.

To roll back, deploy the previous image tag. Do not reverse the migrations, because they are backward compatible
(§14.3).

### 16.6 CI

`.github/workflows/ci.yml` runs on each push and each pull request:

| Job | Steps |
|-----|-------|
| `backend` | A PostgreSQL 18 service. The backend gates in `AGENTS.md`. |
| `frontend` | The frontend gates in `AGENTS.md`. |
| `e2e` | Runs after `backend` and `frontend`. Starts the Docker Compose stack, then runs Playwright. |

### 16.7 Branches and releases

- Branch flow: `feat/*`, `fix/*`, or `chore/*`, then a pull request to `staging`, then a pull request to `main`.
- A merge to `staging` deploys the staging environment, if the operator configured one.
- A tag `vX.Y.Z` on `main` starts `release.yml`. It builds the image and pushes `ghcr.io/<owner>/dbml-maker:X.Y.Z`
  and `:latest`. It also makes a GitHub Release.
- Release numbers follow SemVer (`MAJOR.MINOR.PATCH`). If an operator must do an action for a release, increase the
  minor number. Write the action in the release notes.
- Write the release notes in ASD-STE100.

---

## 17. Future modules

These modules are not in v1. With the current design, you can add them without a change to the structure of the
current apps. For each module, this section gives the owner app, its dependencies, and how they communicate.

### 17.1 Real-time edit (collab)

- **Owner app:** `apps/collab` (new).
- **Depends on:** `diagrams`, `accounts`, and `core`.
- **Communication:** at connection, `collab` calls `diagrams.api.get_access`. While a room is open, `collab` is the
  only writer of the diagram. It calls a new function, `diagrams.api.save_content`, which uses the change number rule
  (§7.3).
- **Infrastructure:** Django Channels on an ASGI server for `/ws/`. The channel layer is behind
  `apps/collab/transport.py`. The SPA uses Yjs with the CodeMirror binding.
- **Change to current apps:** two new functions in `diagrams/api.py`. No change to the tables of `diagrams`.

### 17.2 Comments

- **Owner app:** `apps/comments` (new).
- **Depends on:** `diagrams` (access), `accounts` (names), and `comms` (email for a mention).
- **Communication:** `comments` calls `diagrams.api.get_access` for each request. A comment refers to a diagram ID. It
  can also refer to a table key. If that table does not exist now, the comment shows as "not attached".
- **Change to current apps:** none.

### 17.3 Team workspaces

- **Owner app:** `workspaces`.
- **Depends on:** `accounts`, and `comms` (invitations).
- **Communication:** `diagrams` already calls `workspaces.api.list_roles_for_user` and `get_role`. Team roles go
  through the same functions.
- **Change to current apps:** new endpoints and an invitation flow in `workspaces`, and a workspace switcher in the
  SPA. No change to the tables of `diagrams`.

### 17.4 API tokens and a CLI

- **Owner app:** `apps/tokens` (new).
- **Depends on:** `accounts` and `core`.
- **Communication:** a DRF authentication class reads `Authorization: Bearer <token>`. The database keeps only a hash
  of each token, because a token gives write access to the whole account.
- **Rule:** the SPA never uses tokens. Browser requests always use the session (§4.1).
- When clients outside this repository use the API, do not change `/api/v1` in a way that breaks them. Add `/api/v2`
  for such changes.

### 17.5 Server-side render and export

- **Owner app:** `apps/render` (new).
- **Use:** thumbnails, link previews, and SQL export through the API.
- **Infrastructure:** a Node service that runs `@dbml/core`. `apps/render/client.py` calls it over HTTP. The Python
  code still never parses DBML.

### 17.6 Social login and SSO

- **Owner app:** `accounts`.
- **Change:** add `allauth.socialaccount` and the providers (GitHub, Google, OpenID Connect). allauth headless has the
  provider redirect flow. No other app changes.

### 17.7 Embed

- **Owner app:** `diagrams`.
- **Change:** a read-only view at `/embed/<token>` for a public link. This view must have a different
  `frame-ancestors` policy and `X-Frame-Options`. All other paths keep `DENY`.

---

## 18. Known gaps, deviations, and sharp edges

### 18.1 Gaps

- There is no code yet. This document is the target design.
- v1 has no PDF export, no undo for the layout, no sticky notes, and no real-time edit. If two persons edit at the same
  time, one of them gets a conflict (§7.3).
- v1 has no team workspaces, no API tokens, and no server-side DBML validation.
- The UI is in English (ASD-STE100) only.

### 18.2 Deviations

Each of these is a decision, not an error.

| Deviation | Reason |
|-----------|--------|
| `style-src 'unsafe-inline'` in the CSP | CodeMirror and React Flow add style elements at run time. Remove the exception when both work with a nonce in this setup. |
| The allauth endpoints are outside `/api/v1/` | allauth sets the prefix `/_allauth/browser/v1/`. |
| The public link token is plain text, not a hash | The token protects content in the same database. A hash gives no more protection. With plain text, the owner can see the URL again. |
| Workspaces are in v1, with one personal workspace for each user | Team workspaces can come later with no change to the diagram tables. |
| No signals between apps, but Django `CASCADE` deletes rows in upper apps | The foreign keys point down the layers. The lower app does not import the upper app. |

### 18.3 Sharp edges

- **Layout keys are table names.** If a user renames a table in DBML, the table loses its position. It then gets an
  automatic position.
- **Shares go to an email address.** Access goes to the person who controls that address. If a user deletes the
  account, and a different person later signs up with the same address, that person gets the share.
- **Two tabs of one user also conflict.** This is correct, but a user can see it as a defect. The conflict banner
  tells the user what occurred.
- **`createcachetable` must run on each deploy.** Without the table, the rate limits fail with HTTP 500.
- **DRF examines CSRF only for logged-in users.** If you add an anonymous `POST`, `PUT`, `PATCH`, or `DELETE`
  endpoint, add `csrf_protect` to it.
- **The backend does not parse DBML.** A diagram can contain DBML with errors. The editor shows the errors.
- **A GET can write.** `list_roles_for_user` makes the personal workspace at the first call (§6.2).
- **Account delete loads all dependent rows in Python.** Django `CASCADE` collects the rows before it deletes them.
  For a user with very many versions, this can be slow.

---

## 19. Glossary and requirement IDs

### 19.1 Glossary

Use these terms in code, documents, and UI text. Do not use the words in the last column for the same thing.

| Term | Meaning | Do not use |
|------|---------|------------|
| diagram | The saved object: a name, a source, and a layout | project (a DBML keyword), document, file |
| source | The DBML text of a diagram | code, script, schema (for a diagram) |
| layout | The positions of the tables on the canvas. It is not part of DBML. | positions (in API names), coordinates |
| parse result | The tables, refs, enums, and groups that the parser finds in a source (§13.2) | model (a Django model), AST |
| table key | `<schema>.<table>`. The ID of a table in a layout and in a parse result. | table ID |
| canvas | The area of the editor that shows the diagram | board, graph |
| version | A saved copy of the source and the layout of a diagram. For software, write "release". | revision, snapshot, history entry |
| change number | The counter of a diagram that goes up by 1 on each save. It is the `ETag` value. | revision, lock version |
| share | A role on one diagram for one email address | invite, collaborator, permission |
| public link | A read-only URL with a secret token | share link, public share |
| workspace | The container of diagrams | team, organization, folder |
| personal workspace | The workspace of one user. Each user has one. | |
| member | A user with a role in a workspace | |
| role | `owner`, `editor`, or `viewer` on a diagram. `owner`, `admin`, `editor`, or `viewer` in a workspace. | permission level, access level |
| trash | The state of a diagram after a delete and before a permanent delete | archive, bin |
| owner app | The Django app that contains the models and the services of a feature | |
| public interface | The `api.py` module of an app | |
| service | A function in `services.py` that does one business workflow in one transaction | manager, handler |
| selector | A function in `selectors.py` that only reads | repository |
| job | A background task in `tasks.py` | task (except in Procrastinate code) |
| import (feature) | Make DBML source from a different format | upload |
| export (feature) | Make a different format from DBML source | download |
| release | A deployed state of the software, with a SemVer number | version |
| verify (an email address) | The technical verb of the email verification flow (§5.3). For all other uses, write "make sure" or "examine". | confirm, validate (for an email address) |
| STE | ASD-STE100 Simplified Technical English | |

### 19.2 Requirement IDs

The format is `<AREA>-<NNN>`. Do not use an ID again after you remove its requirement. Mark the row "Removed" and keep
it.

| Area | Meaning |
|------|---------|
| AUTH | Accounts and login |
| WSP | Workspaces |
| DGM | Diagrams |
| VER | Versions |
| SHR | Shares and public links |
| EDT | Editor and canvas |
| IMX | Import and export |
| SEC | Security |
| OPS | Operations |

| ID | Requirement | Owner |
|----|-------------|-------|
| AUTH-001 | A person can make an account with an email address and a password. | `accounts` |
| AUTH-002 | A user cannot log in before the user verifies the email address. | `accounts` |
| AUTH-003 | Sign-up and password reset give the same response for known and unknown email addresses. | `accounts` |
| AUTH-004 | A user can reset a password with a URL that the system sends by email. | `accounts` |
| AUTH-005 | A user can delete the account. The system then deletes the personal workspace and all its diagrams. | `accounts` |
| AUTH-006 | If `SIGNUP_ENABLED` is `false`, the system refuses each sign-up. | `accounts` |
| WSP-001 | Each user has exactly one personal workspace. The system makes it at the first use. | `workspaces` |
| DGM-001 | A user can make, open, rename, and duplicate a diagram. | `diagrams` |
| DGM-002 | A save must send the change number that the client read. If the number is old, the system refuses the save with HTTP 412. | `diagrams` |
| DGM-003 | The system keeps the source exactly as the client sent it. | `diagrams` |
| DGM-004 | A delete moves the diagram to the trash. The owner can restore it for 30 days. Then a job deletes it permanently. | `diagrams` |
| DGM-005 | The system refuses a source larger than 1 MiB, a layout larger than 256 KiB, and a name longer than 200 characters. | `diagrams` |
| VER-001 | An editor can make a named version. | `diagrams` |
| VER-002 | After a save, the system makes an automatic version if the newest version is older than 10 minutes and the content is different. | `diagrams` |
| VER-003 | A restore copies a version into the diagram and makes a `restore` version. A restore never deletes a version. | `diagrams` |
| VER-004 | A daily job deletes automatic versions older than 90 days. It keeps the newest version of each diagram. | `diagrams` |
| SHR-001 | An owner can share a diagram with an email address as `viewer` or `editor`. | `diagrams` |
| SHR-002 | An owner can turn on a public link. A public link gives `viewer` access only. | `diagrams` |
| SHR-003 | An owner can make a new token for a public link. The old URL then stops immediately. | `diagrams` |
| SHR-004 | An owner can turn off a public link. The old URL then gives 404. | `diagrams` |
| SHR-005 | The share API does not tell if an account exists for an email address. | `diagrams` |
| EDT-001 | The parser runs in a Web Worker. The parser never blocks the input in the code pane. | Frontend `editor` |
| EDT-002 | The code pane shows each parse error at the line and the column that the parser gives. | Frontend `editor` |
| EDT-003 | The editor saves the changes automatically 1 second after the last change. | Frontend `editor` |
| EDT-004 | A table without a position in the layout gets an automatic position. The other tables do not move. | Frontend `editor` |
| EDT-005 | The SPA shows all diagram text as plain text. It never renders HTML from a diagram. | Frontend |
| IMX-001 | A user can export the source as SQL for PostgreSQL, MySQL, SQL Server, and Oracle. | Frontend `import-export` |
| IMX-002 | A user can export the canvas as PNG and SVG. | Frontend `import-export` |
| IMX-003 | A user can import SQL from PostgreSQL, MySQL, and SQL Server. The import makes a new diagram. | Frontend `import-export` |
| IMX-004 | Import and export run in the browser. The source never goes to a third party. | Frontend `lib/dbml` |
| SEC-001 | Each `POST`, `PUT`, `PATCH`, and `DELETE` request must have a correct CSRF token. | `config` |
| SEC-002 | The system keeps passwords as Argon2 hashes. | `accounts` |
| SEC-003 | The session cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`. | `config` |
| SEC-004 | If a user has no access to a diagram, the API returns 404, not 403. | `diagrams` |
| SEC-005 | Rate limits apply to login, sign-up, password reset, shares, and public link reads. | `accounts`, `diagrams` |
| SEC-006 | Logs do not contain diagram source, passwords, tokens, or email addresses. | All apps |
| OPS-001 | `/healthz` returns 200 while the process runs. `/readyz` returns 200 only if the database answers. | `core` |
| OPS-002 | A failed job keeps the status `failed` and writes an `ERROR` log record. | `core` |
