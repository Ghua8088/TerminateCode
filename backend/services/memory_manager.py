import os
import json
import datetime
import numpy as np
from typing import List, Dict, Any, Optional
# Dynamic import for embeddings to prevent circular dependencies
def _get_embedding_fn():
    try:
        from backend.services.model_manager import get_embeddings_instance
        return get_embeddings_instance()
    except Exception as e:
        print(f"Embedding initialization delayed: {e}")
        return None

# Simple JSON-based vector memory (Lite version)
MEMORY_DIR = os.path.join(os.path.expanduser("~"), ".terminatecode", "memory")
MEMORY_FILE = os.path.join(MEMORY_DIR, "memories.json")

class MemoryManager:
    def __init__(self):
        self.memories = []
        self.workspace_path = os.getcwd()
        self.memory_dir = os.path.join(self.workspace_path, ".terminatecode")
        self.memory_file = os.path.join(self.memory_dir, "kb.json")
        self._load()

    def set_workspace(self, path: str):
        """Switch to a different workspace and load its memory."""
        self.workspace_path = path
        self.memory_dir = os.path.join(self.workspace_path, ".terminatecode")
        self.memory_file = os.path.join(self.memory_dir, "kb.json")
        self._load()

    def _load(self):
        if not os.path.exists(self.memory_dir):
            try:
                os.makedirs(self.memory_dir, exist_ok=True)
            except: pass
        
        if os.path.exists(self.memory_file):
            try:
                with open(self.memory_file, 'r', encoding='utf-8') as f:
                    self.memories = json.load(f)
            except Exception:
                self.memories = []
        else:
            self.memories = []

    def _save(self):
        if not os.path.exists(self.memory_dir):
            try: os.makedirs(self.memory_dir, exist_ok=True)
            except: return

        try:
            with open(self.memory_file, 'w', encoding='utf-8') as f:
                json.dump(self.memories, f, indent=2)
        except Exception as e:
            print(f"Memory save error: {e}")

    async def add_memory(self, text: str, metadata: Optional[Dict] = None):
        """Add a piece of text to memory with optional embedding."""
        mem = {
            "content": text,
            "metadata": metadata or {},
            "timestamp": datetime.datetime.now().isoformat(),
            "embedding": None
        }
        
        # Try to generate embedding
        try:
            embed_svc = _get_embedding_fn()
            if embed_svc:
                vector = embed_svc.embed_query(text)
                if vector:
                    mem["embedding"] = list(vector) # JSON needs list, not numpy array
        except: pass

        self.memories.append(mem)
        if len(self.memories) > 200:
            self.memories = self.memories[-200:]
        self._save()
        return f"Memorized: {text[:50]}..."

    async def search(self, query: str, k: int = 5):
        """Search memory using hybrid (Vector + Keyword) search."""
        if not self.memories:
            return []
        
        # 1. Semantic Search (Vector)
        try:
            embed_svc = _get_embedding_fn()
            if embed_svc:
                query_vector = embed_svc.embed_query(query)
                scored = []
                for m in self.memories:
                    if m.get("embedding"):
                        # Cosine similarity
                        dot = np.dot(query_vector, m["embedding"])
                        norm_a = np.linalg.norm(query_vector)
                        norm_b = np.linalg.norm(m["embedding"])
                        score = dot / (norm_a * norm_b)
                        scored.append((score, m))
                
                if scored:
                    scored.sort(key=lambda x: x[0], reverse=True)
                    return [s[1] for s in scored[:k]]
        except: pass

        # 2. Key-word Fallback
        query_words = set(query.lower().split())
        scored_results = []
        for mem in self.memories:
            content = mem["content"].lower()
            score = sum(1 for word in query_words if word in content)
            if score > 0: scored_results.append((score, mem))
        
        scored_results.sort(key=lambda x: x[0], reverse=True)
        return [res[1] for res in scored_results[:k]]

# Global instance
memory_manager = MemoryManager()
