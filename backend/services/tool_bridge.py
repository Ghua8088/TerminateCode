import os
import sys
import json
import subprocess
import shutil

class ToolBridge:
    def __init__(self):
        # Determine the external python executable to use.
        # In a real app, this should come from user settings.
        # Fallback to system 'python' or 'python3'.
        self.python_executable = shutil.which("python") or shutil.which("python3")
        
    def run_tool(self, script_path: str, func_name: str, args: dict) -> str:
        """
        Runs a specific function in a python script using an external python process.
        This ensures tool dependencies don't crash the main frozen app.
        """
        if not self.python_executable:
            return "Error: No external Python interpreter found. Please install Python to use custom tools."

        # Create a runner script that imports the user's script and runs the function
        # We assume the user script is importable (i.e., in a valid module path or we add it)
        script_dir = os.path.dirname(script_path)
        script_module = os.path.basename(script_path).replace('.py', '')
        
        # We serialize args to JSON to pass them safely
        args_json = json.dumps(args)
        
        runner_code = f"""
import sys
import os
import json
import traceback

# Add script dir to sys.path so we can import the module
sys.path.insert(0, r'{script_dir}')

try:
    import {script_module}
    
    # Locate the function
    if not hasattr({script_module}, '{func_name}'):
        print(f"Error: Function '{func_name}' not found in {script_module}", file=sys.stderr)
        sys.exit(1)
        
    func = getattr({script_module}, '{func_name}')
    
    # Parse arguments
    args = json.loads(r'''{args_json}''')
    
    # Call the function
    # We support functions that take kwargs or specific args
    # For simplicity in this bridge, we assume the tool handles the args passed as dict
    # OR we unpack if the signature matches. 
    # Let's try to unpack assuming the keys match argument names.
    
    result = func(**args)
    
    # Print result to stdout for capture
    print(str(result))

except Exception as e:
    traceback.print_exc()
    sys.exit(1)
"""
        try:
            # Run the runner code via subprocess
            process = subprocess.run(
                [self.python_executable, "-c", runner_code],
                capture_output=True,
                text=True,
                cwd=script_dir  # Run in the tool's directory
            )
            
            if process.returncode != 0:
                return f"Tool Execution Error:\n{process.stderr}"
                
            return process.stdout.strip()
            
        except Exception as e:
            return f"Bridge Error: {str(e)}"

# Singleton
bridge = ToolBridge()
