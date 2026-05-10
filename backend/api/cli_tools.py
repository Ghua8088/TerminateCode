from backend.services.cli_provider_registry import cli_provider_registry


def register_cli_routes(app):
    @app.expose
    def list_cli_providers():
        try:
            return {"success": True, "providers": cli_provider_registry.list_providers()}
        except Exception as error:
            return {"success": False, "error": str(error)}

    @app.expose
    def get_cli_provider_command(provider_id: str, action: str = "launch"):
        try:
            provider = cli_provider_registry.get_provider_status(provider_id)
            if action == "install":
                return {
                    "success": True,
                    "provider": provider,
                    "command": provider["install_command"],
                    "action": "install",
                }

            return {
                "success": True,
                "provider": provider,
                "command": cli_provider_registry.build_command(provider_id),
                "action": "launch",
            }
        except KeyError:
            return {"success": False, "error": f"Unknown CLI provider: {provider_id}"}
        except Exception as error:
            return {"success": False, "error": str(error)}
