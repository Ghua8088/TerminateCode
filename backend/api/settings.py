try:
    import keyring
except ImportError:
    keyring = None

_KEYRING_SERVICE = "TerminateCode"
_KEYRING_KEYS = {
    "google": "google_api_key",
    "openai": "openai_api_key",
    "anthropic": "anthropic_api_key"
}

# In-memory storage for API keys (fallback)
_server_api_keys = {"google": None, "openai": None, "anthropic": None}

def get_stored_api_key(provider="google"):
    """Retrieve API key from keyring or memory."""
    try:
        user_key = _KEYRING_KEYS.get(provider)
        if keyring is not None and user_key:
            stored = keyring.get_password(_KEYRING_SERVICE, user_key)
            if stored:
                return stored
    except Exception:
        pass
    return _server_api_keys.get(provider)

def register_settings_routes(app):

    @app.expose
    def set_api_key(api_key: str, provider: str = "google"):
        """Store the provided API key in-memory on the backend for subsequent AI calls."""
        try:
            if not provider in _KEYRING_KEYS:
                return {"success": False, "error": "Invalid provider"}
                
            user_key = _KEYRING_KEYS[provider]
            
            # Attempt to persist to OS keyring when available
            if keyring is not None:
                try:
                    keyring.set_password(_KEYRING_SERVICE, user_key, api_key)
                except Exception:
                    # fall back to in-memory if keyring fails
                    _server_api_keys[provider] = api_key
            else:
                _server_api_keys[provider] = api_key
            # Update model manager's in-memory cache for immediate sync
            try:
                from backend.services.model_manager import set_api_key_in_manager
                set_api_key_in_manager(provider, api_key)
            except Exception:
                pass

            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def clear_api_key(provider: str = "google"):
        """Clear stored API key."""
        try:
            if not provider in _KEYRING_KEYS:
                return {"success": False, "error": "Invalid provider"}
                
            user_key = _KEYRING_KEYS[provider]
            
            if keyring is not None:
                try:
                    keyring.delete_password(_KEYRING_SERVICE, user_key)
                except Exception:
                    pass
            _server_api_keys[provider] = None
            # Update model manager
            try:
                from backend.services.model_manager import set_api_key_in_manager
                set_api_key_in_manager(provider, None)
            except Exception:
                pass

            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def get_api_key_status(provider: str = "google"):
        """Return whether an API key is present (masked)."""
        try:
            k = get_stored_api_key(provider)
            if k is None or str(k) == 'None':
                k = ""
            if not k:
                return {"success": True, "present": False}
            masked = "****" + (k[-4:] if len(k) > 4 else k)
            return {"success": True, "present": True, "masked": masked}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def get_all_api_key_status():
        """Return status for all keys."""
        try:
            status = {}
            for p in _KEYRING_KEYS.keys():
                k = get_stored_api_key(p)
                if k is None or str(k) == 'None':
                    k = ""
                if k:
                    status[p] = {"present": True, "masked": "****" + (k[-4:] if len(k) > 4 else k)}
                else:
                    status[p] = {"present": False, "masked": ""}
            return {"success": True, "status": status}
        except Exception as e:
            return {"success": False, "error": str(e)}
