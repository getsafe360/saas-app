import unittest
from unittest.mock import patch

from test_sse_contract import load_app_module


class TestLegacyAnalyze(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app_module = load_app_module()
        cls.client = cls.app_module.app.test_client()

    def test_rejects_private_targets_before_running_crews(self):
        with patch.object(self.app_module.CREW, "run_full_audit", create=True) as run:
            response = self.client.post("/analyze", json={"url": "http://169.254.169.254/latest/meta-data"})
        self.assertEqual(response.status_code, 400)
        run.assert_not_called()

    def test_accepts_site_url_field_from_agents_service(self):
        with patch("security._resolve", return_value=["93.184.215.14"]), patch.object(
            self.app_module.CREW, "run_full_audit", create=True, return_value={"ok": True}
        ) as run:
            response = self.client.post("/analyze", json={"siteUrl": "https://example.com", "categories": ["seo"]})
        self.assertEqual(response.status_code, 200)
        run.assert_called_once_with("https://example.com")


if __name__ == "__main__":
    unittest.main()
