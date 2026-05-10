from langchain_core.tools import tool
import requests
from bs4 import BeautifulSoup
from typing import Optional

@tool
def web_browse(url: str) -> str:
    """
    Fetches the content of a webpage and returns the text.
    Useful for reading documentation or checking web content.
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
            
        # Get text
        text = soup.get_text()
        
        # Break into lines and remove leading and trailing whitespace
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text[:10000] # Limit output to 10k characters
    except Exception as e:
        return f"Error browsing {url}: {str(e)}"

@tool
def web_search_summary(query: str) -> str:
    """
    Performs a search (simulated via duckduckgo or similar) and returns titles and snippets.
    Note: In a full implementation, this might use a Search API.
    """
    # For now, we'll use a simple approach or a free API if available. 
    # Since we want to keep it simple for this prototype, we'll suggest using web_browse on known sites
    # or implement a basic scraper for a search engine if permitted.
    # Alternatively, we can use the 'google_search' tool already in example_tool.py but improve it.
    return f"Search functionality for '{query}' is being routed through the browser. Please use web_browse if you have a specific URL."
