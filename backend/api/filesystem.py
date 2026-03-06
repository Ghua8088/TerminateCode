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
