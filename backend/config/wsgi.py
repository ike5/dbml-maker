"""WSGI entry point. Gunicorn uses it."""

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
