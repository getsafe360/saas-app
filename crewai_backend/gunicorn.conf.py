"""Gunicorn settings for Railway.

One worker on purpose: test jobs and their SSE subscribers live in process
memory (app.JOBS). Scale with threads now; add workers/replicas only after the
job store moves to Redis.

Railway service settings (dashboard, service `saas-app`; Config as Code is
deprecated, so they are not stored in a railway.json):
  Root directory   /crewai_backend
  Start command    gunicorn --config gunicorn.conf.py app:app
  Healthcheck      /api/health  (timeout 120 s)
  Restart policy   On failure, max 5 retries
  Watch paths      /crewai_backend/**
  Replicas         1  (until jobs move to Redis)
  Wait for CI      on  (.github/workflows/backend-tests.yml)
"""

import json
import logging
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = 1
worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", "16"))
# SSE streams stay open for minutes; never kill a worker for a long request.
timeout = 0
graceful_timeout = 30
keepalive = 75
loglevel = os.environ.get("LOG_LEVEL", "info")
accesslog = "-"
errorlog = "-"


class RailwayJsonFormatter(logging.Formatter):
    """One JSON object per line with a `level` field.

    Railway colours plain stderr lines as errors, and gunicorn writes all of
    its own logs (including INFO) to stderr. Railway reads `level` from JSON
    log lines, so INFO stays INFO and only real errors show as errors.
    """

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "level": record.levelname.lower(),
            "message": record.getMessage(),
            "logger": record.name,
        }
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


_STDOUT_JSON = {"class": "logging.StreamHandler", "formatter": "json", "stream": "ext://sys.stdout"}

logconfig_dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": RailwayJsonFormatter}},
    "handlers": {"stdout_json": _STDOUT_JSON},
    "root": {"level": loglevel.upper(), "handlers": ["stdout_json"]},
    "loggers": {
        "gunicorn.error": {"level": loglevel.upper(), "handlers": ["stdout_json"], "propagate": False},
        "gunicorn.access": {"level": "INFO", "handlers": ["stdout_json"], "propagate": False},
    },
}
