import os
import subprocess
from backend.services.terminal_service import terminal_manager
from backend.api.utils import get_subprocess_kwargs

def register_terminal_routes(app):

    @app.expose
    def run_command(command, cwd=None):
        """Run a shell command."""
        print(f"run_command called: {command}")
        try:
            if cwd is None:
                cwd = os.getcwd()

            # Run command and capture output
            process = subprocess.Popen(
                command,
                shell=True,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                **get_subprocess_kwargs(),
            )
            stdout, stderr = process.communicate()

            return {
                "success": True,
                "stdout": stdout,
                "stderr": stderr,
                "returncode": process.returncode,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def terminal_init(cwd=None, cols=80, rows=24, session_id="default"):
        """Initialize a specific terminal session."""
        try:
            session = terminal_manager.get_session(session_id)
            session.stop()
            
            def on_data_callback(data):
                if data:
                    # Emit with session_id to distinguish output
                    app.emit("terminal:output", {"data": data, "sessionId": session_id})
                    # Also keep the legacy emit for any simple listeners (optional)
                    # app.emit("terminal:output", data)

            session.start(cwd, cols=cols, rows=rows, on_data=on_data_callback)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def terminal_resize(cols, rows, session_id="default"):
        """Resize a specific terminal."""
        try:
            session = terminal_manager.get_session(session_id)
            session.resize(cols, rows)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def terminal_write(data="", session_id="default"):
        """Write to a specific terminal."""
        try:
            if data:
                session = terminal_manager.get_session(session_id)
                session.write(data)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def terminal_read(session_id="default"):
        """Read from a specific terminal."""
        try:
            session = terminal_manager.get_session(session_id)
            output = session.read()
            return {"success": True, "output": output}
        except Exception as e:
            return {"success": False, "error": str(e)}
            
    @app.expose
    def terminal_close(session_id="default"):
        """Close a specific terminal."""
        try:
            session = terminal_manager.get_session(session_id)
            session.stop()
            if session_id in terminal_manager.sessions:
                del terminal_manager.sessions[session_id]
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
