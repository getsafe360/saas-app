"""Runtime settings and validation for the CrewAI Vercel API gateway."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict
from urllib.parse import urlparse

from latest_ai_development.config.settings import ConfigError


@dataclass(frozen=True)
class GatewaySettings:
    openai_api_key: str
    crewai_api_key: str
    wordpress_site_url: str
    next_public_api_url: str
    default_model: str
    app_env: str

    @classmethod
    def from_env(cls) -> "GatewaySettings":
        settings = cls(
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            crewai_api_key=os.getenv("CREWAI_API_KEY", ""),
            wordpress_site_url=os.getenv("WORDPRESS_SITE_URL", ""),
            next_public_api_url=os.getenv("NEXT_PUBLIC_API_URL", ""),
            default_model=os.getenv("CREW_DEFAULT_MODEL", "openai/gpt-4o-mini"),
            app_env=os.getenv("APP_ENV", "production"),
        )
        settings.validate_required()
        return settings

    @staticmethod
    def _validate_url(name: str, value: str) -> None:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ConfigError(f"Invalid URL in {name}: {value}")

    def validate_required(self) -> None:
        missing = []
        if not self.openai_api_key:
            missing.append("OPENAI_API_KEY")
        if not self.crewai_api_key:
            missing.append("CREWAI_API_KEY")
        if not self.wordpress_site_url:
            missing.append("WORDPRESS_SITE_URL")
        if not self.next_public_api_url:
            missing.append("NEXT_PUBLIC_API_URL")

        if missing:
            raise ConfigError("Missing required environment variables: " + ", ".join(missing))

        self._validate_url("WORDPRESS_SITE_URL", self.wordpress_site_url)
        self._validate_url("NEXT_PUBLIC_API_URL", self.next_public_api_url)

    def as_public_dict(self) -> Dict[str, str]:
        return {
            "app_env": self.app_env,
            "default_model": self.default_model,
            "wordpress_site_url": self.wordpress_site_url,
            "next_public_api_url": self.next_public_api_url,
        }


__all__ = ["ConfigError", "GatewaySettings"]
