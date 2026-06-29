import os
from typing import List, Dict, Any, Optional
try:
    from langchain.agents import AgentExecutor, create_tool_calling_agent
except ImportError:
    from langchain_classic.agents import AgentExecutor, create_tool_calling_agent

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
import subprocess
from backend.services.model_manager import get_model_instance, get_available_models as get_manager_models
from backend.services import agent_tools
from backend.services.memory_manager import memory_manager
from backend.services.custom_tool_registry import registry as custom_tool_registry, CustomToolRegistry
import uuid
import threading
import difflib
import shutil

# Persistent history for rollbacks
BACKUP_DIR = os.path.join(os.getcwd(), ".tcode", "backups")

def generate_diff(path: str, old_content: str, new_content: str) -> str:
    """Generate a git-style diff between old and new content."""
    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)
    diff = difflib.unified_diff(old_lines, new_lines, fromfile=f"a/{path}", tofile=f"b/{path}")
    return "".join(diff)

def backup_file(path: str):
    """Save current state to .pytron/backups for rollback."""
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        abs_path = os.path.abspath(path)
        base_name = os.path.basename(abs_path)
        timestamp = uuid.uuid4().hex[:8]
        backup_path = os.path.join(BACKUP_DIR, f"{base_name}.{timestamp}.bak")
        
        state = {
            "original_path": abs_path,
            "backup_path": backup_path,
            "type": "modify" if os.path.exists(path) else "create",
            "timestamp": timestamp
        }
        
        if os.path.exists(path):
            shutil.copy2(path, backup_path)
        
        # Save state to index
        import json
        index_path = os.path.join(BACKUP_DIR, "index.json")
        history = []
        if os.path.exists(index_path):
            with open(index_path, "r") as f:
                history = json.load(f)
        
        history.append(state)
        with open(index_path, "w") as f:
            json.dump(history, f)
            
    except Exception as e:
        print(f"Backup failed: {e}")

@tool
def undo_last_change() -> str:
    """Roll back the very last file modification made by Agentic."""
    try:
        import json
        index_path = os.path.join(BACKUP_DIR, "index.json")
        if not os.path.exists(index_path):
            return "No history found."
            
        with open(index_path, "r") as f:
            history = json.load(f)
            
        if not history:
            return "No changes to undo."
            
        last = history.pop()
        path = last["original_path"]
        backup = last["backup_path"]
        
        if last["type"] == "create":
            if os.path.exists(path):
                os.remove(path)
                res = f"Undone creation of {path}."
            else: res = f"File {path} already gone."
        else:
            if os.path.exists(backup):
                shutil.copy2(backup, path)
                os.remove(backup)
                res = f"Restored {path} from backup."
            else: res = f"Backup file {backup} not found."
            
        # Update index
        with open(index_path, "w") as f:
            json.dump(history, f)
            
        return res
    except Exception as e:
        return f"Rollback failed: {str(e)}"

# Define Tools for the AI
@tool
def read_file(path: str, start_line: int = None, end_line: int = None) -> str:
    """Read the content of a file at the given path. Optionally provide start_line and end_line (1-based index) to read specific lines. Use this to save context limits on huge files."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            if start_line is None and end_line is None:
                return f.read()
            lines = f.readlines()
            start = max(0, (start_line or 1) - 1)
            end = len(lines) if end_line is None else end_line
            return "".join(lines[start:end])
    except Exception as e:
        return f"Error reading file: {str(e)}"

@tool
def write_file(path: str, content: str) -> str:
    """Create a new file or overwrite an existing one with the given content."""
    from backend.services.ai_service import ai_service_instance
    try:
        old_content = ""
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                old_content = f.read()
        
        diff = generate_diff(path, old_content, content)
        
        if ai_service_instance:
            allowed = ai_service_instance.ask_confirmation(f"Requesting to write {path}", diff=diff)
            if not allowed:
                return "Modification cancelled by user."
        
        backup_file(path)
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote to {path}"
    except Exception as e:
        return f"Error writing file: {str(e)}"

@tool
def delete_file(path: str) -> str:
    """Delete a file or directory at the given path."""
    try:
        if os.path.isdir(path):
            import shutil
            shutil.rmtree(path)
            return f"Successfully deleted directory {path}"
        else:
            os.remove(path)
            return f"Successfully deleted file {path}"
    except Exception as e:
        return f"Error deleting: {str(e)}"

@tool
def move_file(src: str, dst: str) -> str:
    """Move or rename a file/directory from src to dst."""
    try:
        os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
        os.rename(src, dst)
        return f"Successfully moved {src} to {dst}"
    except Exception as e:
        return f"Error moving: {str(e)}"

@tool
def list_directory(path: str = ".") -> str:
    """List files and directories in a given path."""
    try:
        items = os.listdir(path)
        return "\n".join(items)
    except Exception as e:
        return f"Error listing directory: {str(e)}"

@tool
def execute_command(command: str) -> str:
    """Execute a shell command and return the output. Use with caution.
    NOTE: For listing files, ALWAYS use 'list_directory' instead - it's 10x faster.
    NOTE: Commands must be non-interactive (e.g., use -y or --yes).
    Long running commands might time out after 60 seconds.
    """
    from backend.services.ai_service import ai_service_instance
    try:
        # Use a more efficient way to run commands
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Track process for interruption
        if ai_service_instance:
            ai_service_instance.current_process = process
            
        try:
            stdout, stderr = process.communicate(timeout=60)
            return f"STDOUT:\n{stdout}\nSTDERR:\n{stderr}"
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            return f"Error: Command timed out after 60 seconds. STDOUT so far:\n{stdout}"
        finally:
            if ai_service_instance:
                ai_service_instance.current_process = None
                
    except Exception as e:
        return f"Error executing command: {str(e)}"

@tool
def get_project_map(depth: int = 2) -> str:
    """Get a visual tree map of the project structure to understand where files are located."""
    return agent_tools.get_project_map(depth=depth)

@tool
def advanced_search(pattern: str, file_ext: Optional[str] = None) -> str:
    """Search for a regex pattern across all project files. Useful for finding code usages or definitions."""
    return agent_tools.search_code(pattern, file_ext=file_ext)

@tool
def apply_patch(path: str, search_block: str, replace_block: str) -> str:
    """Surgically replace a block of code in a file. Use this for precise edits instead of overwriting the whole file."""
    from backend.services.ai_service import ai_service_instance
    try:
        if not os.path.exists(path):
            return f"Error: File not found at {path}"
            
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        try:
            new_content = agent_tools.fuzzy_apply_patch(content, search_block, replace_block)
        except Exception as e:
            return f"Error: Could not find matching code block. {str(e)}"
            
        diff = generate_diff(path, content, new_content)
        
        if ai_service_instance:
            allowed = ai_service_instance.ask_confirmation(f"Requesting to patch {path}", diff=diff)
            if not allowed:
                return "Patch cancelled by user."
        
        backup_file(path)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return f"Successfully applied patch to {path}."
    except Exception as e:
        return f"Patch Error: {str(e)}"

@tool
def git_status() -> str:
    """Get current git status (modified files, staged changes)."""
    return agent_tools.git_status()

@tool
def git_diff(staged: bool = False) -> str:
    """Get the visual diff of current changes. Set staged=True to see cached changes."""
    return agent_tools.git_diff(cached=staged)

@tool
def git_log(n: int = 5) -> str:
    """Get the last n git commits to understand the recent history of the project."""
    return agent_tools.git_log(n=n)

@tool
def memorize(text: str) -> str:
    """Save important information or project facts to long-term memory."""
    return memory_manager.add_memory(text)

@tool
def read_directory_context(path: str, recursive: bool = False, depth: int = 1) -> str:
    """Summarize the contents of a directory to understand the project structure better."""
    return agent_tools.read_directory_context(path, recursive=recursive, depth=depth)

@tool
def recall(query: str) -> str:
    """Search long-term memory for previously saved information or project facts."""
    results = memory_manager.search(query)
    if not results:
        return "No relevant memories found."
    return "\n---\n".join([r["content"] for r in results])

@tool
def read_notebook(path: str) -> str:
    """Read all cells and execution history of the Jupyter notebook (.ipynb) at the given path."""
    import json
    try:
        if not os.path.exists(path):
            return f"Error: Notebook not found at {path}"
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        cells_summary = []
        for i, cell in enumerate(data.get("cells", [])):
            cell_type = cell.get("cell_type", "code")
            source = "".join(cell.get("source", []))
            outputs = cell.get("outputs", [])
            output_summary = []
            for out in outputs:
                if out.get("output_type") == "stream":
                    output_summary.append("".join(out.get("text", [])))
                elif out.get("output_type") == "error":
                    output_summary.append("".join(out.get("traceback", [])))
                elif out.get("output_type") in ["display_data", "execute_result"]:
                    output_summary.append(str(out.get("data", {}).get("text/plain", "")))
            
            summary = f"Cell {i} [{cell_type}]:\nSource:\n{source}\n"
            if output_summary:
                summary += f"Output:\n{''.join(output_summary)}\n"
            summary += "---"
            cells_summary.append(summary)
        return "\n".join(cells_summary)
    except Exception as e:
        return f"Error reading notebook: {str(e)}"

@tool
def write_notebook_cell(path: str, cell_index: int, source_code: str) -> str:
    """Overwrite the content of an existing cell at cell_index in the notebook at the given path."""
    import json
    try:
        if not os.path.exists(path):
            return f"Error: Notebook not found at {path}"
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        cells = data.get("cells", [])
        if cell_index < 0 or cell_index >= len(cells):
            return f"Error: Cell index {cell_index} is out of bounds. Notebook has {len(cells)} cells."
            
        lines = source_code.splitlines()
        source_lines = [line + "\n" for line in lines[:-1]] + ([lines[-1]] if lines else [])
        cells[cell_index]["source"] = source_lines
        cells[cell_index]["outputs"] = []
        cells[cell_index]["execution_count"] = None
        
        data["cells"] = cells
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1)
            
        # Emit event to notify frontend to reload notebook
        try:
            from backend.api.system import global_app
            if global_app:
                global_app.emit("notebook:reload", {"path": path})
        except Exception:
            pass
            
        return f"Successfully modified cell {cell_index} in notebook {path}."
    except Exception as e:
        return f"Error modifying cell: {str(e)}"

@tool
def add_notebook_cell(path: str, cell_type: str, source_code: str, cell_index: Optional[int] = None) -> str:
    """Add a new cell of cell_type ('code' or 'markdown') to the notebook at path. Optionally specify a cell_index to insert, default is append at the end."""
    import json
    try:
        if not os.path.exists(path):
            return f"Error: Notebook not found at {path}"
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        cells = data.get("cells", [])
        
        lines = source_code.splitlines()
        source_lines = [line + "\n" for line in lines[:-1]] + ([lines[-1]] if lines else [])
        
        new_cell = {
            "cell_type": cell_type,
            "metadata": {},
            "source": source_lines
        }
        if cell_type == "code":
            new_cell["outputs"] = []
            new_cell["execution_count"] = None
            
        if cell_index is None:
            cells.append(new_cell)
            new_idx = len(cells) - 1
        else:
            idx = max(0, min(len(cells), cell_index))
            cells.insert(idx, new_cell)
            new_idx = idx
            
        data["cells"] = cells
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1)
            
        # Emit event to notify frontend to reload notebook
        try:
            from backend.api.system import global_app
            if global_app:
                global_app.emit("notebook:reload", {"path": path})
        except Exception:
            pass
            
        return f"Successfully added {cell_type} cell at index {new_idx} to notebook {path}."
    except Exception as e:
        return f"Error adding cell: {str(e)}"

@tool
def run_notebook_cell(path: str, cell_index: int) -> str:
    """Run the cell at cell_index in the notebook at path using the persistent interactive python kernel."""
    import json
    try:
        if not os.path.exists(path):
            return f"Error: Notebook not found at {path}"
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        cells = data.get("cells", [])
        if cell_index < 0 or cell_index >= len(cells):
            return f"Error: Cell index {cell_index} is out of bounds."
            
        cell = cells[cell_index]
        if cell.get("cell_type") != "code":
            return "Error: Cannot execute a non-code cell."
            
        code = "".join(cell.get("source", []))
        
        from backend.api.system import global_app, kernel
        if not global_app:
            return "Error: Pytron app instance is not ready."
            
        # Clear previous outputs for this cell in JS if needed
        global_app.emit("notebook:clear", {"cell_id": cell_index, "path": path})
        
        # Execute using backend kernel and stream output
        success = kernel.execute(cell_index, code, global_app, path=path)
        
        if success:
            return f"Cell {cell_index} executed successfully."
        else:
            return f"Cell {cell_index} execution failed."
    except Exception as e:
        return f"Error running cell: {str(e)}"

class AIService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.on_event = None
        self.pending_confirmations = {}
        self.interrupted = False
        self.current_process = None
        self.tools = [
            read_file, write_file, delete_file, move_file,
            list_directory, execute_command,
            get_project_map, advanced_search, apply_patch,
            git_status, git_diff, git_log, memorize, recall,
            read_directory_context, undo_last_change,
            read_notebook, write_notebook_cell, add_notebook_cell, run_notebook_cell
        ]
        
        # Load custom tools
        try:
            custom_tools = custom_tool_registry.load_tools()
            self.tools.extend(custom_tools)
            print(f"Loaded {len(custom_tools)} custom agent tools.")
        except Exception as e:
            print(f"Error loading custom tools: {e}")

    def interrupt(self):
        """Interrupt current agent execution."""
        self.interrupted = True
        if self.current_process:
            try:
                print(f"[AIService] Killing current process...")
                self.current_process.kill()
            except:
                pass

    def _emit(self, event_type, data):
        if self.on_event:
            self.on_event(event_type, data)

    def ask_confirmation(self, message: str, diff: str = None, confirm_id: str = None) -> bool:
        """Emits a confirmation event to the UI and waits for the user response."""
        if not self.on_event:
            return True # Auto-approve if no handler
            
        confirm_id = confirm_id or str(uuid.uuid4())
        event = threading.Event()
        self.pending_confirmations[confirm_id] = {"event": event, "answer": False}
        
        self._emit("confirm_required", {
            "id": confirm_id, 
            "message": message,
            "diff": diff
        })
        
        # Wait up to 2 minutes for user response
        if event.wait(timeout=120):
            return self.pending_confirmations[confirm_id]["answer"]
        return False

    def handle_confirmation(self, confirm_id: str, answer: bool):
        if confirm_id in self.pending_confirmations:
            self.pending_confirmations[confirm_id]["answer"] = answer
            self.pending_confirmations[confirm_id]["event"].set()
            return True
        return False

    def get_available_models(self) -> List[Dict[str, str]]:
        models = get_manager_models()
        return [{"id": m, "name": m} for m in models]

    async def run_agent_stream(self, prompt: str, model_id: str = "gemini-2.0-flash", history: List[Any] = []):
        """Streaming turn with RAG and Auto-Logging."""
        try:
            is_local = model_id.endswith(('.gguf', '.bin'))
            
            # Detect size using regex (e.g., 1.5b, 3b, 7b)
            import re
            size_match = re.search(r'(\d+(?:\.\d+)?)[Bb]', model_id)
            model_size = float(size_match.group(1)) if size_match else 7.0 # Assume 7B if unknown
            
            is_tiny = model_size <= 10 or any(x in model_id.lower() for x in ['phi', 'tiny', 'mini', 'stablelm'])
            
            # 0. Optional RAG: Fetch relevant project context
            # Skip RAG for tiny models to preserve their limited context window
            context_snippet = ""
            if not is_tiny:
                memories = await memory_manager.search(prompt, k=2 if is_local else 3)
                if memories:
                    context_snippet = "\n\n### PROJECT CONTEXT\n" + \
                        "\n".join([f"- {m['content']}" for m in memories])
            
            # 1. Prepare chat history
            if is_tiny:
                # Ultra-lite mode for models < 3B parameters
                system_content = f"You are Agentic, an IDE helper. Be very brief. To use tools, output: <tool_call> {{\"name\": \"...\", \"arguments\": {{...}}}} </tool_call>. {context_snippet}"
                history = history[-4:] # Only last 4 messages for tiny models
            elif is_local:
                # Compressed prompt for local models to reduce prefill time
                system_content = f"You are Agentic, an IDE Assistant. Be concise. To use a tool, output exactly: <tool_call> {{\"name\": \"tool_name\", \"arguments\": {{...}}}} </tool_call>. {context_snippet}"
            else:
                system_content = f"""
### IDENTITY
You are Agentic, an Autonomous Engineering Assistant within the TerminateCode IDE.

### CORE PROTOCOLS
1. **THINK FIRST**: Always start your response with a concise <think> block. Analyze the request and plan efficiently.
2. **SITUATIONAL AWARENESS**: Use tools like `get_project_map` before assuming.
3. **NON-INTERACTIVE**: Use -y/--yes for commands.
4. **OPERATIONS**: Use `apply_patch` for surgical edits.
{context_snippet}
"""
            system_msg = AIMessage(content=system_content)
            messages = [system_msg]
            
            for msg in history:
                if isinstance(msg, dict):
                    role = msg.get("role")
                    content = msg.get("content", "")
                    if role == "user":
                        messages.append(HumanMessage(content=content))
                    elif role == "assistant":
                        messages.append(AIMessage(content=content))
                else:
                    messages.append(msg)
            
            messages.append(HumanMessage(content=prompt))

            # 2. Get LLM and bind tools
            llm = get_model_instance(model_id)
            model_with_tools = llm.bind_tools(self.tools)

            # 3. Execution Loop
            for i in range(10): # Relaxed limit for complex tasks
                if self.interrupted:
                    yield {"type": "token", "content": "\n\n[Interrupted by user]"}
                    break

                print(f"DEBUG: Agent Loop Round {i+1}")
                
                full_content = ""
                last_response = None
                
                # Stream the current turn
                async for chunk in model_with_tools.astream(messages):
                    if self.interrupted:
                        break

                    last_response = chunk if last_response is None else last_response + chunk
                    
                    if chunk.content:
                        # Extract text
                        text = ""
                        if isinstance(chunk.content, list):
                            text = "".join([c.get("text", "") for c in chunk.content if isinstance(c, dict) and "text" in c])
                        else:
                            text = str(chunk.content)
                        
                        if text:
                            # For some models/adapters, chunk.content might contain the full accumulated text.
                            # We ensure we only yield the new delta to prevent tokens appearing multiple times.
                            if full_content and text.startswith(full_content):
                                delta = text[len(full_content):]
                            else:
                                delta = text
                                
                            if delta:
                                full_content += delta
                                yield {"type": "token", "content": delta}
                
                if self.interrupted or not last_response:
                    break
                    
                messages.append(last_response)
                
                # 4. Handle Tool Calls
                tool_calls = list(last_response.tool_calls) if hasattr(last_response, 'tool_calls') else []
                
                # Manual parsing for models that don't support native tool calling (XML-style)
                if not tool_calls and "<tool_call>" in full_content:
                    import re
                    import json
                    matches = re.findall(r"<tool_call>(.*?)</tool_call>", full_content, re.DOTALL)
                    for m in matches:
                        try:
                            # Clean up potential markdown code blocks inside
                            m_clean = re.sub(r"^```json\n?", "", m.strip())
                            m_clean = re.sub(r"\n?```$", "", m_clean)
                            data = json.loads(m_clean)
                            tool_calls.append({
                                "name": data.get("name"),
                                "args": data.get("arguments") or data.get("args") or {},
                                "id": f"manual_{uuid.uuid4().hex[:8]}"
                            })
                        except Exception as e:
                            print(f"DEBUG: Failed to parse manual tool call: {e}")
                
                if not tool_calls:
                    print("DEBUG: No tool calls, ending loop.")
                    break
                    
                for tool_call in tool_calls:
                    if self.interrupted:
                        break

                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call.get("id") or str(uuid.uuid4())
                    
                    print(f"DEBUG: Tool Call: {tool_name}")
                    
                    # Yield event to be emitted by the API layer
                    yield {"type": "tool_call", "name": tool_name, "args": tool_args, "id": tool_id}

                    # Confirmation check
                    if tool_name in ["execute_command", "delete_file"]:
                        allowed = self.ask_confirmation(f"Allow {tool_name}?", confirm_id=tool_id)
                        if not allowed:
                            res_msg = ToolMessage(content="Cancelled by user.", tool_call_id=tool_id)
                            messages.append(res_msg)
                            yield {"type": "tool_result", "name": tool_name, "result": "Cancelled", "id": tool_id}
                            continue

                    # Execute
                    tool_func = next((t for t in self.tools if t.name == tool_name), None)
                    if tool_func:
                        try:
                            # Run tool
                            result = tool_func.invoke(tool_args)
                            res_str = str(result)
                            
                            # 5. Auto-Logging: Record successful changes to Knowledge Base
                            if tool_name in ["apply_patch", "execute_command", "write_file"] and "Successfully" in res_str:
                                summary = f"Changed {tool_args.get('path', 'codebase')}: {prompt[:50]}..."
                                await memory_manager.add_memory(summary, metadata={"tool": tool_name})
                                
                            messages.append(ToolMessage(content=res_str, tool_call_id=tool_id))
                            yield {"type": "tool_result", "name": tool_name, "result": res_str, "id": tool_id}
                        except Exception as te:
                            err_str = f"Error: {te}"
                            messages.append(ToolMessage(content=err_str, tool_call_id=tool_id))
                            yield {"type": "tool_result", "name": tool_name, "result": err_str, "id": tool_id}
                    else:
                        err_str = f"Error: Tool {tool_name} not found."
                        messages.append(ToolMessage(content=err_str, tool_call_id=tool_id))
                        yield {"type": "tool_result", "name": tool_name, "result": err_str, "id": tool_id}

        except Exception as e:
            print(f"Agent Loop Error: {e}")
            import traceback
            traceback.print_exc()
            
            err_msg = str(e)
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                yield {
                    "type": "error", 
                    "content": "⚠️ **Quota Exceeded**: I've reached the Gemini API rate limit. Please try again in 30 seconds or switch to a different model in Settings."
                }
            else:
                yield {"type": "error", "content": f"AI Error: {err_msg}"}
        finally:
            self.interrupted = False

    def run_agent(self, prompt: str, model_id: str = "gemini-2.0-flash", history: List[Any] = []) -> str:
        """
        Legacy synchronous wrapper. For real streaming, use run_agent_stream with an async loop.
        """
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        full_res = ""
        async def run():
            nonlocal full_res
            async for chunk in self.run_agent_stream(prompt, model_id, history):
                if chunk["type"] == "token":
                    full_res += chunk["content"]
        
        loop.run_until_complete(run())
        return full_res

ai_service_instance = None
active_ai_service_instance = None

def get_active_ai_service():
    return active_ai_service_instance

def get_ai_service(api_key: str) -> AIService:
    global ai_service_instance, active_ai_service_instance
    if ai_service_instance is None or ai_service_instance.api_key != api_key:
        ai_service_instance = AIService(api_key)
    active_ai_service_instance = ai_service_instance
    return ai_service_instance
