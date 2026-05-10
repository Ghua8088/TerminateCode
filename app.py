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
from backend.api.architecture import register_architecture_routes
from backend.api.semantic import register_semantic_routes
from backend.api.cli_tools import register_cli_routes

def setup_log_capture(app):
    class LogCatcher:
        def __init__(self, stream, stream_name):
            self.stream = stream
            self.stream_name = stream_name

        def write(self, data):
            if self.stream is not None:
                self.stream.write(data)
            if data and isinstance(data, str):
                try:
                    color = '\x1b[36m' if self.stream_name == 'stdout' else '\x1b[31m'
                    app.dispatch('debug:log', {'data': f"{color}{data}\x1b[0m"})
                except Exception:
                    pass

        def flush(self):
            if self.stream is not None:
                self.stream.flush()

    if sys.stdout is not None:
        sys.stdout = LogCatcher(sys.stdout, 'stdout')
    if sys.stderr is not None:
        sys.stderr = LogCatcher(sys.stderr, 'stderr')

def main():
    app = App()
    setup_log_capture(app)

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
    register_architecture_routes(app)
    register_semantic_routes(app)
    register_cli_routes(app)

    # Start the app
    app.run()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error starting app: {e}")
        import traceback
        traceback.print_exc()
