"""
This script runs the FlaskWebProject_GetSafe_360 application using a development server.
"""

from app import app

if __name__ == "__main__":
    app.run(host="localhost", port=5555, debug=True)