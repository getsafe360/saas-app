#!/usr/bin/env python
import json
import sys
from datetime import datetime

from dotenv import load_dotenv

from latest_ai_development.crew import WebsiteAnalyzerCrew

load_dotenv()


def run() -> None:
    """Run deterministic website analysis across requested modules."""
    url = sys.argv[1] if len(sys.argv) > 1 else "https://malkodent.com/"
    modules_arg = sys.argv[2] if len(sys.argv) > 2 else "seo,performance,accessibility,security,content,wordpress"
    selected_modules = [module.strip() for module in modules_arg.split(",") if module.strip()]

    payload = {
        "url": url,
        "selected_modules": selected_modules,
        "current_year": str(datetime.now().year),
    }

    try:
        result = WebsiteAnalyzerCrew().analyze_website(
            selected=payload["selected_modules"],
            url=payload["url"],
        )
        print(json.dumps(result, indent=2, default=str))
    except Exception as exc:
        raise RuntimeError(f"An error occurred while running the crew: {exc}") from exc


def train() -> None:
    raise NotImplementedError("Training workflow is disabled in production runtime.")


def replay() -> None:
    raise NotImplementedError("Replay workflow is disabled in production runtime.")


def test() -> None:
    raise NotImplementedError("Interactive crew testing is disabled in production runtime.")


if __name__ == "__main__":
    run()
