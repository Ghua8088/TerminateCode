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
import uuid
import threading

# Define Tools for the AI
@tool
def read_file(path: str) -> str:
    """Read the content of a file at the given path."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"

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
    """Execute a shell command and return the output. Use with caution."""
    # We'll handle confirmation inside AIService run loop for better context
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        return f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
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
    return agent_tools.apply_patch(path, search_block, replace_block)

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

class AIService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.on_event = None
        self.pending_confirmations = {}
        self.tools = [
            read_file, list_directory, execute_command,
            get_project_map, advanced_search, apply_patch,
            git_status, git_diff, git_log, memorize, recall,
            read_directory_context
        ]

    def _emit(self, event_type, data):
        if self.on_event:
            self.on_event(event_type, data)

    def ask_confirmation(self, message: str) -> bool:
        """Emits a confirmation event to the UI and waits for the user response."""
        if not self.on_event:
            return True # Auto-approve if no handler
            
        confirm_id = str(uuid.uuid4())
        event = threading.Event()
        self.pending_confirmations[confirm_id] = {"event": event, "answer": False}
        
        self._emit("confirm_required", {"id": confirm_id, "message": message})
        
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
            # 0. Optional RAG: Fetch relevant project context
            memories = await memory_manager.search(prompt, k=3)
            context_snippet = ""
            if memories:
                context_snippet = "\n\n### RELEVANT PROJECT CONTEXT (RAG)\n" + \
                    "\n".join([f"- {m['content']} (from {m['timestamp'][:10]})" for m in memories])
            # 1. Prepare chat history
            system_msg = AIMessage(content=f"""
### IDENTITY
You are Agentic, an Autonomous Engineering Assistant within the TerminateCode IDE.

### CORE PROTOCOLS
1. **THINK FIRST**: Always start your response with a `<think>` block where you analyze the user's request, plan your steps, and identify which tools to use.
2. **SITUATIONAL AWARENESS**: Before making assumptions, use `get_project_map` or `read_file`.
3. **PRECISION EDITS**: Use `apply_patch` for surgical code changes.
4. **CONTINUITY**: You have access to a Knowledge Base of past changes. Use it to maintain consistency.{context_snippet}

### MISSION
Your goal is to build and maintain the project with precision.
""")
            messages = [system_msg]
            
            for msg in history:
                if isinstance(msg, dict):
                    role = msg.get("role")
                    content = msg.get("content", "")
                    if role == "user":
                        messages.append(HumanMessage(content=content))
                    elif role == "assistant":
                        # Convert cached message to AIMessage object
                        # If it has tool calls in metadata, we'd ideally reconstruct them
                        messages.append(AIMessage(content=content))
                else:
                    messages.append(msg)
            
            messages.append(HumanMessage(content=prompt))

            # 2. Get LLM and bind tools
            llm = get_model_instance(model_id)
            model_with_tools = llm.bind_tools(self.tools)

            # 3. Execution Loop
            for i in range(10): # Relaxed limit for complex tasks
                print(f"DEBUG: Agent Loop Round {i+1}")
                
                full_content = ""
                last_response = None
                
                # Stream the current turn
                async for chunk in model_with_tools.astream(messages):
                    last_response = chunk if last_response is None else last_response + chunk
                    
                    if chunk.content:
                        # Extract text if content is a list (some models return parts)
                        text = ""
                        if isinstance(chunk.content, list):
                            text = "".join([c.get("text", "") for c in chunk.content if isinstance(c, dict) and "text" in c])
                        else:
                            text = str(chunk.content)
                        
                        if text:
                            full_content += text
                            yield {"type": "token", "content": text}
                
                if not last_response:
                    break
                    
                messages.append(last_response)
                
                # 4. Handle Tool Calls
                if not last_response.tool_calls:
                    print("DEBUG: No tool calls, ending loop.")
                    break
                    
                for tool_call in last_response.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call.get("id") or str(uuid.uuid4())
                    
                    print(f"DEBUG: Tool Call: {tool_name}")
                    
                    # Yield event to be emitted by the API layer
                    yield {"type": "tool_call", "name": tool_name, "args": tool_args, "id": tool_id}

                    # Confirmation check
                    if tool_name in ["execute_command", "apply_patch"]:
                        allowed = self.ask_confirmation(f"Allow {tool_name}?")
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
                            if tool_name in ["apply_patch", "execute_command"] and "Successfully" in res_str:
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
            # End of response marker if needed
            pass

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

def get_ai_service(api_key: str) -> AIService:
    global ai_service_instance
    if ai_service_instance is None or ai_service_instance.api_key != api_key:
        ai_service_instance = AIService(api_key)
    return ai_service_instance
