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

def fuzzy_apply_patch(content: str, search_block: str, replace_block: str) -> str:
    """Fuzzy line-based patch application to prevent failure due to minor whitespace/indentation shifts."""
    search_lines = [line.strip() for line in search_block.splitlines() if line.strip()]
    content_lines = content.splitlines()
    
    if not search_lines:
        return content.replace(search_block, replace_block)
        
    # Search for matching line sequence ignoring leading/trailing whitespace
    match_start = -1
    search_len = len(search_lines)
    
    for i in range(len(content_lines) - search_len + 1):
        slice_lines = [line.strip() for line in content_lines[i:i+search_len] if line.strip()]
        if len(slice_lines) == search_len and all(s == c for s, c in zip(search_lines, slice_lines)):
            match_start = i
            break
            
    if match_start == -1:
        # Fallback to standard difflib sequence matching
        matcher = difflib.SequenceMatcher(None, search_lines, [c.strip() for c in content_lines])
        match = matcher.find_longest_match(0, len(search_lines), 0, len(content_lines))
        if match.size >= max(1, len(search_lines) // 2):
            match_start = match.b - match.a
            
    if match_start != -1:
        # Extract correct indentation from matching block
        orig_indent = ""
        for line in content_lines[match_start:match_start+search_len]:
            if line.strip():
                orig_indent = line[:len(line) - len(line.lstrip())]
                break
        
        # Apply indentation to replacement lines
        indented_replace = []
        for line in replace_block.splitlines():
            indented_replace.append(orig_indent + line if line.strip() else line)
            
        content_lines[match_start:match_start+search_len] = indented_replace
        return "\n".join(content_lines)
        
    raise ValueError("Could not locate search block in target file (Fuzzy Match Failed).")

def apply_patch(path: str, search_block: str, replace_block: str):
    """Surgically replace a block of code in a file (Diff/Patch)."""
    try:
        if not os.path.exists(path):
            return f"Error: File not found at {path}"
            
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        try:
            new_content = fuzzy_apply_patch(content, search_block, replace_block)
        except Exception as e:
            return f"Error: Could not find matching code block. {str(e)}"
            
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

