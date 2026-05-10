import json
import os
import hashlib

def _get_workspace_key(path=None):
    """Generate a unique key for the current working directory or a specific path."""
    cwd = path or os.getcwd()
    cwd_hash = hashlib.md5(cwd.encode()).hexdigest()[:8]
    return f"workspace_state_{cwd_hash}"

def register_workspace_routes(app):
    """
    Routes for persisting and retrieving workspace/session state.
    Uses Pytron's built-in store_set/store_get for multi-session persistence.
    """

    @app.expose
    def save_workspace_state(state):
        """Save workspace state (key tied to current directory)."""
        try:
            key = _get_workspace_key()
            app.store_set(key, json.dumps(state))
            # Also update global workspaces index
            workspaces_key = "global_workspaces_index"
            workspaces_json = app.store_get(workspaces_key)
            workspaces = json.loads(workspaces_json) if workspaces_json else {}
            
            project_path = os.getcwd()
            workspaces[project_path] = {
                "path": project_path,
                "name": os.path.basename(project_path),
                "last_accessed": __import__('time').time()
            }
            app.store_set(workspaces_key, json.dumps(workspaces))
            
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def list_workspaces():
        """Get a list of all known workspaces."""
        try:
            workspaces_key = "global_workspaces_index"
            workspaces_json = app.store_get(workspaces_key)
            if workspaces_json:
                return {"success": True, "workspaces": json.loads(workspaces_json)}
            return {"success": True, "workspaces": {}}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def load_workspace_state():
        """Retrieve the last saved workspace state for the CURRENT directory."""
        try:
            key = _get_workspace_key()
            state_json = app.store_get(key)
            if state_json:
                return {"success": True, "state": json.loads(state_json)}
            return {"success": True, "state": None}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def save_chat_session(session_id, messages, title=None):
        """Save a specific chat session for this workspace."""
        try:
            ws_key = _get_workspace_key()
            sessions_key = f"{ws_key}_sessions"
            
            # Load index
            sessions_json = app.store_get(sessions_key)
            sessions = json.loads(sessions_json) if sessions_json else {}
            
            import time
            # Update/Add session
            sessions[session_id] = {
                "id": session_id,
                "title": title or (messages[0]["content"][:30] + "..." if messages else "New Chat"),
                "timestamp": time.time()
            }
            
            # Save index and separate session blob
            app.store_set(sessions_key, json.dumps(sessions))
            app.store_set(f"chat_{session_id}", json.dumps(messages))
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def list_chat_sessions():
        """List all chat sessions for the current workspace."""
        try:
            ws_key = _get_workspace_key()
            sessions_json = app.store_get(f"{ws_key}_sessions")
            if sessions_json:
                return {"success": True, "sessions": json.loads(sessions_json)}
            return {"success": True, "sessions": {}}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def load_chat_session(session_id):
        """Load specific messages for a session."""
        try:
            msg_json = app.store_get(f"chat_{session_id}")
            if msg_json:
                return {"success": True, "messages": json.loads(msg_json)}
            return {"success": False, "error": "Not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def delete_chat_session(session_id):
        """Remove a specific chat session."""
        try:
            ws_key = _get_workspace_key()
            sessions_key = f"{ws_key}_sessions"
            sessions_json = app.store_get(sessions_key)
            if sessions_json:
                sessions = json.loads(sessions_json)
                if session_id in sessions:
                    del sessions[session_id]
                    app.store_set(sessions_key, json.dumps(sessions))
            app.store_set(f"chat_{session_id}", None)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
