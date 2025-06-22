#!/usr/bin/env python
from dotenv import load_dotenv
load_dotenv()

import sys
import warnings
from datetime import datetime

from latest_ai_development.src.latest_ai_development.crew import WebsiteAnalyzerCrew

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

# Use this main file to run your full website analyzer crew
def run():
    """
    Run the Website Analyzer crew.
    """
    # Get URL from command-line argument, or use a default for testing
    url = sys.argv[1] if len(sys.argv) > 1 else "https://malkodent.com/"
    inputs = {
        'url': url,
        'current_year': str(datetime.now().year)
    }
    try:
        WebsiteAnalyzerCrew().crew().kickoff(inputs=inputs)
    except Exception as e:
        raise Exception(f"An error occurred while running the crew: {e}")

def train():
    """
    Train the crew for a given number of iterations.
    """
    url = sys.argv[2] if len(sys.argv) > 2 else "https://malkodent.com/"
    inputs = {
        "url": url,
        "current_year": str(datetime.now().year)
    }
    try:
        WebsiteAnalyzerCrew().crew().train(
            n_iterations=int(sys.argv[1]),
            filename=sys.argv[3] if len(sys.argv) > 3 else "train_output.md",
            inputs=inputs
        )
    except Exception as e:
        raise Exception(f"An error occurred while training the crew: {e}")

def replay():
    """
    Replay the crew execution from a specific task.
    """
    try:
        WebsiteAnalyzerCrew().crew().replay(task_id=sys.argv[1])
    except Exception as e:
        raise Exception(f"An error occurred while replaying the crew: {e}")

def test():
    """
    Test the crew execution and returns the results.
    """
    url = sys.argv[2] if len(sys.argv) > 2 else "https://malkodent.com/"
    inputs = {
        "url": url,
        "current_year": str(datetime.now().year)
    }
    try:
        WebsiteAnalyzerCrew().crew().test(
            n_iterations=int(sys.argv[1]),
            eval_llm=sys.argv[3] if len(sys.argv) > 3 else "gpt-4",
            inputs=inputs
        )
    except Exception as e:
        raise Exception(f"An error occurred while testing the crew: {e}")

if __name__ == "__main__":
    # For CLI usage, default to run()
    run()
