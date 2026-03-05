import os
import enum
from flask import Flask, request, jsonify # Import "flask" could not be resolved Pylance reportMissingImports
from flask_cors import CORS  # Import "flask_cors" could not be resolved Pylance reportMissingImports
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import CrewAI logic (now inside the same folder)
from crew import WebsiteAnalyzerCrew

app = Flask(__name__)
CORS(app)

def to_serializable(obj, _seen=None):
    if _seen is None:
        _seen = set()
    obj_id = id(obj)
    if obj_id in _seen:
        return "Circular Reference"
    _seen.add(obj_id)

    if hasattr(obj, "model_dump"):
        return {k: to_serializable(v, _seen) for k, v in obj.model_dump().items()}
    elif hasattr(obj, "dict"):
        return {k: to_serializable(v, _seen) for k, v in obj.dict().items()}
    elif isinstance(obj, enum.Enum):
        return obj.value
    elif isinstance(obj, dict):
        return {k: to_serializable(v, _seen) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set)):
        return [to_serializable(v, _seen) for v in obj]
    elif isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    return str(obj)

def run_agent(url, agents):
    output = WebsiteAnalyzerCrew().analyze_website(agents, url)
    return to_serializable(output)

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    url = data.get("url")
    agents = data.get("agents", [])
    result = run_agent(url, agents)
    return jsonify(result)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
