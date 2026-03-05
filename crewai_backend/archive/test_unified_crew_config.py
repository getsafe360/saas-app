from latest_ai_development.crew import CrewService, WebsiteAnalyzerCrew


def test_website_analyzer_loads_merged_yaml():
    crew = WebsiteAnalyzerCrew()

    assert "seo_audit_task" in crew.tasks_config
    assert "wordpress_audit_task" in crew.tasks_config
    assert "seo_analysis" in crew.tasks_config
    assert "wordpress_auditor" in crew.agents_config


def test_crew_service_task_map_uses_merged_config():
    service = CrewService(model="openai/gpt-4o-mini")

    assert service.TASK_MAP["analyze_seo"] == "seo_analysis"
    assert service.tasks_config["seo_analysis"]["agent"] == "seo_analyst"
