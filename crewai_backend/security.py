"""Request hardening for the Flask gateway.

The gateway is only ever called server-to-server by the Next.js app (Vercel),
so every route except the health check requires the shared secret, browsers get
no CORS access unless an origin is explicitly allow-listed, and target URLs are
restricted to public hosts so the crews cannot be pointed at internal services.
"""

from __future__ import annotations

import hmac
import ipaddress
import os
import socket
from typing import Callable, Iterable
from urllib.parse import urlparse

from flask import Flask, jsonify, request

PUBLIC_PATHS = frozenset({"/api/health"})
API_KEY_ENV = "CREW_SERVICE_API_KEY"
BLOCKED_HOST_SUFFIXES = (".internal", ".local", ".localhost", ".lan", ".home.arpa")


def app_environment() -> str:
    """Railway sets RAILWAY_ENVIRONMENT_NAME; APP_ENV is the manual override."""
    return (os.environ.get("APP_ENV") or os.environ.get("RAILWAY_ENVIRONMENT_NAME") or "development").strip().lower()


def is_production() -> bool:
    return app_environment() == "production"


def _configured_api_key() -> str:
    return (os.environ.get(API_KEY_ENV) or "").strip()


def _presented_api_key() -> str:
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return (request.headers.get("X-API-Key") or "").strip()


def allowed_origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


def init_security(app: Flask) -> None:
    origins = allowed_origins()
    if origins:
        from flask_cors import CORS

        CORS(app, origins=origins, allow_headers=["Authorization", "Content-Type", "X-API-Key"])

    @app.before_request
    def _require_api_key():
        if request.method == "OPTIONS" or request.path in PUBLIC_PATHS:
            return None

        expected = _configured_api_key()
        if not expected:
            if is_production():
                # Fail closed: a production gateway without a secret must not run crews.
                return jsonify({"error": f"Gateway not configured → set {API_KEY_ENV}"}), 503
            return None

        presented = _presented_api_key()
        if not presented or not hmac.compare_digest(presented.encode(), expected.encode()):
            return jsonify({"error": "Unauthorized"}), 401
        return None


Resolver = Callable[[str], Iterable[str]]


def _resolve(host: str) -> list[str]:
    infos = socket.getaddrinfo(host, None)
    return sorted({info[4][0] for info in infos})


def _is_public_ip(value: str) -> bool:
    ip = ipaddress.ip_address(value)
    return ip.is_global and not ip.is_multicast


def validate_public_url(url: str, resolver: Resolver | None = None) -> str:
    """Return the URL if it targets a public http(s) host, else raise ValueError."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("url must be a valid http/https URL")
    if parsed.username or parsed.password:
        raise ValueError("url must not contain credentials")

    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith(BLOCKED_HOST_SUFFIXES):
        raise ValueError("url must point to a public website")

    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None

    if literal is not None:
        addresses = [str(literal)]
    else:
        try:
            addresses = list((resolver or _resolve)(host))
        except OSError as exc:
            raise ValueError("could not resolve the website's domain") from exc
        if not addresses:
            raise ValueError("could not resolve the website's domain")

    if not all(_is_public_ip(address) for address in addresses):
        raise ValueError("url must point to a public website")
    return url
