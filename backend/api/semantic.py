from backend.services.semantic_memory import SemanticIndexer

def register_semantic_routes(app):
    _indexer = None

    def get_indexer():
        nonlocal _indexer
        if _indexer is None:
            _indexer = SemanticIndexer()
        return _indexer

    @app.expose
    def index_codebase():
        """Trigger a background or immediate indexing of the codebase."""
        try:
            indexer = get_indexer()
            result = indexer.index_workspace()
            return result
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @app.expose
    def generate_node_docs(payload):
        """
        Uses semantic search to find relevant code based on a node's label/description, 
        then uses LLM to generate documentation.
        """
        from backend.services.model_manager import get_model_instance
        from langchain_core.messages import HumanMessage
        
        node_label = payload.get("label", "")
        node_desc = payload.get("description", "")
        
        if not node_label:
            return {"status": "error", "message": "Node label is required."}

        # 1. Search ChromaDB for relevant code snippets
        search_query = f"{node_label} {node_desc}"
        indexer = get_indexer()
        results = indexer.search_codebase(search_query, n_results=5)
        
        context_text = ""
        for r in results:
            context_text += f"\n--- File: {r['file']} ---\n{r['content']}\n"

        # 2. Ask LLM to generate documentation
        prompt = f"""
You are an AI autodocumentation agent. 
The user is inspecting a system component labeled: "{node_label}"
Description provided by user: "{node_desc}"

Here are code snippets from our local codebase that semantically match this component:
{context_text}

Generate a clear, well-structured Markdown summary explaining:
1. What this component currently does in the existing codebase.
2. What files are currently responsible for it.
3. How it functions internally based on the code snippets.

If the snippets don't seem relevant, explicitly state that this component appears to be purely conceptual and is not yet implemented in the codebase.
"""
        try:
            model = get_model_instance("gemini-2.0-flash", temperature=0.3)
            response = model.invoke([HumanMessage(content=prompt)])
            return {"status": "success", "documentation": response.content}
        except Exception as e:
            return {"status": "error", "message": str(e)}
