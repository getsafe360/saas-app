"""Compatibility shim for legacy crew_service imports."""

from latest_ai_development.crew import CrewConfigurationError, CrewService

__all__ = ["CrewConfigurationError", "CrewService"]
