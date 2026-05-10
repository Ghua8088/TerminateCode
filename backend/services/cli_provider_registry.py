from dataclasses import dataclass
import os
import shutil
from typing import Dict, List, Optional


@dataclass(frozen=True)
class CLIProvider:
    id: str
    name: str
    description: str
    executable: str
    install_command: str
    docs_url: str
    auth_hint: str
    launch_note: str = ""
    windows_note: str = ""


class CLIProviderRegistry:
    def __init__(self):
        self._providers: Dict[str, CLIProvider] = {
            "claude-code": CLIProvider(
                id="claude-code",
                name="Claude Code",
                description="Anthropic's terminal-native coding agent for repo understanding, edits, and workflows.",
                executable="claude",
                install_command="npm install -g @anthropic-ai/claude-code",
                docs_url="https://docs.anthropic.com/en/docs/claude-code/getting-started",
                auth_hint="Run claude once and sign in, or configure Anthropic credentials before starting a session.",
                launch_note="Starts an interactive Claude Code session in the current workspace terminal.",
                windows_note="Best on Windows through WSL or Git Bash, according to Anthropic's docs.",
            ),
            "gemini-cli": CLIProvider(
                id="gemini-cli",
                name="Gemini CLI",
                description="Google's local CLI agent with repo-aware chat, tools, and terminal-first workflows.",
                executable="gemini",
                install_command="npm install -g @google/gemini-cli",
                docs_url="https://github.com/google-gemini/gemini-cli",
                auth_hint="Run gemini and choose Google login, or set GEMINI_API_KEY before starting.",
                launch_note="Starts an interactive Gemini CLI session in the current workspace terminal.",
                windows_note="Native Windows is supported, but PATH/install setups can vary by npm environment.",
            ),
            "codex-cli": CLIProvider(
                id="codex-cli",
                name="Codex CLI",
                description="OpenAI's terminal coding agent with local approvals, edits, and command execution modes.",
                executable="codex",
                install_command="npm install -g @openai/codex",
                docs_url="https://help.openai.com/en/articles/11096431-openai-codex-ci-getting-started",
                auth_hint="Set OPENAI_API_KEY or complete the login flow supported by your Codex installation.",
                launch_note="Starts Codex in suggest mode in the current workspace terminal.",
                windows_note="OpenAI documents Windows support as experimental and it may work best through WSL.",
            ),
        }

    def list_providers(self) -> List[dict]:
        return [self.get_provider_status(provider_id) for provider_id in self._providers]

    def get_provider(self, provider_id: str) -> Optional[CLIProvider]:
        return self._providers.get(provider_id)

    def get_provider_status(self, provider_id: str) -> dict:
        provider = self.get_provider(provider_id)
        if not provider:
            raise KeyError(provider_id)

        resolved_path = self._resolve_executable(provider.executable)
        return {
            "id": provider.id,
            "name": provider.name,
            "description": provider.description,
            "executable": provider.executable,
            "installed": bool(resolved_path),
            "resolved_path": resolved_path,
            "install_command": provider.install_command,
            "docs_url": provider.docs_url,
            "auth_hint": provider.auth_hint,
            "launch_note": provider.launch_note,
            "windows_note": provider.windows_note,
            "launch_command": provider.executable,
        }

    def build_command(self, provider_id: str) -> str:
        provider = self.get_provider(provider_id)
        if not provider:
            raise KeyError(provider_id)
        return provider.executable

    @staticmethod
    def _resolve_executable(executable: str) -> Optional[str]:
        candidates = [executable]
        if os.name == "nt":
            candidates.extend([f"{executable}.cmd", f"{executable}.exe", f"{executable}.bat"])

        for candidate in candidates:
            path = shutil.which(candidate)
            if path:
                return path
        return None


cli_provider_registry = CLIProviderRegistry()
