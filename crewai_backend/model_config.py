"""Single source of truth for which LLM the crews use.

Precedence: CREW_MODEL env var (per-environment pin, e.g. on Railway)
→ config/models.yaml `default_model`. Nothing else hard-codes a model.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

import yaml

CONFIG_DIR = Path(__file__).resolve().parent / "config"
MODEL_ENV_VARS = ("CREW_MODEL", "CREW_DEFAULT_MODEL")


def load_model_settings(config_dir: Path = CONFIG_DIR) -> Dict[str, Any]:
    with (config_dir / "models.yaml").open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    name = data.get("default_model")
    models = data.get("models") or {}
    if name not in models or not models[name].get("provider_model"):
        raise ValueError(f"models.yaml: default_model '{name}' has no provider_model")
    return dict(models[name])


def resolve_model(config_dir: Path = CONFIG_DIR) -> str:
    for var in MODEL_ENV_VARS:
        value = (os.environ.get(var) or "").strip()
        if value:
            return value
    return str(load_model_settings(config_dir)["provider_model"])
