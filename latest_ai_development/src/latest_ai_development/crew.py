# latest_ai_development/crew.py
from crewai import Agent, Task, Crew, Process
from datetime import datetime
from typing import List, Dict, Any

class WebsiteAnalyzerCrew:
    """
    Dynamically builds a Crew with only the agents/tasks selected by user.
    - Card-friendly JSON output
    - Timestamped report files
    - Tracks token usage (crew.usage_metrics)
    """

    def __init__(self):
        # --- Define your agent/task blueprints here ---
        self.agent_blueprints = {
            'seo': {
                "role": "SEO Specialist",
                "goal": "Audit and optimize website SEO.",
                "backstory": "Expert in SEO, on-page, off-page, technical SEO.",
            },
            'performance': {
                "role": "Performance Analyst",
                "goal": "Analyze website speed and Core Web Vitals.",
                "backstory": "Specialist in web performance and optimization.",
            },
            'security': {
                "role": "Security Analyst",
                "goal": "Scan for vulnerabilities and missing security headers.",
                "backstory": "Security pro who finds misconfigurations fast.",
            },
            'accessibility': {
                "role": "Accessibility Auditor",
                "goal": "Check site for WCAG & a11y compliance.",
                "backstory": "Experienced accessibility consultant.",
            },
            'content': {
                "role": "Content Specialist",
                "goal": "Analyze site content quality, grammar, keywords.",
                "backstory": "Copywriter and semantic web expert.",
            },
        }
        self.task_blueprints = {
            'seo': {
                "description": "Perform full SEO audit for {url}",
                "expected_output": "Card summary and actionable SEO issues.",
            },
            'performance': {
                "description": "Analyze performance and speed of {url}",
                "expected_output": "Performance metrics and recommendations.",
            },
            'security': {
                "description": "Check security for {url}",
                "expected_output": "List any vulnerabilities or weak points.",
            },
            'accessibility': {
                "description": "Audit {url} for accessibility (WCAG) issues.",
                "expected_output": "Accessibility compliance summary.",
            },
            'content': {
                "description": "Assess {url} for content quality and SEO relevance.",
                "expected_output": "Summary of content strengths/weaknesses.",
            },
        }

    def build_agents(self, selected: List[str]) -> Dict[str, Agent]:
        agents = {}
        for key in selected:
            ab = self.agent_blueprints[key]
            agents[key] = Agent(
                role=ab["role"],
                goal=ab["goal"],
                backstory=ab["backstory"],
                verbose=True
            )
        return agents

    def build_tasks(self, selected: List[str], url: str, agents: Dict[str, Agent]) -> Dict[str, Task]:
        tasks = {}
        for key in selected:
            tb = self.task_blueprints[key]
            tasks[key] = Task(
                description=tb["description"].format(url=url),
                expected_output=tb["expected_output"],
                agent=agents[key]
            )
        return tasks

    def build_reporting_task(self, url: str, selected: List[str], agents: Dict[str, Agent], output_file: str) -> Task:
        # Reporting agent can be a dummy or dedicated
        reporting_agent = Agent(
            role="Reporting Analyst",
            goal="Aggregate results and produce a full markdown report.",
            backstory="Expert in compiling actionable web audit reports.",
            verbose=True
        )
        return Task(
            description=(
                "Compile the outputs from all completed analysis modules into a clear report. "
                f"Include module-wise summaries for: {', '.join(selected)}. "
                f"Add URL: {url} and timestamp in the header."
            ),
            expected_output="A markdown report with sectioned summaries for each module.",
            agent=reporting_agent,
            output_file=output_file,
        )

    def analyze_website(self, selected: List[str], url: str) -> Dict[str, Any]:
        # --- Prepare agents & tasks dynamically ---
        agents = self.build_agents(selected)
        tasks = self.build_tasks(selected, url, agents)
        # Timestamped output file
        timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M")
        url_sanitized = url.replace("https://", "").replace("http://", "").replace("/", "_")
        report_file = f"report_{url_sanitized}_{timestamp}.md"
        # Add reporting as the final task (optional, can be unchecked)
        reporting_task = self.build_reporting_task(url, selected, agents, report_file)
        # Sequence: selected tasks + reporting
        task_list = [tasks[k] for k in selected] + [reporting_task]
        # --- Create and run crew ---
        crew = Crew(
            agents=[agents[k] for k in selected] + [reporting_task.agent],
            tasks=task_list,
            process=Process.sequential,
            verbose=True,
        )
        result = crew.kickoff(inputs={'url': url, 'selected_modules': selected})
        # --- Card-friendly output ---
        card_data = {
            "url": url,
            "selected_modules": selected,
            "results": {},
            "markdown_report_file": report_file,
            "usage_metrics": getattr(crew, 'usage_metrics', None)  # track token usage
        }
        # Populate each module result for UI cards
        if hasattr(result, "tasks_output"):
            for idx, key in enumerate(selected):
                try:
                    card_data["results"][key] = result.tasks_output[idx]
                except Exception:
                    card_data["results"][key] = f"No result from {key}."
            # Add reporting task result if any
            if len(result.tasks_output) > len(selected):
                card_data["results"]["report"] = result.tasks_output[-1]
        else:
            card_data["results"]["raw"] = str(result)
        return card_data
