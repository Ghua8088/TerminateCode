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
    def terminal_auto_heal(session_id="default"):
        """Use AI to analyze the most recent terminal output and offer a fix if there's an error."""
        try:
            session = terminal_manager.get_session(session_id)
            recent_output = session.get_recent_history(lines=100) # get chunk of history
            
            if not recent_output.strip():
                return {"success": False, "error": "No recent terminal output to analyze."}

            from backend.services.model_manager import get_model_instance
            from langchain_core.messages import HumanMessage

            prompt = f"""
You are an expert developer helping to debug a terminal error.
Analyze the following recent terminal output. If there is an error, exception, or failure, explain it briefly and provide a single terminal command or a brief explanation of how to fix it.
Format your output cleanly. If there is a specific command that will fix the problem (e.g. `npm install package_name` or `pip install XYZ`), put it in a bash codeblock.
If there is NO obvious error in the log, reply entirely with: "No errors detected."

--- TERMINAL OUTPUT ---
{recent_output[-4000:]} # Limit context slightly
--- END OUTPUT ---
"""
            model = get_model_instance("gemini-2.0-flash", temperature=0.2)
            response = model.invoke([HumanMessage(content=prompt)])
            
            content = response.content.strip()
            if "No errors detected" in content:
                 return {"success": False, "error": "No obvious errors detected in recent logs."}
                 
            return {"success": True, "analysis": content}
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
