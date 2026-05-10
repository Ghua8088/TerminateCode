from langchain_core.tools import tool
import os

@tool
def install_python_package(package_name: str) -> str:
    """Installs a python package in the current environment using pip."""
    try:
        import subprocess
        import sys
        
        # We use the currently running python executable to ensure we install in the right env
        executable = sys.executable
        
        process = subprocess.run(
            [executable, "-m", "pip", "install", package_name],
            capture_output=True,
            text=True
        )
        
        if process.returncode == 0:
            return f"Successfully installed {package_name}"
        else:
            return f"Failed to install {package_name}:\n{process.stderr}"
    except Exception as e:
        return f"Error installing package: {e}"

@tool
def create_custom_tool_ui(tool_name: str, react_component_code: str) -> str:
    """
    Creates a new UI Panel inside the IDE for a specific tool.
    This allows the IDE to evolve and gain new GUI features requested by the user.
    """
    try:
        # Sanitize name
        safe_name = "".join(x for x in tool_name if x.isalnum())
        component_path = os.path.join("frontend", "src", "components", "custom_panels", f"{safe_name}.jsx")
        
        os.makedirs(os.path.dirname(component_path), exist_ok=True)
        
        with open(component_path, "w", encoding="utf-8") as f:
            f.write(react_component_code)
            
        # Register in the main panel registry (simplified for PoC)
        # We would append to a JSON registry or re-write the index file
        
        return f"Created custom UI panel at {component_path}. You would need to reload the UI to see it fully registered."
    except Exception as e:
        return f"Error creating UI: {e}"
