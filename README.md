# DBML Maker

DBML Maker is an open source replacement for [dbdiagram.io](https://dbdiagram.io). You write DBML in a text editor.
The application shows the database diagram next to the text.

With DBML Maker you can:

- write DBML and see the diagram change while you type,
- save diagrams in workspaces,
- share a diagram with other users, or make a public link,
- restore an old version of a diagram, and restore a diagram from the trash,
- import SQL (PostgreSQL, MySQL, SQL Server) and export SQL (PostgreSQL, MySQL, SQL Server, Oracle),
- export the diagram as a PNG or an SVG image.

This guide is for the person who runs DBML Maker. If you want to change the code, read
[`CONTRIBUTING.md`](CONTRIBUTING.md). DBML Maker uses the [MIT license](LICENSE).

Contents:

- [Try it on your computer](#try-it-on-your-computer)
- [Run it on a server](#run-it-on-a-server)
- [Configuration](#configuration)
- [Upgrade](#upgrade)
- [Backup and restore](#backup-and-restore)
- [Run the image with your own tools](#run-the-image-with-your-own-tools)
- [Troubleshooting](#troubleshooting)
- [Contribute and learn more](#contribute-and-learn-more)

## Try it on your computer

Use this path to see the application in a few minutes. Do not use it on a server.

You must have Docker with Compose V2.

1. Get the code:

   ```sh
   git clone https://github.com/ike5/dbml-maker.git
   cd dbml-maker
   ```

2. Build and start the whole stack with one command:

   ```sh
   docker compose up -d --build --wait
   ```

   The first build takes a few minutes. The command returns when all services are healthy.

3. Open http://localhost:8000. Sign up.
4. Open Mailpit at http://localhost:8025. Click the link in the email "Verify your email address".

The application sends a verification email to each new user. Mailpit catches the email. No real email leaves your
computer. After you click the link, you are logged in. If you open the link in a different browser, log in again.

| Address | Service |
|---------|---------|
| http://localhost:8000 | The application |
| http://localhost:8025 | Mailpit, the inbox for all emails of the stack |
| `localhost:5433` | PostgreSQL 18 (user `dbml`, password `dbml`, database `dbml`) |

Commands for the stack:

| Task | Command |
|------|---------|
| Stop the stack and keep the data | `docker compose down` |
| Stop the stack and delete all data | `docker compose down -v` |
| Use another port for the application | `WEB_PORT=8090 docker compose up -d` |
| Read the logs | `docker compose logs -f web worker` |

**Warning.** Do not put this stack on the internet. It has a fixed secret key and no TLS. To run DBML Maker on a
server, use the next section.

## Run it on a server

You must have:

- a Linux host with Docker and Compose V2,
- a domain name that points to the host,
- a reverse proxy with TLS. The example below uses Caddy,
- an SMTP account. Each new user must verify the email address. If the SMTP server does not work, nobody can log in.

Do these steps on the host:

1. Get the code:

   ```sh
   git clone https://github.com/ike5/dbml-maker.git
   cd dbml-maker
   ```

2. Make the `.env` file from the example:

   ```sh
   cp .env.example .env
   ```

   Open `.env`. Set `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, `PUBLIC_BASE_URL`, and `EMAIL_HOST`. Make each secret with
   `openssl rand -hex 32`. Set `EMAIL_PORT` and `EMAIL_USE_TLS` to the values of your SMTP server. If the server asks
   for a login, set `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD`. Each variable has a comment in the file. Keep the file
   private.

3. Start the stack:

   ```sh
   docker compose -f docker-compose.selfhost.yml up -d --build --wait
   ```

   The flag `--build` builds the image from the source. This takes a few
   minutes. To use a release image, remove `--build`. If the pull of the image fails, Compose builds the image.

4. Start the reverse proxy. The application listens on `127.0.0.1:8000` only. This Caddy file (`Caddyfile`) gives TLS
   and sends the requests to the application:

   ```
   dbml.example.com {
       reverse_proxy 127.0.0.1:8000
   }
   ```

   The proxy must send the header `X-Forwarded-Proto`. Caddy does this by itself. If you use nginx, add
   `proxy_set_header Host $host;` and `proxy_set_header X-Forwarded-Proto $scheme;`.

5. Make sure that the application is ready. The answer must be `{"status": "ok"}`:

   ```sh
   curl -f https://dbml.example.com/readyz
   ```

6. Make the first staff user (see the next section).

**Warning.** A `docker compose` command without `-f` acts on the trial file `docker-compose.yml`. That file has a fixed
secret key. Use `-f` each time, or run `export COMPOSE_FILE=docker-compose.selfhost.yml` in your shell. Then each
`docker compose` command uses the server file.

**A private network without TLS.** Set `PUBLIC_BASE_URL=http://<address>:8000` and `WEB_BIND=0.0.0.0` in `.env`. Use
this only on a trusted network. The passwords go over the network as plain text.

### First staff user

Run this command and answer the questions:

```sh
docker compose -f docker-compose.selfhost.yml exec web python manage.py createsuperuser
```

A staff user can log in to the Django admin at `/admin/` with no verification step. A staff user can read all diagrams.

To log in to the application, the staff user must verify the email address first:

1. Open the application. Log in with the email address and the password of the staff user.
2. The system sends a verification email and shows a message. Click the link in the email.
3. After the click, the staff user is logged in. If you open the link in a different browser, log in again there.
   Later logins have no verification step.

If you have no SMTP server yet, see [Troubleshooting](#troubleshooting).

### Commands for the server

| Task | Command |
|------|---------|
| Show the state of the services | `docker compose -f docker-compose.selfhost.yml ps` |
| Read the logs | `docker compose -f docker-compose.selfhost.yml logs -f web worker` |
| Stop the stack and keep the data | `docker compose -f docker-compose.selfhost.yml down` |
| Stop the stack and delete all data | `docker compose -f docker-compose.selfhost.yml down -v` |

## Configuration

Put each value in the `.env` file. The file `.env.example` shows all variables.

| Variable | Function | Default |
|----------|----------|---------|
| `DJANGO_SECRET_KEY` | The Django secret key. Use a long random value. If you change it, all users must log in again. | None. Necessary. |
| `POSTGRES_PASSWORD` | Compose only. The password of the database user. Use hex characters only. | None. Necessary. |
| `PUBLIC_BASE_URL` | The public origin, for example `https://dbml.example.com`. | None. Necessary. |
| `EMAIL_HOST` | The host name of the SMTP server. | None. Necessary. |
| `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | The other values of the SMTP server. `.env.example` sets `587` and `true`. | `25`, empty, empty, `false` |
| `DEFAULT_FROM_EMAIL` | The sender address. | `noreply@` and the host of `PUBLIC_BASE_URL` |
| `SIGNUP_ENABLED` | Open or close the sign-up. | `true` |
| `WEB_BIND` | Compose only. The address that the web port listens on. | `127.0.0.1` |
| `WEB_PORT` | Compose only. The host port of the application. | `8000` |
| `WEB_CONCURRENCY` | The number of gunicorn workers. | `2` |
| `LOG_LEVEL` | The log level. | `INFO` |
| `DBML_MAKER_VERSION` | Compose only. The release number in the name of the image, for example `1.0.0`. With `--build`, it only names the image that Compose builds. | `latest` |

The image sets `DJANGO_SETTINGS_MODULE`. The file `docker-compose.selfhost.yml` sets `DATABASE_URL` and `APP_RELEASE`
for you.

- **Closed sign-up.** To stop new sign-ups, set `SIGNUP_ENABLED=false`. Then only users that have an account can log
  in. A staff user makes new accounts in the Django admin. Each new user must verify the email address at the first
  login.
- **Email.** Set the values that your SMTP provider gives. `.env.example` sets the port `587` and `EMAIL_USE_TLS=true`.
  These values use STARTTLS. The application cannot use implicit TLS (port 465). If the server asks for a login, set
  `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD`. Set `DEFAULT_FROM_EMAIL` to an address that the SMTP server accepts.
- **`PUBLIC_BASE_URL`.** Set the exact origin that users type in the browser. Django calculates `ALLOWED_HOSTS` and
  `CSRF_TRUSTED_ORIGINS` from it. The links in emails use it. If it starts with `https://`, Django sets secure cookies,
  redirects HTTP to HTTPS, and sends HSTS.

## Upgrade

1. Read the release notes. If you must do an action for a release, the release notes give the steps.
2. Make a [backup](#backup-and-restore).
3. Get the new code. Then start the stack again:

   ```sh
   git pull
   docker compose -f docker-compose.selfhost.yml up -d --build --wait
   ```

4. Make sure that `/readyz` returns 200.

The `migrate` service applies the migrations before `web` and `worker` start.

To roll back, get the previous release tag with `git checkout`. Then run the same `docker compose` command again.
Do not reverse the migrations. They are backward compatible.

## Backup and restore

All data is in PostgreSQL. This includes the diagrams, the sessions, the cache, and the job queue.

To make a backup, run this command. It writes the file `dbml-maker.dump`:

```sh
docker compose -f docker-compose.selfhost.yml exec -T db pg_dump -U dbml -Fc dbml > dbml-maker.dump
```

The file holds the password hashes and all diagrams. Keep it private.

To restore the backup, replace the database. First, make sure that the backup file is good. The command returns 0 for a
good file:

```sh
docker compose -f docker-compose.selfhost.yml exec -T db pg_restore --list < dbml-maker.dump > /dev/null
```

**Warning.** The next commands delete all data in the database. Do not run them before the command above returns 0.

```sh
docker compose -f docker-compose.selfhost.yml stop web worker
docker compose -f docker-compose.selfhost.yml exec -T db dropdb -U dbml dbml
docker compose -f docker-compose.selfhost.yml exec -T db createdb -U dbml dbml
docker compose -f docker-compose.selfhost.yml exec -T db pg_restore -U dbml -d dbml --no-owner < dbml-maker.dump
docker compose -f docker-compose.selfhost.yml start web worker
```

If you run PostgreSQL yourself, use `pg_dump --format=custom --file=dbml-maker.dump "$DATABASE_URL"` for the backup.
For the restore, use `pg_restore` on an empty database.

## Run the image with your own tools

If you do not use `docker-compose.selfhost.yml`, use this section. For example, you can run the image on Kubernetes.

The release image is `ghcr.io/ike5/dbml-maker:<X.Y.Z>`. The tag `latest` points to the newest release.

The system has three processes:

- `web`: Django under gunicorn. It serves the API, the SPA files, and the Django admin on port 8000.
- `worker`: a Procrastinate worker. It sends email and does the periodic jobs.
- `db`: PostgreSQL 18. It is the only data store.

`web` and `worker` use the same image with a different command. The command of `worker` is
`python manage.py procrastinate worker`. Give the same variables to `web`, `worker`, and the one-time commands. The
variables are in the table in [Configuration](#configuration). Four rows are for Compose only. The application does not
read them. Also set `DATABASE_URL` (for example `postgres://user:password@host:5432/name`). The image sets
`DJANGO_SETTINGS_MODULE` to `config.settings.prod`.

To deploy for the first time, do these steps in the given order:

1. Make a PostgreSQL 18 database and a user for it.
2. Set the environment variables.
3. Run `python manage.py migrate --noinput` in a one-time container from the image.
4. Run `python manage.py createcachetable` in a one-time container from the image.
5. Start `worker`.
6. Start `web`.
7. Make sure that `/readyz` returns 200.

The probe for `/readyz` must send the header `Host` with the host of `PUBLIC_BASE_URL`. If `PUBLIC_BASE_URL` starts with
`https://`, the probe must also send `X-Forwarded-Proto: https`. Without these headers, Django answers 400 or 301.


To upgrade, do steps 3 and 4 again with the new image. Then restart `worker` before `web`, because an old worker
does not have the new jobs. Make sure that `/readyz` returns 200. The next release can have other steps. Read the
release notes.

## Troubleshooting

| Symptom | Cause | Action |
|---------|-------|--------|
| Compose stops and says "Set ... in the .env file" | A necessary value in `.env` is empty. | Set the value in `.env`. Run the command again. |
| Compose says that a port is already allocated | Another program uses the host port. | Run `docker compose down`. Set another port: `WEB_PORT` (application), `DB_PORT` (PostgreSQL), `MAILPIT_WEB_PORT` or `MAILPIT_SMTP_PORT` (Mailpit). Start the stack again. |
| `up --wait` fails | A service is not healthy. | Read the logs: `docker compose logs migrate web worker`. On a server, add `-f docker-compose.selfhost.yml`. |
| No verification email arrives (trial stack) | The trial stack sends all email to Mailpit. | Open Mailpit at http://localhost:8025. |
| No verification email arrives (server) | The SMTP values are wrong, or `worker` does not run. | Read `docker compose -f docker-compose.selfhost.yml logs worker`. Look for a line with the text `to retry`. The field `traceback` gives the cause. Make sure that the `EMAIL_*` values are correct. |
| The browser shows HTTP 400 or a CSRF error | `PUBLIC_BASE_URL` is not the address in the browser. | Set `PUBLIC_BASE_URL` to the exact origin. Start the stack again. |
| The browser shows "too many redirects" | `PUBLIC_BASE_URL` starts with `https://`, but the proxy does not send `X-Forwarded-Proto`. | Make the proxy send the header. |
| The staff user cannot log in to the application and you have no SMTP server | The email address of the staff user is not verified. | Mark the address as verified. See the command below. |

To mark the email address of a user as verified without an email, run this command. Use this command only for a staff
user that you trust. It skips the email verification. Replace `you@example.com` with the address of the user:

```sh
docker compose -f docker-compose.selfhost.yml exec web python manage.py shell -c "
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
user = get_user_model().objects.get(email='you@example.com')
EmailAddress.objects.update_or_create(user=user, email=user.email, defaults={'verified': True, 'primary': True})
"
```

## Contribute and learn more

| Goal | Go to |
|------|-------|
| Set up the project, change the code, and send a change | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Read the overview of the architecture and the text rules | [`AGENTS.md`](AGENTS.md) |
| Read the full architecture reference | [`DESIGN.md`](DESIGN.md) |
| Read the license | [`LICENSE`](LICENSE) |

All text in this repository uses ASD-STE100 Simplified Technical English. The rules are in `AGENTS.md`.
