import os
import subprocess
from backend.api.utils import get_subprocess_kwargs

def register_git_routes(app):

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
    def list_branches(path="."):
        """List all git branches."""
        try:
            if path == ".":
                path = os.getcwd()
            result = subprocess.run(
                ["git", "branch", "-a"],
                cwd=path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                **get_subprocess_kwargs(),
            )
            if result.returncode != 0:
                return {"success": False, "error": result.stderr}
            
            branches = []
            for line in result.stdout.splitlines():
                name = line.replace("*", "").strip()
                is_current = line.startswith("*")
                branches.append({"name": name, "current": is_current})
            return {"success": True, "branches": branches}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def checkout_branch(branch, path="."):
        """Checkout a git branch."""
        try:
            if path == ".":
                path = os.getcwd()
            result = subprocess.run(
                ["git", "checkout", branch],
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
    def get_git_log(path=".", limit=50):
        """Get git log as a graph."""
        try:
            if path == ".":
                path = os.getcwd()
            # Format: hash | author | date | subject
            result = subprocess.run(
                ["git", "log", "--graph", f"--max-count={limit}", "--pretty=format:%h|%an|%ar|%s"],
                cwd=path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                **get_subprocess_kwargs(),
            )
            if result.returncode != 0:
                return {"success": False, "error": result.stderr}
            return {"success": True, "log": result.stdout}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def get_file_diff(file_path, path="."):
        """Get diff for a specific file (staged vs unstaged or head vs current)."""
        try:
            if path == ".":
                path = os.getcwd()
            
            # Read original content from HEAD
            original_res = subprocess.run(
                ["git", "show", f"HEAD:{file_path}"],
                cwd=path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                **get_subprocess_kwargs(),
            )
            original = original_res.stdout if original_res.returncode == 0 else ""
            
            # Read current content from file system
            full_path = os.path.join(path, file_path)
            if os.path.exists(full_path):
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    modified = f.read()
            else:
                modified = ""
                
            return {"success": True, "original": original, "modified": modified}
        except Exception as e:
            return {"success": False, "error": str(e)}
