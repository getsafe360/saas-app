import os
import re
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from model_config import load_model_settings, resolve_model  # noqa: E402

CONFIG = ROOT / "config"


def load(name):
    return yaml.safe_load((CONFIG / name).read_text(encoding="utf-8"))


class TestModelResolution(unittest.TestCase):
    def test_env_pin_wins(self):
        with patch.dict(os.environ, {"CREW_MODEL": "anthropic/pinned-model"}, clear=True):
            self.assertEqual(resolve_model(), "anthropic/pinned-model")

    def test_falls_back_to_models_yaml(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(resolve_model(), load_model_settings()["provider_model"])

    def test_no_model_is_hard_coded_in_python(self):
        for path in [ROOT / "app.py", ROOT / "crew.py", CONFIG / "settings.py"]:
            source = path.read_text(encoding="utf-8")
            self.assertIsNone(re.search(r"claude-(opus|sonnet|haiku)-\d", source), f"model literal in {path.name}")


class TestCrewConfig(unittest.TestCase):
    def test_every_task_references_a_defined_agent(self):
        agents, tasks = load("agents.yaml"), load("tasks.yaml")
        for task_id, task in tasks.items():
            self.assertIn(task.get("agent"), agents, f"{task_id} -> {task.get('agent')}")

    def test_task_descriptions_format_with_url_only(self):
        for task_id, task in load("tasks.yaml").items():
            task["description"].format(url="https://example.com")

    def test_wordpress_tasks_forbid_unobservable_findings(self):
        tasks = load("tasks.yaml")
        for task_id in ("wordpress_audit", "wordpress_audit_task", "wordpress_snapshot"):
            self.assertIn("needs_connector", tasks[task_id]["description"], task_id)


if __name__ == "__main__":
    unittest.main()
