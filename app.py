from pytron import App
import os
import subprocess
import sys


import threading
import queue


def get_subprocess_kwargs():
    kwargs = {}
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        kwargs["startupinfo"] = startupinfo
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    return kwargs


class ShellSession:
    def __init__(self):
        self.process = None
        self.out_queue = queue.Queue()
        self.running = False
        self.thread = None

    def start(self, cwd=None):
        if self.running:
            return

        if cwd is None:
            cwd = os.getcwd()

        # Use powershell or cmd
        if os.name == "nt":
            shell_cmd = ["powershell.exe", "-NoLogo", "-NoExit", "-Command", "-"]
        else:
            shell_cmd = ["/bin/bash", "-i"]

        # Environment with unbuffered output if possible
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

        self.process = subprocess.Popen(
            shell_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Merge stderr into stdout
            cwd=cwd,
            shell=False,
            bufsize=0,  # Unbuffered
            env=env,
            **get_subprocess_kwargs(),
        )
        self.running = True

        self.thread = threading.Thread(target=self._read_output, daemon=True)
        self.thread.start()

        # Initial setup for PowerShell
        if os.name == "nt":
            # Set prompt to show only current folder name and clear host
            # We use a small delay or just send it.
            init_script = 'function prompt { "$(Split-Path -Leaf (Get-Location))> " }; Clear-Host\r\n'
            self.write(init_script)

    def _read_output(self):
        while self.running and self.process.poll() is None:
            try:
                # Use os.read for lower level access, reads up to 4096 bytes
                # This blocks until at least 1 byte is available
                data = os.read(self.process.stdout.fileno(), 4096)
                if data:
                    self.out_queue.put(data)
                else:
                    break
            except Exception:
                break
        self.running = False

    def write(self, data):
        if self.running and self.process:
            try:
                self.process.stdin.write(data.encode("utf-8"))
                self.process.stdin.flush()
            except Exception:
                pass

    def read(self):
        output = b""
        try:
            while True:
                output += self.out_queue.get_nowait()
        except queue.Empty:
            pass
        return output.decode("utf-8", errors="replace")

    def stop(self):
        self.running = False
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=0.2)
            except subprocess.TimeoutExpired:
                self.process.kill()


shell_session = ShellSession()


def main():
    app = App()

    @app.expose
    def list_dir(path="."):
        """List directories and files in the given path."""
        try:
            # Default to current working directory if "." is passed
            print("list_dir called")
            if path == ".":
                path = os.getcwd()

            items = []
            with os.scandir(path) as it:
                for entry in it:
                    items.append(
                        {
                            "name": entry.name,
                            "path": entry.path,
                            "is_dir": entry.is_dir(),
                        }
                    )
            # Sort: directories first, then files
            items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
            return {"success": True, "items": items, "current_path": path}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def read_file_content(path):
        """Read content of a file."""
        print("read_file_content called")
        try:
            with open(path, "r", encoding="utf-8") as f:
                return {"success": True, "content": f.read()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def save_file_content(path, content):
        """Save content to a file."""
        print("save_file_content called")
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def create_item(path, is_dir=False):
        """Create a new file or directory."""
        print(f"create_item called: {path}, is_dir={is_dir}")
        try:
            if is_dir:
                os.makedirs(path, exist_ok=True)
            else:
                with open(path, "w", encoding="utf-8") as f:
                    pass  # Create empty file
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def delete_item(path):
        """Delete a file or directory."""
        print(f"delete_item called: {path}")
        try:
            if os.path.isdir(path):
                import shutil

                shutil.rmtree(path)
            else:
                os.remove(path)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def rename_item(old_path, new_path):
        """Rename a file or directory."""
        print(f"rename_item called: {old_path} -> {new_path}")
        try:
            os.rename(old_path, new_path)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

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
    def search_in_files(query, path="."):
        """Search for a string in files."""
        print(f"search_in_files called: {query}")
        try:
            if path == ".":
                path = os.getcwd()

            results = []
            for root, dirs, files in os.walk(path):
                if "node_modules" in dirs:
                    dirs.remove("node_modules")  # Skip node_modules
                if ".git" in dirs:
                    dirs.remove(".git")

                for file in files:
                    if file.endswith(
                        (".py", ".js", ".jsx", ".css", ".html", ".json", ".md", ".txt")
                    ):
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, "r", encoding="utf-8") as f:
                                content = f.read()
                                if query in content:
                                    # Find line number
                                    lines = content.split("\n")
                                    for i, line in enumerate(lines):
                                        if query in line:
                                            results.append(
                                                {
                                                    "file": file,
                                                    "path": file_path,
                                                    "line": i + 1,
                                                    "content": line.strip(),
                                                }
                                            )
                                            if len(results) > 50:  # Limit results
                                                break
                        except:
                            continue
                if len(results) > 50:
                    break

            return {"success": True, "results": results}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def select_directory():
        """Open a directory selection dialog."""
        try:
            import tkinter as tk
            from tkinter import filedialog

            root = tk.Tk()
            root.withdraw()  # Hide the main window
            root.attributes("-topmost", True)  # Make sure dialog is on top

            path = filedialog.askdirectory()
            root.destroy()

            if path:
                return {"success": True, "path": path}
            else:
                return {"success": False, "error": "Cancelled"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def ask_ai(query, context, path):
        """Mock AI response."""
        import time

        time.sleep(0.5)  # Simulate thinking

        # Simple keyword matching for "crazy" effect
        response = (
            "I'm just a simple mock AI for now, but I see you're asking about: " + query
        )

        if "fix" in query.lower():
            response = "I can help you fix bugs! (Not really, I'm a mock, but I believe in you!)."
        elif "explain" in query.lower():
            if context:
                lines = len(context.splitlines())
                response = f"This file '{path}' has {lines} lines of code. It looks like a masterpiece!"
            else:
                response = "I don't see any file content to explain."
        elif "hello" in query.lower():
            response = "Hello there! Ready to build something crazy?"
        elif "joke" in query.lower():
            response = (
                "Why do programmers prefer dark mode? Because light attracts bugs."
            )

        return {"success": True, "response": response}

    @app.expose
    def get_git_status(path="."):
        """Get git status."""
        try:
            if path == ".":
                path = os.getcwd()

            # Get branch
            branch_res = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
                **get_subprocess_kwargs(),
            )
            branch = branch_res.stdout.strip() if branch_res.returncode == 0 else ""

            # Get status
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
                **get_subprocess_kwargs(),
            )

            if result.returncode != 0:
                return {"success": False, "error": result.stderr}

            changes = []
            for line in result.stdout.splitlines():
                if len(line) < 4:
                    continue
                status_code = line[:2]
                file_path = line[3:]
                changes.append({"file": file_path, "status": status_code})

            return {"success": True, "changes": changes, "branch": branch}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def git_action(action, args=[], path="."):
        """Perform git actions."""
        try:
            if path == ".":
                path = os.getcwd()

            cmd = ["git"]
            if action == "commit":
                cmd.extend(["commit", "-m", args[0]])
            elif action == "add":
                cmd.extend(["add"] + args)
            elif action == "restore":
                cmd.extend(["restore"] + args)

            result = subprocess.run(
                cmd,
                cwd=path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                **get_subprocess_kwargs(),
            )

            if result.returncode == 0:
                return {"success": True, "output": result.stdout}
            else:
                return {"success": False, "error": result.stderr}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def test_regex(pattern, text, flags=0):
        """Test a regex pattern against text using Python's re module."""
        import re

        try:
            # Parse flags if needed (simplified for now)
            # flags can be passed as int

            matches = []
            for m in re.finditer(pattern, text, flags):
                matches.append(
                    {
                        "start": m.start(),
                        "end": m.end(),
                        "match": m.group(),
                        "groups": m.groups(),
                        "groupdict": m.groupdict(),
                    }
                )
            return {"success": True, "matches": matches}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def get_code_metrics(path):
        """Calculate Cyclomatic Complexity for Python files."""
        import ast

        try:
            with open(path, "r", encoding="utf-8") as f:
                source = f.read()

            tree = ast.parse(source)

            class ComplexityVisitor(ast.NodeVisitor):
                def __init__(self):
                    self.functions = []
                    self.current_complexity = 0

                def visit_FunctionDef(self, node):
                    # Reset complexity for new function
                    old_complexity = self.current_complexity
                    self.current_complexity = 1  # Base complexity

                    # Visit children to count branches
                    self.generic_visit(node)

                    self.functions.append(
                        {
                            "name": node.name,
                            "line": node.lineno,
                            "complexity": self.current_complexity,
                        }
                    )

                    # Restore (though we don't really nest function defs for complexity usually)
                    self.current_complexity = old_complexity

                def visit_If(self, node):
                    self.current_complexity += 1
                    self.generic_visit(node)

                def visit_For(self, node):
                    self.current_complexity += 1
                    self.generic_visit(node)

                def visit_While(self, node):
                    self.current_complexity += 1
                    self.generic_visit(node)

                def visit_Try(self, node):
                    self.current_complexity += 1
                    self.generic_visit(node)

                def visit_ExceptHandler(self, node):
                    self.current_complexity += 1
                    self.generic_visit(node)

                # Boolean operators (and, or) also increase complexity
                def visit_BoolOp(self, node):
                    self.current_complexity += len(node.values) - 1
                    self.generic_visit(node)

            visitor = ComplexityVisitor()
            visitor.visit(tree)

            # Sort by complexity (descending)
            visitor.functions.sort(key=lambda x: x["complexity"], reverse=True)

            return {"success": True, "metrics": visitor.functions}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def analyze_imports(path):
        """Analyze imports in a file and check their status."""
        import ast
        import importlib.metadata
        import importlib.util
        import sys

        try:
            with open(path, "r", encoding="utf-8") as f:
                source = f.read()

            tree = ast.parse(source)
            imports = set()

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.add(alias.name.split(".")[0])
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.add(node.module.split(".")[0])

            results = []
            for module in imports:
                status = "unknown"
                version = None

                # Check if it's a standard library (approximate)
                if module in sys.builtin_module_names:
                    status = "stdlib"
                else:
                    try:
                        spec = importlib.util.find_spec(module)
                        if spec:
                            # It is installed/importable
                            try:
                                version = importlib.metadata.version(module)
                                status = "installed"
                            except importlib.metadata.PackageNotFoundError:
                                # Might be stdlib or a local module
                                if "site-packages" in (spec.origin or ""):
                                    status = "installed"
                                    version = "unknown"
                                else:
                                    status = "stdlib/local"
                        else:
                            status = "missing"
                    except Exception:
                        status = "missing"

                results.append({"name": module, "status": status, "version": version})

            # Sort: missing first, then installed
            results.sort(key=lambda x: (x["status"] != "missing", x["name"]))

            return {"success": True, "imports": results}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def install_package(package_name):
        """Install a package using pip."""
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", package_name],
                **get_subprocess_kwargs(),
            )
            return {"success": True}
        except subprocess.CalledProcessError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def get_bytecode(path):
        """Get bytecode disassembly for a Python file."""
        import dis
        import io

        try:
            with open(path, "r", encoding="utf-8") as f:
                source = f.read()

            # Compile source
            code_obj = compile(source, path, "exec")

            # Disassemble to string
            output = io.StringIO()
            dis.dis(code_obj, file=output)

            return {"success": True, "bytecode": output.getvalue()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def format_code(path):
        """Format Python code using black."""
        import subprocess
        import sys

        try:
            # Check if black is installed
            try:
                import black
            except ImportError:
                return {
                    "success": False,
                    "error": "Black is not installed. Please install it via pip.",
                }

            # Run black
            result = subprocess.run(
                [sys.executable, "-m", "black", path],
                capture_output=True,
                text=True,
                **get_subprocess_kwargs(),
            )

            if result.returncode == 0:
                return {"success": True}
            else:
                return {"success": False, "error": result.stderr}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def terminal_init(cwd=None):
        """Initialize the terminal session."""
        print(f"terminal_init called: {cwd}")
        try:
            shell_session.stop()  # Stop existing if any
            shell_session.start(cwd)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def terminal_write(data):
        """Write data to the terminal."""
        try:
            shell_session.write(data)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def terminal_read():
        """Read output from the terminal."""
        try:
            output = shell_session.read()
            return {"success": True, "output": output}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # Global server state
    server_state = {"httpd": None, "thread": None}

    @app.expose
    def start_static_server(path="."):
        """Start a static file server."""
        import threading
        import socket
        from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

        print(f"start_static_server called: {path}")
        try:
            if path == ".":
                path = os.getcwd()

            # Stop existing if running
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

    app.run()


if __name__ == "__main__":
    main()
