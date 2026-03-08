from __future__ import annotations
from datetime import datetime
from pathlib import Path
import json
import logging
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import yaml
from crewai import Agent, Crew, Process, Task

logger = logging.getLogger(__name__)

class ConfigurationError(Exception):
    """Raised when static crew configuration is invalid."""

class CrewConfigurationError(ConfigurationError):
    """Backward-compatible alias for service-specific configuration errors."""

class WebsiteAnalyzerCrew:
    """Production-oriented orchestration for website analysis modules."""

    CONFIG_DIR = Path(__file__).resolve().parent / "config"
    SUPPORTED_MODULES = ("seo", "performance", "accessibility", "security", "content", "wordpress", "sparky")
    MODULE_TASK_MAP = {
        "seo": "seo_audit_task",
        "performance": "performance_audit_task",
        "accessibility": "accessibility_audit_task",
        "security": "security_audit_task",
        "content": "content_audit_task",
        "wordpress": "wordpress_audit_task",
        "sparky": "site_snapshot_task",
    }

    def __init__(self) -> None:
        self.agents_config = self._read_yaml("agents.yaml")
        self.tasks_config = self._read_yaml("tasks.yaml")
        self.models_config = self._read_yaml("models.yaml")
        self.default_model_name = self.models_config.get("default_model", "gpt_5_mini")
        self.model_settings = self.models_config["models"][self.default_model_name]
        self._validate_configuration()

    def _read_yaml(self, filename: str) -> Dict[str, Any]:
        path = self.CONFIG_DIR / filename
        if not path.exists():
            raise ConfigurationError(f"Missing required config file: {path}")
        with path.open("r", encoding="utf-8") as handle:
            data = yaml.safe_load(handle) or {}
        if not isinstance(data, dict):
            raise ConfigurationError(f"Invalid YAML shape for {filename}; expected mapping")
        return data

    def _validate_configuration(self) -> None:
        missing_tasks = [task_id for task_id in self.MODULE_TASK_MAP.values() if task_id not in self.tasks_config]
        if missing_tasks:
            raise ConfigurationError(f"Missing module tasks: {missing_tasks}")

        for task_id in self.MODULE_TASK_MAP.values():
            task_cfg = self.tasks_config[task_id]
            agent_id = task_cfg.get("agent")
            if not agent_id or agent_id not in self.agents_config:
                raise ConfigurationError(f"Task '{task_id}' references unknown agent '{agent_id}'")

        provider_model = self.model_settings.get("provider_model")
        if provider_model != "openai/gpt-5-mini":
            raise ConfigurationError(
                "Production model drift detected: default model must resolve to openai/gpt-5-mini"
            )

    def _normalize_modules(self, selected: List[str]) -> List[str]:
        if not selected:
            raise ValueError("At least one module is required")

        unknown = [module for module in selected if module not in self.SUPPORTED_MODULES]
        if unknown:
            raise ValueError(f"Unsupported modules requested: {unknown}")

        deduped = []
        for module in selected:
            if module not in deduped:
                deduped.append(module)

        return [module for module in self.SUPPORTED_MODULES if module in deduped]

    def _sanitize_url(self, url: str) -> str:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError(f"Invalid URL: '{url}'")
        return url

    def build_agents(self, selected_modules: List[str]) -> Dict[str, Agent]:
        agents: Dict[str, Agent] = {}
        for module in selected_modules:
            task_id = self.MODULE_TASK_MAP[module]
            agent_id = self.tasks_config[task_id]["agent"]
            cfg = self.agents_config[agent_id]
            agents[module] = Agent(
                role=cfg["role"],
                goal=cfg["goal"],
                backstory=cfg["backstory"],
                llm=self.model_settings["provider_model"],
                verbose=False,
                allow_delegation=False,
                max_iter=self.model_settings.get("max_iter", 1),
            )
        return agents

    def build_tasks(self, selected_modules: List[str], url: str, agents: Dict[str, Agent]) -> List[Task]:
        tasks: List[Task] = []
        for module in selected_modules:
            task_cfg = self.tasks_config[self.MODULE_TASK_MAP[module]]
            tasks.append(
                Task(
                    description=task_cfg["description"].format(url=url),
                    expected_output=task_cfg["expected_output"],
                    agent=agents[module],
                )
            )
        return tasks

    def build_reporting_task(
        self,
        url: str,
        selected_modules: List[str],
        context_tasks: List[Task],
        output_file: str,
    ) -> Task:
        report_agent_cfg = self.agents_config["reporting_analyst"]
        reporting_agent = Agent(
            role=report_agent_cfg["role"],
            goal=report_agent_cfg["goal"],
            backstory=report_agent_cfg["backstory"],
            llm=self.model_settings["provider_model"],
            verbose=False,
            allow_delegation=False,
            max_iter=1,
        )
        return Task(
            description=(
                f"Synthesize module outputs for {url}. "
                f"Modules executed in deterministic order: {', '.join(selected_modules)}. "
                "Report must include prioritized repairs, blockers, and production deployment readiness verdict."
            ),
            expected_output="Structured markdown report for deployment decision-making.",
            agent=reporting_agent,
            context=context_tasks,
            output_file=output_file,
        )

    def analyze_website(self, selected: List[str], url: str) -> Dict[str, Any]:
        normalized_url = self._sanitize_url(url)
        selected_modules = self._normalize_modules(selected)

        agents = self.build_agents(selected_modules)
        module_tasks = self.build_tasks(selected_modules, normalized_url, agents)

        timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M")
        url_slug = normalized_url.replace("https://", "").replace("http://", "").replace("/", "_")
        report_file = f"report_{url_slug}_{timestamp}.md"

        reporting_task = self.build_reporting_task(
            normalized_url,
            selected_modules,
            module_tasks,
            report_file,
        )

        crew = Crew(
            agents=list(agents.values()) + [reporting_task.agent],
            tasks=module_tasks + [reporting_task],
            process=Process.sequential,
            verbose=False,
        )

        result = crew.kickoff(inputs={"url": normalized_url})

        module_results: Dict[str, Any] = {}
        if hasattr(result, "tasks_output"):
            for idx, module in enumerate(selected_modules):
                module_results[module] = str(result.tasks_output[idx]) if idx < len(result.tasks_output) else "No output"
            report_output = str(result.tasks_output[-1]) if result.tasks_output else str(result)
        else:
            report_output = str(result)

        return {
            "url": normalized_url,
            "selected_modules": selected_modules,
            "results": module_results,
            "report": report_output,
            "markdown_report_file": report_file,
            "usage_metrics": getattr(crew, "usage_metrics", None),
            "model": self.model_settings["provider_model"],
        }

class CrewService:
    """Builds and executes endpoint-focused CrewAI workflows for microservice routes."""

    TASK_MAP = {
        "audit_wordpress": "wordpress_audit",
        "wordpress_snapshot": "wordpress_snapshot",
        "analyze_seo": "seo_analysis",
        "site_snapshot": "site_snapshot",
        "site_snapshot_task": "site_snapshot_task",
        "generate_sparky_summary": "sparky_summary",
        "repair_accessibility": "accessibility_repair",
    }

    CONFIG_DIR = WebsiteAnalyzerCrew.CONFIG_DIR

    def __init__(self, model: str = "openai/gpt-4o-mini", config_dir: Optional[Path] = None) -> None:
        self.config_dir = config_dir or self.CONFIG_DIR
        self.model = model
        self.agents_config = self._read_yaml("agents.yaml")
        self.tasks_config = self._read_yaml("tasks.yaml")
        self._validate()

    def _read_yaml(self, name: str) -> Dict[str, Any]:
        path = self.config_dir / name
        if not path.exists():
            raise CrewConfigurationError(f"Missing required YAML: {path}")
        with path.open("r", encoding="utf-8") as file:
            data = yaml.safe_load(file) or {}
        if not isinstance(data, dict):
            raise CrewConfigurationError(f"Invalid YAML format in {path}")
        return data

    def _validate(self) -> None:
        # Only validate tasks that are actually referenced by the Sparky pipeline
        required_tasks = {
            "site_snapshot_task": "site_snapshot_task",
            "generate_sparky_summary": "sparky_summary",
        }

        for task_key, task_id in required_tasks.items():
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
    def site_snapshot_task(self, url: str) -> str:
        return str(self.run_task("site_snapshot_task", url).get("result", ""))

    def sparky_summary(self, snapshot_raw: str) -> str:
        task_id = self.TASK_MAP["generate_sparky_summary"]
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

        task = Task(
            description=f"{task_cfg['description']}\n\nInput snapshot:\n{snapshot_raw}",
            expected_output=task_cfg["expected_output"],
            agent=agent,
        )

        crew = Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False)
        result = crew.kickoff(inputs={})

        if hasattr(result, "tasks_output") and result.tasks_output:
            return str(result.tasks_output[0])
        return str(result)

    def run_full_audit(self, url: str) -> Dict[str, Any]:
        return WebsiteAnalyzerCrew().analyze_website(["seo", "performance", "accessibility", "security", "content", "wordpress"], url)

    def run_sparky_pipeline(self, url: str) -> Dict[str, Any]:
        """Fast homepage pipeline: snapshot → summary → normalized output."""
        logger.info(f"[SPARKY] Running fast pipeline for {url}")

        snapshot_raw = self.site_snapshot_task(url)
        logger.info(f"[SPARKY] Raw snapshot output:\n{snapshot_raw}")

        summary_raw = self.sparky_summary(snapshot_raw)
        logger.info(f"[SPARKY] Raw summary output:\n{summary_raw}")

        snapshot = self._extract_best_json(snapshot_raw)
        summary_json = self._extract_best_json(summary_raw)

        platform = snapshot.get("platform", "generic")
        categories = self._normalize_categories(snapshot.get("categories"))
        greeting = snapshot.get("greeting") or snapshot.get("title") or "Here's what we found"

        # Preserve plain-text summaries when JSON is not detected
        if summary_json:
            final_summary = summary_json.get("summary", "")
            final_short = summary_json.get("short_summary", final_summary)
        else:
            text = summary_raw.strip()
            final_summary = text
            final_short = text[:200] if text else ""

        final = {
            "platform": platform,
            "categories": categories,
            "greeting": greeting,
            "summary": final_summary,
            "short_summary": final_short,
        }

        logger.info(f"[SPARKY] Final normalized result: {final}")
        return final

    def _extract_best_json(self, text: str) -> Dict[str, Any]:
        """Extract fenced JSON or fallback to best-effort parse."""
        if not text:
            return {}

        fences = re.findall(r"```(?:json|JSON)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        candidates = fences if fences else [text]

        best: Dict[str, Any] = {}
        for block in candidates:
            try:
                obj = json.loads(block)
                if isinstance(obj, dict) and len(json.dumps(obj)) > len(json.dumps(best)):
                    best = obj
            except Exception:
                continue

        return best

    def _normalize_categories(self, cats: Any) -> List[str]:
        if not cats:
            return []
        if isinstance(cats, str):
            return [cats]
        if isinstance(cats, list):
            return [c for c in cats if isinstance(c, str)]
        return []

    @staticmethod
    def _parse_json_payload(raw_output: str) -> Dict[str, Any]:
        cleaned = raw_output.strip()
        fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, re.DOTALL)
        if fenced_match:
            cleaned = fenced_match.group(1).strip()

        try:
            payload = json.loads(cleaned)
            return payload if isinstance(payload, dict) else {}
        except json.JSONDecodeError:
            return {}


def create_wordpress_crew(model: str = "openai/gpt-5-mini") -> CrewService:
    """Factory for microservice-compatible WordPress task execution."""
    return CrewService(model=model)
