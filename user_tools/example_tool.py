from langchain_core.tools import tool
import webbrowser

@tool
def google_search(query: str) -> str:
    """Performs a Google search opening in the default browser."""
    webbrowser.open(f"https://www.google.com/search?q={query}")
    return f"Opened browser search for: {query}"
