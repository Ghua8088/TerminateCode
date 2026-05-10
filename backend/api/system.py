import os
import threading
import socket
import sys
import platform
import subprocess
import json
import io
import contextlib
import traceback
import queue
import time
import uuid
import shutil
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class ExternalKernel:
    def __init__(self):
        self.process = None
        self.current_path = ""
        self.output_queue = queue.Queue()
        self.error_queue = queue.Queue()
        self.marker = f"__NOTEBOOK_DONE_{uuid.uuid4()}__"

    def ensure_started(self):
        if self.process and self.process.poll() is None:
            return
        
        # Prefer system python from PATH
        python_cmd = shutil.which("python") or shutil.which("python3") or sys.executable
        
        self.process = subprocess.Popen(
            [python_cmd, "-u", "-i"], # Unbuffered interactive
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=0
        )
        
        # Start reader threads
        threading.Thread(target=self._read_stream, args=(self.process.stdout, self.output_queue), daemon=True).start()
        threading.Thread(target=self._read_stream, args=(self.process.stderr, self.error_queue), daemon=True).start()

        # DISCARD THE BANNER & INJECT ROBUST EXECUTOR
        setup_code = """
import sys, io, base64, os, uuid, json

# Matplotlib setup
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    def custom_show():
        try:
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)
            img_data = base64.b64encode(buf.read()).decode()
            sys.stdout.write(f'__IMAGE_PNG__{img_data}\\n')
            sys.stdout.flush()
            plt.close()
        except Exception as e:
            sys.stderr.write(f"ERROR in custom_show: {str(e)}\\n")
            sys.stderr.flush()
    plt.show = custom_show
except:
    pass

# Executor function to avoid REPL prompt/indentation issues
def __pytron_exec__(b64_code):
    try:
        code = base64.b64decode(b64_code).decode('utf-8')
        # We use a global namespace to maintain state
        exec(code, globals())
        sys.stdout.flush()
        sys.stderr.flush()
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.stderr.flush()
"""
        self.process.stdin.write(setup_code + "\n")
        self.process.stdin.flush()
        
        start = time.time()
        while time.time() - start < 3: # Wait max 3 seconds for banner/setup
            try:
                line = self.output_queue.get(timeout=0.1)
                if self.marker in line:
                    break
            except queue.Empty:
                pass

    def _read_stream(self, stream, q):
        while True:
            line = stream.readline()
            if not line:
                break
            q.put(line)

    def execute(self, cell_id, code, app, path=""):
        self.current_path = path
        self.ensure_started()
        
        # Clear queues
        while not self.output_queue.empty(): self.output_queue.get()
        while not self.error_queue.empty(): self.error_queue.get()
        
        # Use base64 for safety against any character/indentation/prompt issues
        import base64
        b64_code = base64.b64encode(code.encode('utf-8')).decode('ascii')
        
        # Call our robust executor and signal completion
        exec_line = f"__pytron_exec__('{b64_code}')\nprint('{self.marker}')\nimport sys; print('{self.marker}', file=sys.stderr)\n"
        
        try:
            self.process.stdin.write(exec_line)
            self.process.stdin.flush()
        except (BrokenPipeError, AttributeError):
            self.process = None
            self.ensure_started()
            self.process.stdin.write(exec_line)
            self.process.stdin.flush()

        # Collect output until markers and dispatch in real-time
        timeout = 600 # 60 seconds max per cell
        start_time = time.time()
        
        done_out = False
        done_err = False
        
        while (not done_out or not done_err) and (time.time() - start_time < timeout):
            try:
                if not done_out:
                    line = self.output_queue.get(timeout=0.01)
                    if self.marker in line:
                        done_out = True
                    elif "__IMAGE_PNG__" in line:
                        base64_data = line.split("__IMAGE_PNG__")[1].strip()
                        app.emit("notebook:output", {
                            "path": self.current_path,
                            "cell_id": cell_id, 
                            "type": "image/png", 
                            "data": base64_data
                        })
                    else:
                        app.emit("notebook:output", {
                            "path": self.current_path,
                            "cell_id": cell_id, 
                            "stream": "stdout", 
                            "text": line
                        })
            except queue.Empty:
                pass

            try:
                if not done_err:
                    line = self.error_queue.get(timeout=0.01)
                    if self.marker in line:
                        done_err = True
                    else:
                        app.emit("notebook:output", {
                            "path": self.current_path,
                            "cell_id": cell_id, 
                            "stream": "stderr", 
                            "text": line
                        })
            except queue.Empty:
                pass
        
        return True # Handled via dispatch

    def reset(self):
        if self.process:
            self.process.terminate()
            self.process = None

# Global kernel instance
kernel = ExternalKernel()

# Global server state for this module
server_state = {"httpd": None, "thread": None}


def register_system_routes(app):

    @app.expose
    def get_system_info():
        """Get system information."""
        try:
            info = {
                "platform": platform.system(),
                "release": platform.release(),
                "version": platform.version(),
                "architecture": platform.machine(),
                "processor": platform.processor(),
                "python_version": sys.version,
                "python_executable": sys.executable,
                "cwd": os.getcwd(),
                "active_threads": threading.active_count(),
                "cpu_count": os.cpu_count(),
            }
            return {"success": True, "info": info}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def get_installed_packages():
        """Get list of installed pip packages."""
        try:
            # Run pip list --format=json
            # Use --disable-pip-version-check to avoid extra output
            cmd = [sys.executable, "-m", "pip", "list", "--format=json", "--disable-pip-version-check"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                try:
                    packages = json.loads(result.stdout)
                    return {"success": True, "packages": packages}
                except json.JSONDecodeError:
                    # Fallback for older pip versions or text output
                    return {"success": False, "error": "Could not parse pip output", "raw": result.stdout}
            else:
                return {"success": False, "error": result.stderr}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def get_custom_tools():
        """Get list of loaded custom tools."""
        from backend.services.custom_tool_registry import registry
        try:
            tools_info = []
            for t in registry.loaded_tools:
                tools_info.append({
                    "name": t.name,
                    "description": t.description
                })
            return {"success": True, "tools": tools_info}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def start_static_server(path="."):
        """Start a static file server."""
        print(f"start_static_server called: {path}")
        try:
            if path == ".":
                path = os.getcwd()
            if server_state["httpd"]:
                server_state["httpd"].shutdown()
                server_state["httpd"].server_close()
                server_state["httpd"] = None

            # Find free port
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
            sock.close()

            def run_server():
                class Handler(SimpleHTTPRequestHandler):
                    def __init__(self, *args, **kwargs):
                        super().__init__(*args, directory=path, **kwargs)

                    def log_message(self, format, *args):
                        pass  # Silence logs

                    def end_headers(self):
                        # Add headers to prevent caching
                        self.send_header(
                            "Cache-Control", "no-cache, no-store, must-revalidate"
                        )
                        self.send_header("Pragma", "no-cache")
                        self.send_header("Expires", "0")
                        self.send_header("Access-Control-Allow-Origin", "*")
                        super().end_headers()

                    def do_GET(self):
                        # SPA Fallback
                        try:
                            # Get the local path
                            local_path = self.translate_path(self.path)

                            # If path doesn't exist and is not a file with extension, serve index.html
                            if not os.path.exists(local_path):
                                _, ext = os.path.splitext(local_path)
                                if not ext:  # No extension, assume route
                                    # Check if index.html exists in root
                                    if os.path.exists(
                                        os.path.join(self.directory, "index.html")
                                    ):
                                        self.path = "/index.html"
                        except Exception:
                            pass  # Fallback to default behavior on error

                        super().do_GET()

                server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
                server_state["httpd"] = server
                server.serve_forever()

            t = threading.Thread(target=run_server, daemon=True)
            t.start()
            server_state["thread"] = t

            return {"success": True, "url": f"http://127.0.0.1:{port}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def stop_static_server():
        """Stop the static file server."""
        print("stop_static_server called")
        try:
            if server_state["httpd"]:
                server_state["httpd"].shutdown()
                server_state["httpd"].server_close()
                server_state["httpd"] = None
                return {"success": True}
            return {"success": False, "error": "No server running"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def toggle_maximize():
        """Toggle maximize state of the window."""
        try:
            app.toggle_maximize()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def minimize_window():
        """Minimize the window."""
        try:
            app.minimize()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def close_window():
        """Close the window."""
        try:
            app.close()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def run_notebook_cell(cell_id, code, path=""):
        """Executes Python code in the external kernel and dispatches output chunks."""
        print(f"DEBUG: run_notebook_cell called - Cell ID: {cell_id}, Path: {path}")
        try:
            # Clear previous outputs for this cell in JS if needed
            app.emit("notebook:clear", {"cell_id": cell_id, "path": path})
            kernel.execute(cell_id, code, app, path=path)
            print(f"DEBUG: run_notebook_cell finished execute - Cell ID: {cell_id}")
            return {"success": True, "cell_id": cell_id, "status": "completed"}
        except Exception:
            print(f"ERROR: run_notebook_cell failed: {traceback.format_exc()}")
            return {"success": False, "cell_id": cell_id, "output": traceback.format_exc(), "status": "error"}

    @app.expose
    def reset_notebook_kernel():
        """Resets the persistent external kernel."""
        kernel.reset()
        return {"success": True}

