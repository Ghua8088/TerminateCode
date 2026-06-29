import os
import ast
import uuid
try:
    import chromadb
except ImportError:
    chromadb = None

class SemanticIndexer:
    def __init__(self, workspace_path="."):
        self.workspace_path = os.path.abspath(workspace_path)
        
        # Centralized isolated AppData database path keyed by workspace path hash
        import hashlib
        path_hash = hashlib.sha256(self.workspace_path.encode('utf-8')).hexdigest()
        user_home = os.path.expanduser("~")
        
        # Ensure collection directory is isolated outside project workspace
        self.db_path = os.path.join(user_home, ".terminatecode", "collections", path_hash)
        
        # Fallback to local .terminate_db if it already exists to maintain backward compatibility
        local_db = os.path.join(self.workspace_path, ".terminate_db")
        if os.path.exists(local_db):
            self.db_path = local_db
            
        # Ensure chromadb is available; fail gracefully if not
        if chromadb is None:
            self.collection = None
            return
            
        # Initialize the persistent ChromaDB client
        self.client = chromadb.PersistentClient(path=self.db_path)
        
        # Get or create the codebase vector collection
        self.collection = self.client.get_or_create_collection(
            name="workspace_codebase"
        )

    def chunk_file(self, content, max_length=1500, file_ext='.py'):
        """Splits file content into syntax-aware chunks where possible."""
        # For Python files, parse using AST to preserve class and function definitions
        if file_ext == '.py':
            try:
                import ast
                tree = ast.parse(content)
                chunks = []
                lines = content.splitlines()
                current_chunk = []
                current_len = 0
                
                # Iterate through top-level nodes (classes, functions, statements)
                for node in ast.iter_child_nodes(tree):
                    if hasattr(node, 'lineno') and hasattr(node, 'end_lineno'):
                        node_src = "\n".join(lines[node.lineno - 1:node.end_lineno])
                        # If node itself is larger than max_length, split it or add as own chunk
                        if len(node_src) > max_length:
                            if current_chunk:
                                chunks.append("\n".join(current_chunk))
                                current_chunk = []
                                current_len = 0
                            # Simple character chunking fallback for very large blocks
                            for j in range(0, len(node_src), max_length):
                                chunks.append(node_src[j:j + max_length])
                        else:
                            if current_len + len(node_src) > max_length:
                                chunks.append("\n".join(current_chunk))
                                current_chunk = [node_src]
                                current_len = len(node_src)
                            else:
                                current_chunk.append(node_src)
                                current_len += len(node_src)
                
                if current_chunk:
                    chunks.append("\n".join(current_chunk))
                
                if chunks:
                    return chunks
            except Exception:
                # Fallback to standard chunking on syntax errors
                pass
                
        # Standard character chunking fallback for all other files
        chunks = []
        for i in range(0, len(content), max_length):
            chunks.append(content[i:i + max_length])
        return chunks

    def index_workspace(self, ignore_folders=('.git', 'node_modules', 'env', 'build', '.terminate_db')):
        """Scans the workspace, generating chunks and upserting to ChromaDB."""
        if not self.collection:
            return {"status": "error", "message": "ChromaDB not installed."}
            
        print("[SemanticMemory] Starting codebase indexing...")
        docs_to_upsert = []
        metadatas = []
        ids = []
        
        for root, dirs, files in os.walk(self.workspace_path):
            # Skip ignored directories
            dirs[:] = [d for d in dirs if not any(ign in os.path.join(root, d) for ign in ignore_folders)]
            
            for file in files:
                if not file.endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.md')):
                    continue
                    
                path = os.path.join(root, file)
                rel_path = os.path.relpath(path, self.workspace_path)
                
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    if not content.strip():
                        continue
                        
                    ext = os.path.splitext(file)[1].lower()
                    chunks = self.chunk_file(content, file_ext=ext)
                    for i, chunk in enumerate(chunks):
                        doc_id = f"{rel_path}_{i}"
                        docs_to_upsert.append(chunk)
                        metadatas.append({"file": rel_path, "chunk": i})
                        ids.append(doc_id)
                except Exception as e:
                    print(f"Failed to read {rel_path}: {e}")

        if docs_to_upsert:
            # Upsert into Chroma (automatically handles embeddings via default sentence-transformer)
            # Batching to avoid huge payloads
            batch_size = 100
            for i in range(0, len(docs_to_upsert), batch_size):
                self.collection.upsert(
                    documents=docs_to_upsert[i:i + batch_size],
                    metadatas=metadatas[i:i + batch_size],
                    ids=ids[i:i + batch_size]
                )
            return {"status": "success", "indexed_chunks": len(docs_to_upsert)}
            
        return {"status": "success", "indexed_chunks": 0}

    def search_codebase(self, query, n_results=5):
        """Searches the vector db for code chunks relevant to the query."""
        if not self.collection:
            return []
            
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results
            )
            
            # Reformat results into a more consumable standard dict
            if results and results.get("documents"):
                documents = results["documents"][0]
                metadatas = results["metadatas"][0]
                
                formatted = []
                for doc, meta in zip(documents, metadatas):
                    formatted.append({
                        "content": doc,
                        "file": meta.get("file", "unknown")
                    })
                return formatted
        except Exception as e:
            print(f"Search failed: {e}")
        return []
