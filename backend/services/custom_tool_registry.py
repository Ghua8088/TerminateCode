import os
import sys
import importlib.util
import inspect
from typing import List, Any

# Ensure langchain_core is available or fallback
try:
    from langchain_core.tools import BaseTool, tool
except ImportError:
    try:
        from langchain.tools import BaseTool, tool
    except ImportError:
        # Define a minimal mock if absolutely necessary, but preferably fail
        class BaseTool: pass
        def tool(func): return func

class CustomToolRegistry:
    def __init__(self, tools_dir: str = "user_tools"):
        # Make the path absolute relative to project root if needed
        if not os.path.isabs(tools_dir):
            self.tools_dir = os.path.join(os.getcwd(), tools_dir)
        else:
            self.tools_dir = tools_dir
            
        self.loaded_tools: List[Any] = []

    def load_tools(self) -> List[Any]:
        """Scans the tools directory and loads any functions decorated with @tool."""
        self.loaded_tools = []
        
        if not os.path.exists(self.tools_dir):
            try:
                os.makedirs(self.tools_dir, exist_ok=True)
                # Create a README
                readme_path = os.path.join(self.tools_dir, "README.md")
                if not os.path.exists(readme_path):
                    with open(readme_path, "w") as f:
                        f.write("# User Custom Tools\\n\\nPlace your python scripts here.\\nAny function decorated with `@tool` from `langchain_core.tools` will be automatically loaded by the AI agent.\\n\\nExample:\\n```python\\nfrom langchain_core.tools import tool\\n\\n@tool\\ndef my_custom_tool(arg: str) -> str:\\n    \"\"\"Description of what the tool does.\"\"\"\\n    return f'Processed {arg}'\\n```")
            except Exception as e:
                print(f"Error creating tools dir: {e}")
                return []

        print(f"Scanning for custom tools in: {self.tools_dir}")

        for filename in os.listdir(self.tools_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                filepath = os.path.join(self.tools_dir, filename)
                try:
                    module_name = f"user_tools_{filename[:-3]}"
                    spec = importlib.util.spec_from_file_location(module_name, filepath)
                    if spec and spec.loader:
                        module = importlib.util.module_from_spec(spec)
                        if module:
                            spec.loader.exec_module(module)
                            
                            # Inspect module for tools
                            # 1. Check for BaseTool instances
                            # 2. Check for functions decorated with @tool (which have .name, .description, .args)
                            count = 0
                            for name, obj in inspect.getmembers(module):
                                is_tool = False
                                if isinstance(obj, BaseTool):
                                    is_tool = True
                                elif hasattr(obj, "name") and hasattr(obj, "description") and hasattr(obj, "args"):
                                    # Very likely a LangChain structured tool
                                    is_tool = True
                                
                                if is_tool:
                                     # Avoid duplicate tool names to prevent conflicts
                                     if not any(t.name == obj.name for t in self.loaded_tools):
                                        print(f"Loaded custom tool: {obj.name} from {filename}")
                                        self.loaded_tools.append(obj)
                                        count += 1
                            if count == 0:
                                print(f"No tools found in {filename}")

                except ImportError as ie:
                    print(f"Import failed for {filename} (probably missing dependency): {ie}. This is expected in frozen environments if dep is missing.")
                    # TODO: Implement ToolBridge (Process Isolation) here.
                except Exception as e:
                    print(f"Failed to load custom tool from {filename}: {e}")

        return self.loaded_tools

# Singleton instance
registry = CustomToolRegistry()
