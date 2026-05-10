from langchain_core.tools import tool
import subprocess
import sys
import os

@tool
def ghost_run(command: str) -> str:
    """
    Runs a shell command resiliently. 
    If the command fails (non-zero exit code), this tool captures the error,
    analyzes if it's a missing package or simple syntax error, 
    and returns a structured 'Self-Healing' suggestion for the agent to act on.
    """
    print(f"[GhostRun] Executing: {command}")
    
    try:
        # Run the command and capture everything
        process = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True
        )
        
        if process.returncode == 0:
            return f"✅ Command Succeeded:\n{process.stdout}"
        
        # ANALYSIS PHASE
        stderr = process.stderr
        output = process.stdout
        combined = output + stderr
        
        suggestion = ""
        
        # 1. Check for missing modules
        if "ModuleNotFoundError" in stderr:
            import re
            match = re.search(r"No module named '([^']+)'", stderr)
            if match:
                missing_pkg = match.group(1)
                suggestion = f"\n👻 GHOST FIX DETECTED: It looks like '{missing_pkg}' is missing.\n👉 SUGGESTED ACTION: Call `execute_command` with `pip install {missing_pkg}`."

        # 2. Check for syntax errors
        elif "SyntaxError" in stderr:
             import re
             match = re.search(r"File \"([^\"]+)\", line (\d+)", stderr)
             if match:
                 file = match.group(1)
                 line = match.group(2)
                 suggestion = f"\n👻 GHOST FIX DETECTED: Syntax Error in {file} at line {line}.\n👉 SUGGESTED ACTION: Use `read_file` on {file} around line {line} to fix the typo."

        return f"❌ Command Failed (Exit Code {process.returncode}):\n{stderr}\n{suggestion}"

    except Exception as e:
        return f"Critical Error in GhostRun: {str(e)}"
