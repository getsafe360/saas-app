"""Centralized runtime settings for the package and microservice layers."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict

from dotenv import load_dotenv

class ConfigError(RuntimeError):
    """Raised when mandatory runtime configuration is missing or invalid."""

load_dotenv()

@dataclass(frozen=True)
class Settings:
    anthropic_api_key: str
    crewai_api_key: str | None
    default_model: str
    app_env: str

    @classmethod
    def from_env(cls) -> "Settings":
        settings = cls(
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            crewai_api_key=os.getenv("CREWAI_API_KEY") or None,
            default_model=os.getenv("CREW_DEFAULT_MODEL", "anthropic/claude-opus-4-6"),
            app_env=os.getenv("APP_ENV", "development"),
        )
        settings.validate_required()
        return settings

    def validate_required(self) -> None:
        missing = []
        if not self.anthropic_api_key:
            missing.append("ANTHROPIC_API_KEY")
        if not self.crewai_api_key:
            missing.append("CREWAI_API_KEY")
        if missing:
            raise ConfigError("Missing required environment variables: " + ", ".join(missing))

    def as_public_dict(self) -> Dict[str, str]:
        return {
            "app_env": self.app_env,
            "default_model": self.default_model,
        }
