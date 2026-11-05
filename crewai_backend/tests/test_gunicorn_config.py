import json
import logging
import runpy
import unittest
from pathlib import Path

CONFIG = runpy.run_path(str(Path(__file__).resolve().parents[1] / "gunicorn.conf.py"))


class TestGunicornConfig(unittest.TestCase):
    def test_single_worker_and_no_request_timeout(self):
        # In-memory job store and long SSE streams depend on these.
        self.assertEqual(CONFIG["workers"], 1)
        self.assertEqual(CONFIG["timeout"], 0)

    def test_gunicorn_logs_go_to_stdout(self):
        handler = CONFIG["logconfig_dict"]["handlers"]["stdout_json"]
        self.assertEqual(handler["stream"], "ext://sys.stdout")
        for name in ("gunicorn.error", "gunicorn.access"):
            self.assertEqual(CONFIG["logconfig_dict"]["loggers"][name]["handlers"], ["stdout_json"])

    def test_json_lines_carry_the_real_level(self):
        formatter = CONFIG["RailwayJsonFormatter"]()
        for level, expected in ((logging.INFO, "info"), (logging.ERROR, "error")):
            record = logging.LogRecord("gunicorn.error", level, __file__, 1, "Starting %s", ("gunicorn",), None)
            entry = json.loads(formatter.format(record))
            self.assertEqual(entry["level"], expected)
            self.assertEqual(entry["message"], "Starting gunicorn")


if __name__ == "__main__":
    unittest.main()
