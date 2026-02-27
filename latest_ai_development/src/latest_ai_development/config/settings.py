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
    openai_api_key: str
    crewai_api_key: str
    default_model: str
    app_env: str

    @classmethod
    def from_env(cls) -> "Settings":
        settings = cls(
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            crewai_api_key=os.getenv("CREWAI_API_KEY", ""),
            default_model=os.getenv("CREW_DEFAULT_MODEL", "openai/gpt-4o-mini"),
            app_env=os.getenv("APP_ENV", "development"),
        )
        settings.validate_required()
        return settings

    def validate_required(self) -> None:
        missing = []
        if not self.openai_api_key:
            missing.append("OPENAI_API_KEY")
        if not self.crewai_api_key:
            missing.append("CREWAI_API_KEY")
        if missing:
            raise ConfigError("Missing required environment variables: " + ", ".join(missing))

    def as_public_dict(self) -> Dict[str, str]:
        return {
            "app_env": self.app_env,
            "default_model": self.default_model,
        }
