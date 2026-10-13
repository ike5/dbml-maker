# Stage 1: build the frontend files (DESIGN.md section 16.2).
FROM node:24-slim AS frontend
WORKDIR /build/frontend
# Copy the package files first. Then Docker keeps the layer of "npm ci" when only the source changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Vite reads APP_RELEASE at build time (DESIGN.md section 11.5).
ARG APP_RELEASE=dev
ENV APP_RELEASE=${APP_RELEASE}
RUN npm run build

# Stage 2: the Python image for web and worker.
FROM python:3.14-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.30 /uv /usr/local/bin/uv

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    WEB_CONCURRENCY=2

WORKDIR /app/backend
# Install the dependencies first for the layer cache. The backend is not a package.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# The settings find "frontend/dist" next to "backend/".
COPY backend/ ./
COPY --from=frontend /build/frontend/dist /app/frontend/dist

# The values are for the build only. The image has no secret (DESIGN.md section 4.8).
RUN DJANGO_SECRET_KEY=build-only \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    PUBLIC_BASE_URL=http://localhost:8000 \
    python manage.py collectstatic --noinput

ARG APP_RELEASE=dev
ENV APP_RELEASE=${APP_RELEASE}

RUN useradd --system --uid 10001 --no-create-home app
USER app

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--access-logfile", "-"]
