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

            # Check if .git directory exists
            is_repo = os.path.exists(os.path.join(path, ".git"))
            if not is_repo:
                # Try git rev-parse to be sure (in case of nested or detached)
                res = subprocess.run(
                    ["git", "rev-parse", "--is-inside-work-tree"],
                    cwd=path,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    **get_subprocess_kwargs(),
                )
                if res.returncode != 0:
                    return {"success": True, "changes": [], "branch": None, "is_repo": False}
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

            return {"success": True, "changes": changes, "branch": branch, "is_repo": True}
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
            elif action == "init":
                cmd.extend(["init"])

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
            
            full_path = os.path.join(path, file_path)
            
            # Simple check for very large files > 5MB to prevent freezing
            if os.path.exists(full_path) and os.path.getsize(full_path) > 5 * 1024 * 1024:
                return {"success": True, "original": "File too large to display diff ( > 5MB ).", "modified": "File too large to display diff ( > 5MB )."}
            
            # Simple binary check using null bytes
            is_binary = False
            if os.path.exists(full_path):
                with open(full_path, "rb") as bf:
                    chunk = bf.read(1024)
                    if b'\0' in chunk:
                        is_binary = True

            if is_binary:
                return {"success": True, "original": "Binary file (changes not shown)", "modified": "Binary file (changes not shown)"}

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
            if os.path.exists(full_path):
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    modified = f.read()
            else:
                modified = ""
                
            return {"success": True, "original": original, "modified": modified}
        except Exception as e:
            return {"success": False, "error": str(e)}
    @app.expose
    def get_recent_commits(path=".", limit=5):
        """Get recent git commits for the activity feed."""
        try:
            if path == ".":
                path = os.getcwd()
            
            # check if repo
            if not os.path.exists(os.path.join(path, ".git")):
                return {"success": True, "commits": []}

            res = subprocess.run(
                ["git", "log", f"-n {limit}", "--pretty=format:%h|%an|%ar|%s"],
                cwd=path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                **get_subprocess_kwargs(),
            )
            
            if res.returncode != 0:
                return {"success": False, "error": res.stderr}
            
            commits = []
            for line in res.stdout.splitlines():
                if not line.strip(): continue
                hash, author, date, msg = line.split("|", 3)
                commits.append({"hash": hash, "author": author, "date": date, "message": msg})
                
            return {"success": True, "commits": commits}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def generate_commit_message(path="."):
        """Autogenerate a commit message using AI based on the current diff."""
        try:
            if path == ".":
                path = os.getcwd()
                
            # First check if there are staged changes
            staged_diff = subprocess.run(
                ["git", "diff", "--cached"],
                cwd=path, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, **get_subprocess_kwargs()
            ).stdout
            
            diff_to_use = staged_diff
            if not diff_to_use.strip():
                # Fallback to unstaged changes if nothing is staged
                diff_to_use = subprocess.run(
                    ["git", "diff"],
                    cwd=path, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, **get_subprocess_kwargs()
                ).stdout
                
            if not diff_to_use.strip():
                return {"success": False, "error": "No changes found to generate a message."}
                
            # Truncate diff if it's too massive
            if len(diff_to_use) > 15000:
                diff_to_use = diff_to_use[:15000] + "\n...[diff truncated]..."
                
            from backend.services.model_manager import get_model_instance
            from langchain_core.messages import HumanMessage
            
            prompt = f"""
You are an expert developer. Write a concise, conventional commit message for the following diff.
Output ONLY the raw commit message (no markdown block, no quotes, no explanations).
Use conventional commits (feat, fix, docs, style, refactor, test, chore).
Keep it under 72 characters if possible.

Diff:
{diff_to_use}
"""
            model = get_model_instance("gemini-2.0-flash", temperature=0.2)
            response = model.invoke([HumanMessage(content=prompt)])
            return {"success": True, "message": response.content.strip()}
        except Exception as e:
            return {"success": False, "error": str(e)}
