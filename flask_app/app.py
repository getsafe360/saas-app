import sys
import os
import json
import enum

# --- FIX IMPORT PATHS ---
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'latest_ai_development', 'src')))
from dotenv import load_dotenv
load_dotenv()
print("About to call LLM with model:", os.environ.get("MODEL"))
print("API Key loaded:", bool(os.environ.get("OPENAI_API_KEY")))

from flask import Flask, request, jsonify
from flask_cors import CORS
from latest_ai_development.crew import WebsiteAnalyzerCrew

app = Flask(__name__)
CORS(app)

def to_serializable(obj, _seen=None):
    if _seen is None:
        _seen = set()
    obj_id = id(obj)
    if obj_id in _seen:
        return "Circular Reference"
    _seen.add(obj_id)

    # Pydantic v2
    if hasattr(obj, "model_dump"):
        return {k: to_serializable(v, _seen) for k, v in obj.model_dump().items()}
    # Pydantic v1
    elif hasattr(obj, "dict"):
        return {k: to_serializable(v, _seen) for k, v in obj.dict().items()}
    # Python Enum
    elif isinstance(obj, enum.Enum):
        return obj.value
    # dict
    elif isinstance(obj, dict):
        return {k: to_serializable(v, _seen) for k, v in obj.items()}
    # list, tuple, set
    elif isinstance(obj, (list, tuple, set)):
        return [to_serializable(v, _seen) for v in obj]
    # Primitive
    elif isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    # Fallback: string
    return str(obj)

def run_agent(url, agents):
    inputs = {"url": url, "agents": agents}
    output = WebsiteAnalyzerCrew().analyze_website(agents, url)
    print("Crew Output (type={}):".format(type(output)), output)
    return to_serializable(output)

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    url = data.get("url")
    agents = data.get("agents", [])
    result = run_agent(url, agents)
    return jsonify(to_serializable(result))

if __name__ == "__main__":
    app.run(port=5555, debug=True)
