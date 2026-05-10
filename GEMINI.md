# TerminateCode AI Protocols

This project contains a specialized CLI bridge to interact with its internal AI services (Semantic Memory, Architecture Mapping, etc.).

## Available Tools
If you need deep project context, use the following shell commands:

- `python tcode.py recall "<query>"`: Performs a semantic search in the ChromaDB vector store. Use this when `grep` is insufficient.
- `python tcode.py map <depth>`: Generates an architectural tree map.
- `python tcode.py search "<regex>"`: Optimized code search using backend logic.
- `python tcode.py status/diff/log`: Accesses the IDE's internal Git service.

## Architectural Note
The project uses a Python backend (FastAPI/Pytron) and a React frontend. The backend services are located in `backend/services/`.
