import ast
import importlib.metadata
import importlib.util
import sys
import dis
import io
import subprocess
from backend.api.utils import get_subprocess_kwargs

def register_code_analysis_routes(app):

    @app.expose
    def get_code_metrics(path):
        """Calculate Cyclomatic Complexity for Python files."""
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
    def get_bytecode(path):
        """Get bytecode disassembly for a Python file."""
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
