import os
import re
import subprocess
import difflib
from typing import List, Dict, Any, Optional

def get_project_map(depth: int = 2, exclude_dirs: List[str] = [".git", "node_modules", "__pycache__", "venv", "env", "dist", "build"]):
    """Get a visual tree map of the project structure."""
    root_dir = os.getcwd()
    tree = []
    
    def build_tree(current_path, current_depth):
        if current_depth > depth:
            return
        try:
            # Get items and sort them (directories first)
            items = sorted(os.listdir(current_path))
            for i, item in enumerate(items):
                if item in exclude_dirs:
                    continue
                
                path = os.path.join(current_path, item)
                is_dir = os.path.isdir(path)
                
                indent = "  " * current_depth
                connector = "└── " if i == len(items) - 1 else "├── "
                
                tree.append(f"{indent}{connector}{item}{'/' if is_dir else ''}")
                
                if is_dir:
                    build_tree(path, current_depth + 1)
        except Exception:
            pass

    tree.append(f"Project Root: {os.path.basename(root_dir)}/")
    build_tree(root_dir, 0)
    return "\n".join(tree)

def search_code(pattern: str, file_ext: Optional[str] = None, case_sensitive: bool = False):
    """Search for a regex pattern across all project files."""
    root_dir = os.getcwd()
    results = []
    flags = 0 if case_sensitive else re.IGNORECASE
    exclude = {".git", "node_modules", "__pycache__", "venv", "env", "dist", "build"}
    
    try:
        for root, dirs, files in os.walk(root_dir):
            # Prune excluded directories
            dirs[:] = [d for d in dirs if d not in exclude]
            
            for file in files:
                if file_ext and not file.endswith(file_ext):
                    continue
                
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        for i, line in enumerate(f, 1):
                            if re.search(pattern, line, flags):
                                rel_path = os.path.relpath(path, root_dir)
                                results.append(f"{rel_path}:{i}: {line.strip()}")
                                if len(results) > 100:
                                    return "\n".join(results) + "\n... (Too many results, truncated)"
                except Exception:
                    continue
    except Exception as e:
        return f"Search Error: {str(e)}"
    
    return "\n".join(results) if results else "No matches found."

def apply_patch(path: str, search_block: str, replace_block: str):
    """Surgically replace a block of code in a file (Diff/Patch)."""
    try:
        if not os.path.exists(path):
            return f"Error: File not found at {path}"
            
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if search_block not in content:
            return "Error: Could not find the exact search block in the file. Ensure whitespace and indentation match exactly."
            
        new_content = content.replace(search_block, replace_block)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        return f"Successfully applied patch to {path}."
    except Exception as e:
        return f"Patch Error: {str(e)}"

def git_status():
    """Get the current git status of the project."""
    try:
        result = subprocess.run(["git", "status", "--short"], capture_output=True, text=True, check=True)
        return result.stdout if result.stdout else "Git repository is clean."
    except Exception as e:
        return f"Git Error: {str(e)}"

def git_diff(staged: bool = False):
    """Get the current git diff, optionally showing staged changes."""
    try:
        cmd = ["git", "diff"]
        if staged:
            cmd.append("--cached")
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.getcwd())
        if result.returncode != 0:
            return f"Git Error: {result.stderr}"
        if not result.stdout:
            return "No changes detected."
        return f"```diff\n{result.stdout}\n```"
    except Exception as e:
        return f"Git Exception: {str(e)}"

def git_log(n: int = 5):
    """Get the last n git commits."""
    try:
        result = subprocess.run(["git", "log", "-n", str(n), "--oneline"], capture_output=True, text=True, check=True)
        return result.stdout if result.stdout else "No commit history found."
    except Exception as e:
        return f"Git Error: {str(e)}"

def read_directory_context(path: str, recursive: bool = False, depth: int = 1):
    """Summarize the contents of a directory (files and subfolders)."""
    try:
        if not os.path.exists(path):
            return f"Error: {path} not found."
            
        summary = []
        for root, dirs, files in os.walk(path):
            curr_depth = root.count(os.sep) - path.count(os.sep)
            if not recursive and curr_depth > 0:
                break
            if curr_depth >= depth:
                continue
                
            summary.append(f"Folder: {root}")
            for f in files:
                summary.append(f"  - {f}")
                
        return "\n".join(summary)
    except Exception as e:
        return f"Directory Error: {str(e)}"

