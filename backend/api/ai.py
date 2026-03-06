ai_service_error = None
try:
    from backend.services.ai_service import get_ai_service
except ImportError as e:
    ai_service_error = str(e)
    def get_ai_service(key): return None
except Exception as e:
    ai_service_error = str(e)
    def get_ai_service(key): return None

from backend.api.settings import get_stored_api_key

def register_ai_routes(app):

    @app.expose
    def get_available_models():
        """Get a list of available Gemini models."""
        try:
            from backend.services.model_manager import get_available_models as get_manager_models
            models = get_manager_models()
            # Return in the format the frontend expects (list of objects with id and name)
            return {"success": True, "models": [{"id": m, "name": m} for m in models]}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def ask_ai(prompt, history=[], model_id="gemini-2.0-flash"):
        """Call AI Agent with streaming tool support."""
        try:
            if ai_service_error:
                 return {"success": False, "error": f"AI Service not available: {ai_service_error}"}

            ai_svc = get_ai_service("dummy_key")
            if not ai_svc:
                 return {"success": False, "error": "AI Service not available (Initialization failed)."}
            
            # Setup bridge for real-time events
            def on_ai_event(ev_type, data):
                app.emit("ai_agent_event", {"type": ev_type, "data": data})
            
            ai_svc.on_event = on_ai_event
            
            # Run in a background thread to avoid blocking the main IPC loop
            import threading
            import asyncio

            def runner():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                async def stream_task():
                    async for chunk in ai_svc.run_agent_stream(prompt, model_id=model_id, history=history):
                        # Support all event types coming from the AIService generator
                        app.emit("ai_agent_event", chunk)
                
                loop.run_until_complete(stream_task())
            
            threading.Thread(target=runner, daemon=True).start()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @app.expose
    def confirm_tool(confirm_id, answer):
        """Handle user confirmation for sensitive tool calls."""
        try:
            ai_svc = get_ai_service("dummy_key")
            if ai_svc:
                success = ai_svc.handle_confirmation(confirm_id, answer)
                return {"success": success}
            return {"success": False, "error": "AI Service not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}
