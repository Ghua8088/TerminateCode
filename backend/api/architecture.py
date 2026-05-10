import ast
import json
import os
import re
import uuid

ARCHITECTURE_FILE = "Architecture.json"
DEFAULT_MODEL_ID = "gemini-2.0-flash"
SKIP_DIRS = {
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "build",
    "dist",
    ".next",
    ".turbo",
}
COLOR_PRESETS = {
    "frontend": {"color": "#102033", "borderColor": "#38bdf8"},
    "backend": {"color": "#1a1525", "borderColor": "#a855f7"},
    "database": {"color": "#16261b", "borderColor": "#4ade80"},
    "service": {"color": "#2a1c0f", "borderColor": "#f59e0b"},
    "utility": {"color": "#1f2230", "borderColor": "#94a3b8"},
}


def _resolve_architecture_path(workspace_root="."):
    return os.path.join(workspace_root, ARCHITECTURE_FILE)


def _strip_code_fence(text):
    text = (text or "").strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _truncate(value, limit=240):
    value = (value or "").strip()
    return value[:limit]


def _detect_component_kind(label):
    lowered = (label or "").lower()
    if any(token in lowered for token in ("react", "ui", "frontend", "client", "view")):
        return "frontend"
    if any(token in lowered for token in ("db", "database", "postgres", "sqlite", "redis")):
        return "database"
    if any(token in lowered for token in ("api", "backend", "server", "worker", "service")):
        return "backend"
    if any(token in lowered for token in ("auth", "queue", "cache", "index", "search", "agent")):
        return "service"
    return "utility"


def _node_defaults(label):
    return COLOR_PRESETS[_detect_component_kind(label)]


def _normalize_node(node, fallback_id=None, index=0):
    node = dict(node or {})
    node_id = str(node.get("id") or fallback_id or f"node-{index + 1}")
    position = node.get("position") or {}
    x = position.get("x", 160 + ((index % 4) * 220))
    y = position.get("y", 120 + ((index // 4) * 180))
    data = dict(node.get("data") or {})
    label = _truncate(data.get("label") or node_id, 80)
    defaults = _node_defaults(label)
    normalized_data = {
        "label": label,
        "description": data.get("description", ""),
        "color": data.get("color") or defaults["color"],
        "borderColor": data.get("borderColor") or defaults["borderColor"],
        "files": data.get("files", []),
        "kind": data.get("kind") or _detect_component_kind(label),
    }
    return {
        "id": node_id,
        "position": {"x": x, "y": y},
        "data": normalized_data,
        "type": node.get("type") or "editable",
    }


def _normalize_edge(edge, known_ids, index=0):
    edge = dict(edge or {})
    source = str(edge.get("source") or "")
    target = str(edge.get("target") or "")
    if source not in known_ids or target not in known_ids or not source or not target:
        return None
    return {
        "id": str(edge.get("id") or f"edge-{index + 1}"),
        "source": source,
        "target": target,
        "animated": bool(edge.get("animated", True)),
        "label": _truncate(edge.get("label", ""), 80),
    }


def _normalize_graph(nodes, edges):
    normalized_nodes = [_normalize_node(node, index=index) for index, node in enumerate(nodes or [])]
    known_ids = {node["id"] for node in normalized_nodes}
    normalized_edges = []
    for index, edge in enumerate(edges or []):
        normalized = _normalize_edge(edge, known_ids, index=index)
        if normalized:
            normalized_edges.append(normalized)
    return {"nodes": normalized_nodes, "edges": normalized_edges}


def _normalize_workspace_payload(payload):
    payload = dict(payload or {})
    if payload.get("graphStorage"):
        graph_storage = {}
        for graph_id, graph in payload.get("graphStorage", {}).items():
            normalized = _normalize_graph(graph.get("nodes", []), graph.get("edges", []))
            graph_storage[str(graph_id)] = normalized
        root_graph = graph_storage.get("root") or _normalize_graph(payload.get("nodes", []), payload.get("edges", []))
        graph_storage["root"] = root_graph
        return {
            "version": 2,
            "currentGraphId": str(payload.get("currentGraphId") or "root"),
            "viewHistory": payload.get("viewHistory", []),
            "graphStorage": graph_storage,
            "nodes": root_graph["nodes"],
            "edges": root_graph["edges"],
        }

    root_graph = _normalize_graph(payload.get("nodes", []), payload.get("edges", []))
    return {
        "version": 2,
        "currentGraphId": "root",
        "viewHistory": [],
        "graphStorage": {"root": root_graph},
        "nodes": root_graph["nodes"],
        "edges": root_graph["edges"],
    }


def _gather_ast_context(workspace_root="."):
    context_data = []

    for root, dirs, files in os.walk(workspace_root):
        dirs[:] = [directory for directory in dirs if directory not in SKIP_DIRS]

        for file_name in files:
            path = os.path.join(root, file_name)
            rel_path = os.path.relpath(path, workspace_root)

            try:
                if file_name.endswith(".py"):
                    with open(path, "r", encoding="utf-8") as file:
                        tree = ast.parse(file.read())

                    classes = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
                    functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
                    if classes or functions:
                        context_data.append(
                            f"FILE {rel_path}\n  Classes: {', '.join(classes) or 'None'}\n  Functions: {', '.join(functions[:20]) or 'None'}"
                        )

                elif file_name.endswith((".js", ".jsx", ".ts", ".tsx")):
                    with open(path, "r", encoding="utf-8") as file:
                        content = file.read()

                    exports = re.findall(r"export (?:default )?(?:function|const|class) ([a-zA-Z0-9_]+)", content)
                    hooks = re.findall(r"function ([A-Z][a-zA-Z0-9_]+)", content)
                    named = list(dict.fromkeys(exports + hooks[:10]))
                    if named:
                        context_data.append(
                            f"FILE {rel_path}\n  Exports/Components: {', '.join(named[:20])}"
                        )
            except Exception:
                continue

    return "\n\n".join(context_data)[:8000]


def _load_llm_json(text):
    cleaned = _strip_code_fence(text)
    return json.loads(cleaned)


def register_architecture_routes(app):
    @app.expose
    def analyze_architecture(payload):
        from backend.services.model_manager import get_model_instance
        from langchain_core.messages import HumanMessage

        payload = payload or {}
        nodes = payload.get("nodes", [])
        edges = payload.get("edges", [])
        model_id = payload.get("model_id", DEFAULT_MODEL_ID)
        workspace_context = _gather_ast_context()

        prompt = f"""
You are an expert software architect helping expand a visual architecture board.

Use the current graph and codebase context to suggest up to 3 concrete child components for existing nodes.
Only suggest components that would make sense in this repository.
Return ONLY JSON in this exact shape:
[
  {{
    "parent_id": "node-id",
    "sub_components": [
      {{
        "label": "Auth Service",
        "description": "Owns session validation and token flows."
      }}
    ]
  }}
]

Rules:
- Do not invent more than 3 children for a parent.
- Do not repeat labels already present in the graph.
- Prefer implementation-oriented pieces over vague ideas.
- Keep labels short and ASCII-only.

Workspace context:
{workspace_context}

Current nodes:
{json.dumps([{"id": node.get("id"), "label": node.get("data", {}).get("label"), "description": node.get("data", {}).get("description", "")} for node in nodes])}

Current edges:
{json.dumps([{"source": edge.get("source"), "target": edge.get("target"), "label": edge.get("label", "")} for edge in edges])}
"""

        try:
            model = get_model_instance(model_id, temperature=0.3)
            response = model.invoke([HumanMessage(content=prompt)])
            mappings = _load_llm_json(response.content)

            graph = _normalize_graph(nodes, edges)
            new_nodes = list(graph["nodes"])
            new_edges = list(graph["edges"])
            existing_labels = {node["data"]["label"].strip().lower() for node in new_nodes}

            for mapping in mappings:
                parent_id = str(mapping.get("parent_id") or "")
                parent_node = next((node for node in new_nodes if node["id"] == parent_id), None)
                if not parent_node:
                    continue

                parent_x = parent_node["position"]["x"]
                parent_y = parent_node["position"]["y"]
                sub_components = mapping.get("sub_components", [])[:3]

                for index, component in enumerate(sub_components):
                    if isinstance(component, str):
                        label = component.strip()
                        description = ""
                    else:
                        label = _truncate(component.get("label", ""), 80)
                        description = component.get("description", "")

                    if not label or label.lower() in existing_labels:
                        continue

                    node_id = f"ai-{parent_id}-{uuid.uuid4().hex[:6]}"
                    defaults = _node_defaults(label)
                    new_nodes.append(
                        {
                            "id": node_id,
                            "position": {"x": parent_x + (index * 210) - 180, "y": parent_y + 170},
                            "data": {
                                "label": label,
                                "description": description,
                                "color": defaults["color"],
                                "borderColor": defaults["borderColor"],
                                "files": [],
                                "kind": _detect_component_kind(label),
                            },
                            "type": "editable",
                        }
                    )
                    new_edges.append(
                        {
                            "id": f"edge-{parent_id}-{node_id}",
                            "source": parent_id,
                            "target": node_id,
                            "animated": True,
                            "label": "depends on",
                        }
                    )
                    existing_labels.add(label.lower())

            normalized = _normalize_graph(new_nodes, new_edges)
            return {
                "status": "success",
                "message": "Architecture expanded successfully.",
                "nodes": normalized["nodes"],
                "edges": normalized["edges"],
            }
        except Exception as error:
            print(f"AI Architecture Error: {error}")
            raise Exception(f"AI failed to expand architecture: {str(error)}")

    @app.expose
    def save_architecture(payload):
        try:
            normalized = _normalize_workspace_payload(payload)
            with open(_resolve_architecture_path(), "w", encoding="utf-8") as file:
                json.dump(normalized, file, indent=2)
            return {"status": "success", "message": "Architecture.json saved to workspace."}
        except Exception as error:
            raise Exception(f"Failed to save architecture: {str(error)}")

    @app.expose
    def load_architecture():
        path = _resolve_architecture_path()
        if not os.path.exists(path):
            return None

        try:
            with open(path, "r", encoding="utf-8") as file:
                payload = json.load(file)
            return _normalize_workspace_payload(payload)
        except Exception as error:
            print(f"Error loading Architecture.json: {error}")
            return None

    @app.expose
    def generate_workspace_diagram(payload=None):
        from backend.services.model_manager import get_model_instance
        from langchain_core.messages import HumanMessage

        payload = payload or {}
        model_id = payload.get("model_id", DEFAULT_MODEL_ID)
        workspace_context = _gather_ast_context()

        prompt = f"""
You are reverse-engineering a codebase into a visual architecture map.

Return ONLY JSON in this exact shape:
{{
  "nodes": [
    {{
      "id": "node-1",
      "position": {{"x": 180, "y": 120}},
      "data": {{
        "label": "Frontend",
        "description": "Owns the user-facing React application.",
        "color": "#102033",
        "borderColor": "#38bdf8"
      }},
      "type": "editable"
    }}
  ],
  "edges": [
    {{
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "animated": true,
      "label": "calls"
    }}
  ]
}}

Rules:
- Create 6 to 12 nodes.
- Group code logically instead of listing every file.
- Use short, implementation-grounded labels.
- Keep labels ASCII-only.
- Every edge source and target must point to a valid node id.
- Use a readable left-to-right or top-to-bottom layout.

Workspace context:
{workspace_context}
"""

        try:
            model = get_model_instance(model_id, temperature=0.3)
            response = model.invoke([HumanMessage(content=prompt)])
            graph_data = _load_llm_json(response.content)
            normalized = _normalize_graph(graph_data.get("nodes", []), graph_data.get("edges", []))
            return {
                "status": "success",
                "message": "Workspace architecture generated successfully.",
                "nodes": normalized["nodes"],
                "edges": normalized["edges"],
            }
        except Exception as error:
            print(f"AI Architecture Generation Error: {error}")
            raise Exception(f"AI failed to reverse-engineer architecture: {str(error)}")
