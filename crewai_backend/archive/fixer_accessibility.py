import os
from crewai import Agent, Task
from openai import OpenAI  # Or other LLM provider

# Utility: Read/write files only in a specific sandbox dir
SANDBOX_DIR = "/tmp/sandbox-accessibility"

def safe_file_list():
    return [os.path.join(dp, f) for dp, dn, filenames in os.walk(SANDBOX_DIR) for f in filenames]

def read_file(filepath):
    if not filepath.startswith(SANDBOX_DIR):
        raise ValueError("Unsafe file access")
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()

def write_file(filepath, content):
    if not filepath.startswith(SANDBOX_DIR):
        raise ValueError("Unsafe file access")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

# Accessibility fixer agent (using OpenAI GPT-4)
class AccessibilityRepairAgent(Agent):
    def run(self, issues):
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        report = []
        for issue in issues:
            filepath = os.path.join(SANDBOX_DIR, issue['file'])
            before = read_file(filepath)
            prompt = (
                f"The following file has an accessibility issue:\n"
                f"Issue: {issue['description']}\n"
                f"Location: {issue.get('line', 'unknown')}\n"
                f"File content:\n{before}\n\n"
                f"Fix the accessibility issue and reply with the fixed code only."
            )
            completion = client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=3000
            )
            after = completion.choices[0].message.content.strip()
            write_file(filepath, after)
            report.append({
                "file": issue['file'],
                "fixed": True,
                "before": before[:500],  # only log start for brevity
                "after": after[:500],
                "description": issue['description']
            })
        return report

# Example: how to call this agent
def fix_accessibility_issues(issues):
    agent = AccessibilityRepairAgent()
    return agent.run(issues)

# Example: issue list (from your analyzer)
"""
issues = [
    {"file": "index.html", "description": "Missing alt text on image", "line": 42},
    {"file": "about.html", "description": "Color contrast too low on buttons", "line": 85},
]
"""
# Call: fix_accessibility_issues(issues)