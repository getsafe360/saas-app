"""Crew loader and task executor for the CrewAI microservice."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict
from urllib.parse import urlparse

import yaml
from crewai import Agent, Crew, Process, Task


class CrewConfigurationError(RuntimeError):
    """Raised when crew YAML configuration is invalid."""


class CrewService:
    """Builds and executes a minimal CrewAI workflow for a selected endpoint task."""

    TASK_MAP = {
        "audit_wordpress": "wordpress_audit",
        "analyze_seo": "seo_analysis",
        "repair_accessibility": "accessibility_repair",
    }

    def __init__(self, base_dir: Path | None = None, model: str = "openai/gpt-4o-mini") -> None:
        self.base_dir = base_dir or Path(__file__).resolve().parent
        self.model = model
        self.agents_config = self._read_yaml("agents.yaml")
        self.tasks_config = self._read_yaml("tasks.yaml")
        self._validate()

    def _read_yaml(self, name: str) -> Dict[str, Any]:
        path = self.base_dir / name
        if not path.exists():
            raise CrewConfigurationError(f"Missing required YAML: {path}")
        with path.open("r", encoding="utf-8") as file:
            data = yaml.safe_load(file) or {}
        if not isinstance(data, dict):
            raise CrewConfigurationError(f"Invalid YAML format in {path}")
        return data

    def _validate(self) -> None:
        for _, task_id in self.TASK_MAP.items():
            if task_id not in self.tasks_config:
                raise CrewConfigurationError(f"Task '{task_id}' is missing from tasks.yaml")
            agent_id = self.tasks_config[task_id].get("agent")
            if not agent_id or agent_id not in self.agents_config:
                raise CrewConfigurationError(
                    f"Task '{task_id}' references unknown agent '{agent_id}'"
                )

    @staticmethod
    def _validate_url(url: str) -> str:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError(f"Invalid URL: {url}")
        return url

    def _build_task(self, task_key: str, url: str) -> Task:
        task_id = self.TASK_MAP[task_key]
        task_cfg = self.tasks_config[task_id]
        agent_cfg = self.agents_config[task_cfg["agent"]]

        agent = Agent(
            role=agent_cfg["role"],
            goal=agent_cfg["goal"],
            backstory=agent_cfg["backstory"],
            llm=self.model,
            allow_delegation=False,
            verbose=False,
            max_iter=1,
        )

        return Task(
            description=task_cfg["description"].format(url=url),
            expected_output=task_cfg["expected_output"],
            agent=agent,
        )

    def run_task(self, task_key: str, url: str) -> Dict[str, Any]:
        if task_key not in self.TASK_MAP:
            raise ValueError(f"Unsupported task key: {task_key}")

        normalized_url = self._validate_url(url)
        task = self._build_task(task_key, normalized_url)

        crew = Crew(agents=[task.agent], tasks=[task], process=Process.sequential, verbose=False)
        result = crew.kickoff(inputs={"url": normalized_url})

        if hasattr(result, "tasks_output") and result.tasks_output:
            output = str(result.tasks_output[0])
        else:
            output = str(result)

        return {
            "task": task_key,
            "url": normalized_url,
            "model": self.model,
            "result": output,
            "usage_metrics": getattr(crew, "usage_metrics", None),
        }
