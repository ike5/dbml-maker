# DBML Maker

DBML Maker is an open source replacement for [dbdiagram.io](https://dbdiagram.io). A user writes DBML in a text editor
and sees the database diagram next to it. The user can save diagrams, share them, restore old versions, and import and
export them. This guide is for the operator who runs the system.

## Requirements

- Docker, to run the release image.
- PostgreSQL 18. It is the only data store.
- An SMTP server. The system sends verification, password reset, and share emails.
- A reverse proxy with TLS. The proxy must send the header `X-Forwarded-Proto`. Django uses this header to know that
  the request used HTTPS.

## Install

The release image is `ghcr.io/<owner>/dbml-maker:<X.Y.Z>`. The tag `latest` points to the newest release.

The system has three processes:

- `web`: Django under gunicorn. It serves the API, the SPA files, and the Django admin on port 8000.
- `worker`: a Procrastinate worker. It sends email and does the periodic jobs.
- `db`: PostgreSQL 18.

`web` and `worker` use the same image with a different command. The command of `worker` is
`python manage.py procrastinate worker`.

### Environment variables

Give the same variables to `web`, `worker`, and the one-time commands.

| Variable | Function | Default |
|----------|----------|---------|
| `DJANGO_SETTINGS_MODULE` | The image sets it to `config.settings.prod`. | `config.settings.prod` |
| `DJANGO_SECRET_KEY` | The Django secret key. Use a long random value. | None. Necessary. |
| `DATABASE_URL` | `postgres://user:password@host:5432/name` | None. Necessary. |
| `PUBLIC_BASE_URL` | The public origin, for example `https://dbml.example.com`. | None. Necessary. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | The SMTP server. | `localhost`, `25`, empty, empty, `false` |
| `DEFAULT_FROM_EMAIL` | The sender address. | `noreply@` and the host of `PUBLIC_BASE_URL` |
| `SIGNUP_ENABLED` | Open or close the sign-up. | `true` |
| `WEB_CONCURRENCY` | The number of gunicorn workers. | `2` |
| `LOG_LEVEL` | The log level. | `INFO` |
| `APP_RELEASE` | The release string. The image build sets it. Do not change it. | `dev` |

### First deploy

Do these steps in the given order:

1. Make a PostgreSQL 18 database and a user for it.
2. Set the environment variables.
3. Run `python manage.py migrate --noinput` in a one-time container from the image.
4. Run `python manage.py createcachetable` in a one-time container from the image.
5. Start `worker`.
6. Start `web`.
7. Make sure that `/readyz` returns 200.

### First staff user

Run this command in a one-time container from the image:

```sh
python manage.py createsuperuser
```

The staff user can sign in to the Django admin at `/admin/`. A staff user can read all diagrams.

## Configure

- **Closed sign-up.** To stop new sign-ups, set `SIGNUP_ENABLED=false`. Then only the existing users can sign in.
- **Email.** Set `EMAIL_HOST`, `EMAIL_PORT`, and, if the server needs them, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`,
  and `EMAIL_USE_TLS`. Set `DEFAULT_FROM_EMAIL` to an address that the SMTP server accepts.
- **`PUBLIC_BASE_URL`.** Set the exact origin that users type in the browser. Django calculates `ALLOWED_HOSTS` and
  `CSRF_TRUSTED_ORIGINS` from it. The links in emails use it. If it starts with `https://`, Django sets secure
  cookies, redirects HTTP to HTTPS, and sends HSTS.

## Upgrade

Do these steps for each release:

1. Pull the new image.
2. Run `python manage.py migrate --noinput` in a one-time container from the new image.
3. Run `python manage.py createcachetable` in the same way. If the table exists, this step has no effect.
4. Restart `worker` with the new image. Do this before `web`, because an old worker does not have the new jobs.
5. Restart `web` with the new image.
6. Make sure that `/readyz` returns 200.

Read the release notes before you upgrade. If the release needs an action from you, the notes tell it.

To roll back, deploy the previous image tag. Do not reverse the migrations. They are backward compatible.

## Backup

All data is in PostgreSQL. This includes the diagrams, the sessions, the cache, and the job queue. To make a backup,
use `pg_dump`:

```sh
pg_dump --format=custom --file=dbml-maker.dump "$DATABASE_URL"
```

To restore, use `pg_restore` on an empty database.

## Local work

- The commands for the backend and the frontend are in [`CLAUDE.md`](CLAUDE.md), section "Commands". The procedure is
  in [`DESIGN.md`](DESIGN.md), section 16.1.
- `docker compose up -d db mailpit` starts PostgreSQL and Mailpit only. The `db` service uses the host port 5433.
- `docker compose up -d` builds the image and starts the full stack at http://localhost:8000. Mailpit shows the sent
  emails at http://localhost:8025.
- To use a different host port for `web`, set `WEB_PORT`, for example `WEB_PORT=8090 docker compose up -d`.
