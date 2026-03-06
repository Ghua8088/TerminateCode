from pytron import App
import os
import sys

# Add current directory to path for backend module imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.api.filesystem import register_filesystem_routes
from backend.api.terminal import register_terminal_routes
from backend.api.git import register_git_routes
from backend.api.utils import register_utils_routes
from backend.api.code_analysis import register_code_analysis_routes
from backend.api.ai import register_ai_routes
from backend.api.settings import register_settings_routes
from backend.api.system import register_system_routes
from backend.api.workspace import register_workspace_routes

def main():
    app = App()

    # Register all API routes
    register_filesystem_routes(app)
    register_terminal_routes(app)
    register_git_routes(app)
    register_utils_routes(app)
    register_code_analysis_routes(app)
    register_ai_routes(app)
    register_settings_routes(app)
    register_system_routes(app)
    register_workspace_routes(app)

    # Start the app
    app.run()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error starting app: {e}")
        import traceback
        traceback.print_exc()
