from pytron import App
import os
import subprocess

def main():
    app = App()
    window = app.create_window()

    @window.expose
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
                    items.append({
                        "name": entry.name,
                        "path": entry.path,
                        "is_dir": entry.is_dir()
                    })
            # Sort: directories first, then files
            items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
            return {"success": True, "items": items, "current_path": path}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @window.expose
    def read_file_content(path):
        """Read content of a file."""
        print("read_file_content called")
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return {"success": True, "content": f.read()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @window.expose
    def save_file_content(path, content):
        """Save content to a file."""
        print("save_file_content called")
        try:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @window.expose
    def create_item(path, is_dir=False):
        """Create a new file or directory."""
        print(f"create_item called: {path}, is_dir={is_dir}")
        try:
            if is_dir:
                os.makedirs(path, exist_ok=True)
            else:
                with open(path, 'w', encoding='utf-8') as f:
                    pass # Create empty file
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @window.expose
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

    @window.expose
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
                text=True
            )
            stdout, stderr = process.communicate()
            
            return {
                "success": True,
                "stdout": stdout,
                "stderr": stderr,
                "returncode": process.returncode
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @window.expose
    def search_in_files(query, path="."):
        """Search for a string in files."""
        print(f"search_in_files called: {query}")
        try:
            if path == ".":
                path = os.getcwd()
            
            results = []
            for root, dirs, files in os.walk(path):
                if 'node_modules' in dirs:
                    dirs.remove('node_modules') # Skip node_modules
                if '.git' in dirs:
                    dirs.remove('.git')
                
                for file in files:
                    if file.endswith(('.py', '.js', '.jsx', '.css', '.html', '.json', '.md', '.txt')):
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                if query in content:
                                    # Find line number
                                    lines = content.split('\n')
                                    for i, line in enumerate(lines):
                                        if query in line:
                                            results.append({
                                                "file": file,
                                                "path": file_path,
                                                "line": i + 1,
                                                "content": line.strip()
                                            })
                                            if len(results) > 50: # Limit results
                                                break
                        except:
                            continue
                if len(results) > 50:
                    break
            
            return {"success": True, "results": results}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @window.expose
    def select_directory():
        """Open a directory selection dialog."""
        try:
            import tkinter as tk
            from tkinter import filedialog
            
            root = tk.Tk()
            root.withdraw() # Hide the main window
            root.attributes('-topmost', True) # Make sure dialog is on top
            
            path = filedialog.askdirectory()
            root.destroy()
            
            if path:
                return {"success": True, "path": path}
            else:
                return {"success": False, "error": "Cancelled"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @window.expose
    def ask_ai(query, context, path):
        """Mock AI response."""
        import time
        time.sleep(0.5) # Simulate thinking
        
        # Simple keyword matching for "crazy" effect
        response = "I'm just a simple mock AI for now, but I see you're asking about: " + query
        
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
            response = "Why do programmers prefer dark mode? Because light attracts bugs."
            
        return {"success": True, "response": response}

    @window.expose
    def get_git_status(path="."):
        """Get git status."""
        try:
            if path == ".":
                path = os.getcwd()

            # Get status
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False
            )
            
            if result.returncode != 0:
                 return {"success": False, "error": result.stderr}

            changes = []
            for line in result.stdout.splitlines():
                if len(line) < 4: continue
                status_code = line[:2]
                file_path = line[3:]
                changes.append({"file": file_path, "status": status_code})
                
            return {"success": True, "changes": changes}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @window.expose
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
                text=True
            )
            
            if result.returncode == 0:
                return {"success": True, "output": result.stdout}
            else:
                return {"success": False, "error": result.stderr}
        except Exception as e:
            return {"success": False, "error": str(e)}

    app.run()

if __name__ == '__main__':
    main()
