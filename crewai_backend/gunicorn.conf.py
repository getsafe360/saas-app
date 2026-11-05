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

import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = 1
worker_class = "gthread"
threads = int(os.environ.get("GUNICORN_THREADS", "16"))
# SSE streams stay open for minutes; never kill a worker for a long request.
timeout = 0
graceful_timeout = 30
keepalive = 75
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("LOG_LEVEL", "info")
