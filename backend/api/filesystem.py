import os
import shutil

def register_filesystem_routes(app):
    
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
    def read_file_base64(path):
        """Read content of a file as base64."""
        import base64
        try:
            with open(path, "rb") as f:
                return {"success": True, "content": base64.b64encode(f.read()).decode('utf-8')}
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
    def search_in_files(query, path="."):
        """Search for a string in files."""
        print(f"search_in_files called: {query}")
        try:
            if path == ".":
                path = os.getcwd()

            query_lower = query.lower()
            results = []
            max_results = 200 # Increased limit
            
            # Common exclude directories
            exclude_dirs = {".git", "node_modules", "__pycache__", "build", "dist", ".venv", "env"}
            
            for root, dirs, files in os.walk(path):
                # Filter out excluded directories
                dirs[:] = [d for d in dirs if d not in exclude_dirs]

                for file in files:
                    if file.endswith(
                        (".py", ".js", ".jsx", ".css", ".html", ".json", ".md", ".txt", ".ts", ".tsx")
                    ):
                        file_path = os.path.join(root, file)
                        try:
                            # Use small chunks or line-by-line for large files if needed, 
                            # but for now let's just do a faster case-insensitive check
                            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                                for i, line in enumerate(f):
                                    if query_lower in line.lower():
                                        results.append(
                                            {
                                                "file": file,
                                                "path": file_path,
                                                "line": i + 1,
                                                "content": line.strip(),
                                            }
                                        )
                                        if len(results) >= max_results:
                                            return {"success": True, "results": results}
                        except Exception as e:
                            print(f"Error reading {file_path}: {e}")
                            continue

            return {"success": True, "results": results}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def get_project_stats(root_path):
        """Analyze project for deep metrics: LoC, TODOs, Classes, and Functions."""
        print(f"get_project_stats (Deep) called for: {root_path}")
        import re
        try:
            stats = {
                "total_files": 0,
                "total_size": 0,
                "total_loc": 0,
                "todo_count": 0,
                "class_count": 0,
                "func_count": 0,
                "extensions": {},
                "top_files": []
            }
            
            # Simple patterns for analysis
            patterns = {
                "todo": re.compile(r"TODO:|FIXME:", re.IGNORECASE),
                "class": re.compile(r"^\s*(class|export\s+class)\s+(\w+)", re.MULTILINE),
                "func": re.compile(r"^\s*(def|async\s+def|function|async\s+function|const\s+\w+\s*=\s*(async\s*)?\(|export\s+(const|function|async|def))", re.MULTILINE)
            }
            
            for root, dirs, files in os.walk(root_path):
                if any(ignored in root for ignored in ['.git', '__pycache__', 'node_modules', 'dist', 'build', '.venv', 'venv']):
                    continue
                
                for f in files:
                    file_path = os.path.join(root, f)
                    ext = os.path.splitext(f)[1].lower()
                    
                    try:
                        size = os.path.getsize(file_path)
                        stats["total_files"] += 1
                        stats["total_size"] += size
                        stats["extensions"][ext or "no-ext"] = stats["extensions"].get(ext or "no-ext", 0) + 1
                        
                        # Only analyze code files (limit size to 1MB to avoid hanging on binaries)
                        if ext in ['.py', '.js', '.jsx', '.ts', '.tsx', '.css', '.html'] and size < 1024 * 1024:
                            with open(file_path, "r", encoding="utf-8", errors="ignore") as file:
                                content = file.read()
                                lines = content.splitlines()
                                stats["total_loc"] += len(lines)
                                
                                # Deep analysis
                                stats["todo_count"] += len(patterns["todo"].findall(content))
                                stats["class_count"] += len(patterns["class"].findall(content))
                                stats["func_count"] += len(patterns["func"].findall(content))
                        
                        if len(stats["top_files"]) < 10 or size > stats["top_files"][-1]["size"]:
                            stats["top_files"].append({"name": f, "path": file_path, "size": size})
                            stats["top_files"].sort(key=lambda x: x["size"], reverse=True)
                            stats["top_files"] = stats["top_files"][:10]
                    except:
                        continue
            
            return {"success": True, "stats": stats}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def replace_in_files(query, replacement, files_to_modify=[]):
        """Search and replace text in multiple files."""
        print(f"replace_in_files called: {query} -> {replacement}")
        try:
            modified_count = 0
            match_count = 0
            
            for file_path in files_to_modify:
                if not os.path.exists(file_path):
                    continue
                
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    if query in content:
                        occurrences = content.count(query)
                        new_content = content.replace(query, replacement)
                        
                        with open(file_path, "w", encoding="utf-8") as f:
                            f.write(new_content)
                        
                        modified_count += 1
                        match_count += occurrences
                except:
                    continue
            
            return {
                "success": True, 
                "files_modified": modified_count, 
                "matches_replaced": match_count
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def select_directory():
        """Open a native directory selection dialog."""
        print("[Backend] select_directory called (Native)")
        try:
            path = app.dialog_open_folder("Select a directory to browse")
            if path:
                print(f"[Backend] Selected path: {path}")
                return {"success": True, "path": path}
            else:
                print("[Backend] Selection cancelled")
                return {"success": False, "error": "Cancelled"}
        except Exception as e:
            print(f"[Backend] select_directory error: {e}")
            return {"success": False, "error": str(e)}
    @app.expose
    def sync_backend_cwd(path):
        """Synchronize backend CWD with project path."""
        try:
            if os.path.exists(path) and os.path.isdir(path):
                os.chdir(path)
                print(f"[Backend] CWD changed to: {path}")
                return {"success": True}
            return {"success": False, "error": "Invalid directory"}
        except Exception as e:
            return {"success": False, "error": str(e)}
