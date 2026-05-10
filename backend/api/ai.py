# AI Service import moved into ask_ai to prevent global failures
get_ai_service = None 
ai_service_import_error = None

from backend.api.settings import get_stored_api_key

def register_ai_routes(app):

    @app.expose
    def get_available_models():
        """Get a list of available AI models across all providers."""
        try:
            # Import model manager inside to avoid circular deps
            from backend.services.model_manager import get_available_models as get_models
            models = get_models()
            
            # Ensure we always have at least some models to show if manager returns empty
            if not models:
                models = ["gemini-2.0-flash", "gpt-4o", "claude-3-5-sonnet-20241022"]
                
            return {"success": True, "models": [{"id": m, "name": m} for m in models]}
        except Exception as e:
            # Fallback models on failure
            fallbacks = ["gemini-2.0-flash", "gpt-4o"]
            return {"success": True, "models": [{"id": m, "name": m} for m in fallbacks], "warning": str(e)}

    @app.expose
    def ask_ai(prompt, history=[], model_id="gemini-2.0-flash"):
        """Call AI Agent with tool support, automatically selecting the correct provider."""
        try:
            # Import AI service only when needed
            from backend.services.ai_service import get_ai_service
            import asyncio
            import threading
            
            # Determine provider from model_id
            provider = "google"
            if model_id.startswith(("gpt-", "o1-")):
                provider = "openai"
            elif model_id.startswith("claude-"):
                provider = "anthropic"
            elif model_id.endswith((".gguf", ".bin")):
                provider = "local"

            # Get API key for the specific provider
            api_key = get_stored_api_key(provider)

            if not api_key and provider != "local":
                return {"success": False, "error": f"No API key found for {provider}. Please set it in Settings."}

            # Import/Get AI Service
            ai_svc = get_ai_service(api_key or "local-mode")
            if not ai_svc:
                 return {"success": False, "error": "AI Service not available (Initialization failed)."}
            
            # Set up event forwarding to UI
            def emit_ui_event(event_type, data):
                app.emit("ai_agent_event", {"type": event_type, **data})
            
            ai_svc.on_event = emit_ui_event

            # Run as stream for UI events but return final for response
            def run_agent_in_thread():
                full_reply = ""
                async def run():
                    nonlocal full_reply
                    async for chunk in ai_svc.run_agent_stream(prompt, model_id=model_id, history=history):
                        if chunk["type"] == "token":
                            full_reply += chunk["content"]
                        app.emit("ai_agent_event", chunk)
                    

                
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(run())
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    app.emit("ai_agent_event", {"type": "error", "content": str(e)})
                finally:
                    app.emit("ai_agent_event", {"type": "finish", "full_reply": full_reply})
                    try:
                        loop.close()
                    except Exception:
                        pass
            # Start thread
            thread = threading.Thread(target=run_agent_in_thread)
            thread.daemon = True
            thread.start()
            
            return {"success": True, "status": "streaming_started"}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    @app.expose
    def confirm_tool(confirm_id: str, allow: bool = True):
        """Handle pending tool confirmations."""
        try:
            from backend.services.ai_service import get_active_ai_service
            ai_svc = get_active_ai_service()
            if ai_svc:
                handled = ai_svc.handle_confirmation(confirm_id, allow)
                return {"success": handled}
            return {"success": False, "error": "No active AI session."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def interrupt_ai():
        """Interrupts currently running AI processes."""
        try:
            from backend.services.ai_service import get_active_ai_service
            ai_svc = get_active_ai_service()
            if ai_svc:
                ai_svc.interrupt()
                return {"success": True}
            return {"success": False, "error": "No active AI session."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def undo_last_change():
        """Reverts the last filesystem modification made by the AI."""
        try:
            from backend.services.ai_service import get_ai_service, undo_last_change as _undo
            res = _undo.invoke({})
            return res
        except Exception as e:
            return f"Undo failed: {str(e)}"

    @app.expose
    def search_hf_models(query="phi", limit=10):
        """Searches Hugging Face for GGUF models."""
        try:
            import requests
            url = f"https://huggingface.co/api/models?search={query}&filter=gguf&limit={limit}&sort=downloads&direction=-1"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                models = response.json()
                return {"success": True, "models": models}
            return {"success": False, "error": f"HF API Error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def get_hf_model_files(repo_id):
        """Gets the list of files in a HF repo to find the exact .gguf files."""
        try:
            import requests
            url = f"https://huggingface.co/api/models/{repo_id}/tree/main"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                files = [f for f in response.json() if f.get('type') == 'file' and f.get('path', '').endswith('.gguf')]
                return {"success": True, "files": files}
            return {"success": False, "error": f"HF API Error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def download_hf_model(repo_id, filename):
        """Downloads a model directly to the models/ directory with streaming IPC."""
        import os
        import threading
        
        def download_thread():
            try:
                import requests
                url = f"https://huggingface.co/{repo_id}/resolve/main/{filename}"
                # Use a global user directory so models are shared across all projects!
                models_dir = os.path.join(os.path.expanduser("~"), ".terminatecode", "models")
                os.makedirs(models_dir, exist_ok=True)
                dest = os.path.join(models_dir, filename)
                
                with requests.get(url, stream=True, allow_redirects=True) as r:
                    r.raise_for_status()
                    total_length = int(r.headers.get('content-length', 0))
                    dl_size = 0
                    last_emit_size = 0
                    with open(dest, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=1024*1024): # 1MB chunks
                            if chunk:
                                f.write(chunk)
                                dl_size += len(chunk)
                                # Emit roughly every 5MB to avoid flooding the IPC bus
                                if dl_size - last_emit_size > 5 * 1024 * 1024 or dl_size == total_length:
                                    progress = int((dl_size / total_length * 100)) if total_length else 0
                                    app.emit("hf_download_progress", {
                                        "filename": filename,
                                        "progress": progress,
                                        "downloaded_mb": round(dl_size / (1024*1024), 2),
                                        "total_mb": round(total_length / (1024*1024), 2) if total_length else 0
                                    })
                                    last_emit_size = dl_size
                                    
                app.emit("hf_download_complete", {"filename": filename, "success": True})
            except Exception as e:
                import traceback
                traceback.print_exc()
                app.emit("hf_download_complete", {"filename": filename, "success": False, "error": str(e)})

        threading.Thread(target=download_thread, daemon=True).start()
        return {"success": True, "status": "download_started"}

