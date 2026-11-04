import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from flask import Flask, jsonify

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from security import init_security, validate_public_url  # noqa: E402

SECRET = "test-secret-value"


def make_app(env: dict[str, str]) -> Flask:
    with patch.dict(os.environ, env, clear=True):
        app = Flask(__name__)
        init_security(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.post("/api/test/start")
    def start():
        return jsonify({"status": "started"})

    return app


class TestApiKeyGate(unittest.TestCase):
    def test_health_is_public(self):
        client = make_app({"CREW_SERVICE_API_KEY": SECRET}).test_client()
        with patch.dict(os.environ, {"CREW_SERVICE_API_KEY": SECRET}, clear=True):
            self.assertEqual(client.get("/api/health").status_code, 200)

    def test_rejects_missing_and_wrong_key(self):
        client = make_app({}).test_client()
        with patch.dict(os.environ, {"CREW_SERVICE_API_KEY": SECRET}, clear=True):
            self.assertEqual(client.post("/api/test/start").status_code, 401)
            wrong = client.post("/api/test/start", headers={"Authorization": "Bearer nope"})
            self.assertEqual(wrong.status_code, 401)

    def test_accepts_bearer_and_x_api_key(self):
        client = make_app({}).test_client()
        with patch.dict(os.environ, {"CREW_SERVICE_API_KEY": SECRET}, clear=True):
            bearer = client.post("/api/test/start", headers={"Authorization": f"Bearer {SECRET}"})
            header = client.post("/api/test/start", headers={"X-API-Key": SECRET})
        self.assertEqual(bearer.status_code, 200)
        self.assertEqual(header.status_code, 200)

    def test_production_without_secret_fails_closed(self):
        client = make_app({}).test_client()
        with patch.dict(os.environ, {"RAILWAY_ENVIRONMENT_NAME": "production"}, clear=True):
            self.assertEqual(client.post("/api/test/start").status_code, 503)

    def test_development_without_secret_is_open(self):
        client = make_app({}).test_client()
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(client.post("/api/test/start").status_code, 200)

    def test_no_cors_headers_without_allowlist(self):
        client = make_app({}).test_client()
        with patch.dict(os.environ, {}, clear=True):
            response = client.get("/api/health", headers={"Origin": "https://evil.example"})
        self.assertNotIn("Access-Control-Allow-Origin", response.headers)

    def test_cors_only_for_allowlisted_origin(self):
        client = make_app({"ALLOWED_ORIGINS": "https://www.getsafe360.ai"}).test_client()
        with patch.dict(os.environ, {}, clear=True):
            ok = client.get("/api/health", headers={"Origin": "https://www.getsafe360.ai"})
            bad = client.get("/api/health", headers={"Origin": "https://evil.example"})
        self.assertEqual(ok.headers.get("Access-Control-Allow-Origin"), "https://www.getsafe360.ai")
        self.assertNotIn("Access-Control-Allow-Origin", bad.headers)


class TestPublicUrlValidation(unittest.TestCase):
    def public(self, _host):
        return ["93.184.215.14"]

    def test_accepts_public_host(self):
        self.assertEqual(validate_public_url("https://example.com/a", resolver=self.public), "https://example.com/a")

    def test_rejects_bad_scheme_and_credentials(self):
        for url in ("ftp://example.com", "javascript:alert(1)", "https://user:pw@example.com"):
            with self.assertRaises(ValueError):
                validate_public_url(url, resolver=self.public)

    def test_rejects_internal_hosts(self):
        for url in (
            "http://localhost:8000",
            "http://127.0.0.1",
            "http://10.0.0.5",
            "http://169.254.169.254/latest/meta-data",
            "http://[::1]/",
            "http://saas-app.railway.internal",
        ):
            with self.assertRaises(ValueError, msg=url):
                validate_public_url(url, resolver=self.public)

    def test_rejects_public_name_resolving_to_private_ip(self):
        with self.assertRaises(ValueError):
            validate_public_url("https://rebind.example", resolver=lambda _h: ["10.1.2.3"])

    def test_rejects_unresolvable_host(self):
        def fail(_host):
            raise OSError("nxdomain")

        with self.assertRaises(ValueError):
            validate_public_url("https://does-not-exist.example", resolver=fail)


if __name__ == "__main__":
    unittest.main()
