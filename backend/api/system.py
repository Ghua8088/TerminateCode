import os
import threading
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Global server state for this module
server_state = {"httpd": None, "thread": None}

def register_system_routes(app):

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
