# TerminateCode CLI Bridge - Created by Gemini CLI
import sys
import os

# Force standard output to UTF-8 to prevent charmap encoding crashes on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add the project root to sys.path to allow backend imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.services.semantic_memory import SemanticIndexer
from backend.services.agent_tools import get_project_map, search_code, git_status, git_diff, git_log

def main():
    if len(sys.argv) < 2:
        print("TerminateCode Bridge v1.0")
        print("Usage: python tcode.py <command> [args...]")
        print("\nCommands:")
        print("  recall <query>    - Semantic search in codebase using ChromaDB")
        print("  map [depth]       - Generate architectural tree map")
        print("  search <regex>    - Search code across all files")
        print("  status            - Git status summary")
        print("  diff [--staged]   - Git diff")
        print("  log [n]           - Last n git commits")
        return

    cmd = sys.argv[1].lower()
    args = sys.argv[2:]

    try:
        if cmd == "recall":
            if not args:
                print("Error: Missing query for recall.")
                return
            indexer = SemanticIndexer()
            results = indexer.search_codebase(" ".join(args))
            if not results:
                print("No semantic matches found.")
            for r in results:
                print(f"--- File: {r['file']} ---")
                print(r['content'])
                print("-" * (len(r['file']) + 15))

        elif cmd == "map":
            depth = int(args[0]) if args else 2
            print(get_project_map(depth=depth))

        elif cmd == "search":
            if not args:
                print("Error: Missing pattern for search.")
                return
            print(search_code(args[0]))

        elif cmd == "status":
            print(git_status())

        elif cmd == "diff":
            staged = "--staged" in args
            print(git_diff(staged=staged))

        elif cmd == "log":
            n = int(args[0]) if args else 5
            print(git_log(n=n))

        else:
            print(f"Unknown command: {cmd}")

    except Exception as e:
        print(f"Bridge Error: {str(e)}")

if __name__ == "__main__":
    main()
