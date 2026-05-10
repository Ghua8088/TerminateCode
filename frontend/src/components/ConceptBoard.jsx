import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import pytron from "pytron-client";
import { useToast } from "pytron-ui/react";
import {
  ArrowLeft,
  Workflow,
} from "lucide-react";

const initialNodes = [];

const initialEdges = [];

const initialWorkspaceState = {
  version: 2,
  currentGraphId: "root",
  viewHistory: [],
  graphStorage: {
    root: {
      nodes: initialNodes,
      edges: initialEdges,
    },
  },
};

const kindAccent = {
  frontend: "#38bdf8",
  backend: "#a855f7",
  database: "#4ade80",
  service: "#f59e0b",
  utility: "#94a3b8",
};

function normalizeNode(node, index = 0) {
  const fallbackX = 160 + ((index % 4) * 220);
  const fallbackY = 120 + (Math.floor(index / 4) * 170);
  return {
    id: String(node?.id || `node-${index + 1}`),
    position: {
      x: node?.position?.x ?? fallbackX,
      y: node?.position?.y ?? fallbackY,
    },
    data: {
      label: node?.data?.label || `Component ${index + 1}`,
      description: node?.data?.description || "",
      color: node?.data?.color || "#1f2937",
      borderColor: node?.data?.borderColor || "#60a5fa",
      kind: node?.data?.kind || "utility",
      files: Array.isArray(node?.data?.files) ? node.data.files : [],
    },
    type: "editable",
  };
}

function normalizeEdge(edge, index = 0) {
  return {
    id: String(edge?.id || `edge-${index + 1}`),
    source: String(edge?.source || ""),
    target: String(edge?.target || ""),
    animated: edge?.animated ?? true,
    label: edge?.label || "",
  };
}

function normalizeGraph(graph) {
  return {
    nodes: (graph?.nodes || []).map((node, index) => normalizeNode(node, index)),
    edges: (graph?.edges || []).map((edge, index) => normalizeEdge(edge, index)),
  };
}

function normalizeWorkspacePayload(payload) {
  if (!payload) {
    return initialWorkspaceState;
  }

  if (payload.graphStorage) {
    const graphStorage = Object.fromEntries(
      Object.entries(payload.graphStorage).map(([graphId, graph]) => [
        graphId,
        normalizeGraph(graph),
      ]),
    );

    if (!graphStorage.root) {
      graphStorage.root = normalizeGraph({
        nodes: payload.nodes || initialNodes,
        edges: payload.edges || initialEdges,
      });
    }

    return {
      version: payload.version || 2,
      currentGraphId: payload.currentGraphId || "root",
      viewHistory: Array.isArray(payload.viewHistory) ? payload.viewHistory : [],
      graphStorage,
    };
  }

  return {
    version: 2,
    currentGraphId: "root",
    viewHistory: [],
    graphStorage: {
      root: normalizeGraph({
        nodes: payload.nodes || initialNodes,
        edges: payload.edges || initialEdges,
      }),
    },
  };
}

function buildWorkspacePayload({ currentGraphId, viewHistory, graphStorage, nodes, edges }) {
  const nextStorage = {
    ...graphStorage,
    [currentGraphId]: normalizeGraph({ nodes, edges }),
  };
  const activeGraph = nextStorage[currentGraphId] || nextStorage.root;
  return {
    version: 2,
    currentGraphId,
    viewHistory,
    graphStorage: nextStorage,
    nodes: activeGraph.nodes,
    edges: activeGraph.edges,
  };
}

function createNodeFromLabel(label, position) {
  return {
    id: `node-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    position,
    data: {
      label,
      description: "",
      color: "#1f2937",
      borderColor: "#60a5fa",
      kind: "utility",
      files: [],
    },
    type: "editable",
  };
}

function EditableNode({ data, selected }) {
  const accent = data.borderColor || kindAccent[data.kind] || "#60a5fa";
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "16px",
        minWidth: "180px",
        maxWidth: "240px",
        textAlign: "left",
        background: data.color || "#151923",
        color: "#f8fafc",
        border: `1px solid ${selected ? "#f8fafc" : accent}`,
        boxShadow: selected
          ? "0 0 0 1px rgba(248,250,252,0.65), 0 16px 36px rgba(0,0,0,0.3)"
          : "0 14px 30px rgba(0,0,0,0.24)",
        transition: "all 0.18s ease",
        cursor: "pointer",
        backdropFilter: "blur(10px)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: accent }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
        <div style={{ fontWeight: 700, fontSize: "14px", lineHeight: 1.35 }}>{data.label}</div>
        <span
          style={{
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: accent,
            whiteSpace: "nowrap",
          }}
        >
          {data.kind || "node"}
        </span>
      </div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "11px",
          color: "rgba(226,232,240,0.72)",
          lineHeight: 1.5,
          minHeight: "34px",
        }}
      >
        {data.description || "Double-click to open a deeper architecture slice."}
      </div>
      <div
        style={{
          marginTop: "10px",
          fontSize: "10px",
          color: "rgba(226,232,240,0.52)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Double-click to drill down
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: accent }} />
    </div>
  );
}

const nodeTypes = {
  editable: EditableNode,
};

export default function ConceptBoard({ onSidebarStateChange }) {
  const initialGraph = initialWorkspaceState.graphStorage.root;
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);
  const { addToast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [currentGraphId, setCurrentGraphId] = useState("root");
  const [viewHistory, setViewHistory] = useState([]);
  const [graphStorage, setGraphStorage] = useState(initialWorkspaceState.graphStorage);
  const boardRef = useRef(null);

  const activeGraphStats = useMemo(() => {
    const graph = graphStorage[currentGraphId] || { nodes, edges };
    return {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      depth: viewHistory.length,
    };
  }, [currentGraphId, edges, graphStorage, nodes, viewHistory.length]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }) => {
    if (selectedNodes.length === 1) {
      setSelectedElement({ type: "node", item: selectedNodes[0] });
      return;
    }
    if (selectedEdges.length === 1) {
      setSelectedElement({ type: "edge", item: selectedEdges[0] });
      return;
    }
    setSelectedElement(null);
  }, []);

  const updateSelectedData = useCallback((field, value) => {
    setSelectedElement((previous) => {
      if (!previous) {
        return previous;
      }

      if (previous.type === "node") {
        setNodes((currentNodes) =>
          currentNodes.map((node) =>
            node.id === previous.item.id
              ? { ...node, data: { ...node.data, [field]: value } }
              : node,
          ),
        );
        return {
          ...previous,
          item: {
            ...previous.item,
            data: { ...previous.item.data, [field]: value },
          },
        };
      }

      setEdges((currentEdges) =>
        currentEdges.map((edge) =>
          edge.id === previous.item.id ? { ...edge, [field]: value } : edge,
        ),
      );
      return {
        ...previous,
        item: { ...previous.item, [field]: value },
      };
    });
  }, [setEdges, setNodes]);

  const onConnect = useCallback(
    (params) =>
      setEdges((currentEdges) =>
        addEdge({ ...params, animated: true, label: "data flow" }, currentEdges),
      ),
    [setEdges],
  );

  const onNodesDelete = useCallback(
    (deleted) => {
      const deletedIds = new Set(deleted.map((node) => node.id));
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target),
        ),
      );
      setSelectedElement((previous) => {
        if (previous?.type === "node" && deletedIds.has(previous.item.id)) {
          return null;
        }
        return previous;
      });
    },
    [setEdges],
  );

  const handleAddNode = useCallback(() => {
    const nextNode = createNodeFromLabel("New Component", {
      x: 160 + Math.round(Math.random() * 220),
      y: 120 + Math.round(Math.random() * 160),
    });
    setNodes((currentNodes) => [...currentNodes, nextNode]);
    setSelectedElement({ type: "node", item: nextNode });
  }, [setNodes]);

  const handleSaveToProject = useCallback(async () => {
    try {
      addToast("Saving architecture workspace...", { title: "Architecture", type: "info" });
      const payload = buildWorkspacePayload({
        currentGraphId,
        viewHistory,
        graphStorage,
        nodes,
        edges,
      });
      const response = await pytron.save_architecture(payload);
      if (response?.status === "success") {
        setGraphStorage(payload.graphStorage);
        addToast("Architecture workspace saved.", { title: "Success", type: "success" });
      }
    } catch (error) {
      addToast(String(error), { title: "Error", type: "error" });
    }
  }, [addToast, currentGraphId, edges, graphStorage, nodes, viewHistory]);

  const handleLoadFromProject = useCallback(async () => {
    try {
      const payload = await pytron.load_architecture();
      if (!payload) {
        addToast("No Architecture.json found in the workspace root.", { title: "Architecture", type: "info" });
        return;
      }

      const normalized = normalizeWorkspacePayload(payload);
      const currentGraph = normalized.graphStorage[normalized.currentGraphId] || normalized.graphStorage.root;
      setGraphStorage(normalized.graphStorage);
      setCurrentGraphId(normalized.currentGraphId);
      setViewHistory(normalized.viewHistory);
      setNodes(currentGraph.nodes);
      setEdges(currentGraph.edges);
      setSelectedElement(null);
      addToast("Architecture workspace loaded.", { title: "Success", type: "success" });
    } catch (error) {
      addToast(String(error), { title: "Error", type: "error" });
    }
  }, [addToast, setEdges, setNodes]);

  const handleIndexCodebase = useCallback(async () => {
    try {
      setIsGenerating(true);
      addToast("Building semantic context for architecture actions...", { title: "Indexing", type: "info" });
      const response = await pytron.index_codebase();
      if (response?.status === "success") {
        addToast(`Indexed ${response.indexed_chunks} chunks successfully.`, { title: "Vector DB Ready", type: "success" });
      } else {
        addToast(response?.message || "Failed to index the workspace.", { title: "Error", type: "error" });
      }
    } catch (error) {
      addToast(String(error), { title: "Error", type: "error" });
    } finally {
      setIsGenerating(false);
    }
  }, [addToast]);

  const handleGenerateDocs = useCallback(async () => {
    if (!selectedElement || selectedElement.type !== "node") {
      return;
    }

    try {
      setIsGenerating(true);
      addToast("Generating implementation notes from the indexed codebase...", {
        title: "Auto-doc",
        type: "info",
      });

      const response = await pytron.generate_node_docs({
        label: selectedElement.item.data.label,
        description: selectedElement.item.data.description,
      });

      if (response?.status === "success" && response.documentation) {
        updateSelectedData("description", response.documentation);
        addToast("Component notes updated from codebase context.", { title: "Success", type: "success" });
      } else {
        addToast(response?.message || "Failed to generate docs.", { title: "Error", type: "error" });
      }
    } catch (error) {
      addToast(String(error), { title: "Error", type: "error" });
    } finally {
      setIsGenerating(false);
    }
  }, [addToast, selectedElement, updateSelectedData]);

  const handleGenerateWorkspaceDiagram = useCallback(async () => {
    try {
      setIsGenerating(true);
      addToast("Reverse-engineering the repository into a board...", {
        title: "Architecture Scan",
        type: "info",
      });
      const response = await pytron.generate_workspace_diagram();
      if (response?.status === "success" && response.nodes && response.edges) {
        const graph = normalizeGraph({ nodes: response.nodes, edges: response.edges });
        setCurrentGraphId("root");
        setViewHistory([]);
        setGraphStorage({ root: graph });
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setSelectedElement(null);
        addToast("Workspace architecture generated.", { title: "Success", type: "success" });
      } else {
        addToast(response?.message || "Failed to generate a workspace diagram.", { title: "Error", type: "error" });
      }
    } catch (error) {
      addToast(String(error), { title: "Error", type: "error" });
    } finally {
      setIsGenerating(false);
    }
  }, [addToast, setEdges, setNodes]);

  const handleAnalyzeBoard = useCallback(async () => {
    try {
      setIsGenerating(true);
      addToast("Expanding the current graph with AI suggestions...", {
        title: "Architecture AI",
        type: "info",
      });
      const response = await pytron.analyze_architecture({ nodes, edges });
      if (response?.status === "success" && response.nodes && response.edges) {
        const graph = normalizeGraph({ nodes: response.nodes, edges: response.edges });
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setGraphStorage((previous) => ({ ...previous, [currentGraphId]: graph }));
        addToast(response.message || "Architecture expanded successfully.", {
          title: "AI Complete",
          type: "success",
        });
      } else {
        addToast(response?.message || "Failed to analyze architecture.", { title: "Error", type: "error" });
      }
    } catch (error) {
      addToast(String(error), { title: "Error", type: "error" });
    } finally {
      setIsGenerating(false);
    }
  }, [addToast, currentGraphId, edges, nodes, setEdges, setNodes]);

  const handleNodeDoubleClick = useCallback((_, node) => {
    const currentSnapshot = normalizeGraph({ nodes, edges });
    const nextStorage = {
      ...graphStorage,
      [currentGraphId]: currentSnapshot,
    };

    const currentLabel =
      currentGraphId === "root"
        ? "System Overview"
        : graphStorage[currentGraphId]?.nodes?.find((graphNode) => graphNode.id === currentGraphId)?.data?.label || currentGraphId;

    const existingGraph = nextStorage[node.id];
    const childGraph =
      existingGraph ||
      normalizeGraph({
        nodes: [
          {
            id: `${node.id}-core`,
            position: { x: 220, y: 140 },
            data: {
              label: `${node.data.label} Core`,
              description: `Internal implementation slice for ${node.data.label}.`,
              color: node.data.color,
              borderColor: node.data.borderColor,
              kind: node.data.kind,
            },
            type: "editable",
          },
        ],
        edges: [],
      });

    setGraphStorage({ ...nextStorage, [node.id]: childGraph });
    setViewHistory((previous) => [
      ...previous,
      { id: currentGraphId, label: currentLabel },
    ]);
    setCurrentGraphId(node.id);
    setNodes(childGraph.nodes);
    setEdges(childGraph.edges);
    setSelectedElement(null);
  }, [currentGraphId, edges, graphStorage, nodes, setEdges, setNodes]);

  const handleBackToParentGraph = useCallback(() => {
    if (viewHistory.length === 0) {
      return;
    }

    const currentSnapshot = normalizeGraph({ nodes, edges });
    const nextStorage = {
      ...graphStorage,
      [currentGraphId]: currentSnapshot,
    };

    const previousView = viewHistory[viewHistory.length - 1];
    const previousGraph = nextStorage[previousView.id] || nextStorage.root;

    setGraphStorage(nextStorage);
    setViewHistory((previous) => previous.slice(0, -1));
    setCurrentGraphId(previousView.id);
    setNodes(previousGraph.nodes);
    setEdges(previousGraph.edges);
    setSelectedElement(null);
  }, [currentGraphId, edges, graphStorage, nodes, setEdges, setNodes, viewHistory]);

  useEffect(() => {
    onSidebarStateChange?.({
      currentGraphId,
      title:
        currentGraphId === "root"
          ? "System Overview"
          : graphStorage[currentGraphId]?.nodes?.[0]?.data?.label || currentGraphId,
      viewHistory,
      stats: activeGraphStats,
      selectedElement,
      isGenerating,
      actions: {
        updateField: updateSelectedData,
        generateDocs: handleGenerateDocs,
        addNode: handleAddNode,
        save: handleSaveToProject,
        load: handleLoadFromProject,
        analyze: handleAnalyzeBoard,
        generateDiagram: handleGenerateWorkspaceDiagram,
        indexWorkspace: handleIndexCodebase,
        goBack: handleBackToParentGraph,
      },
    });

    return () => {
      onSidebarStateChange?.(null);
    };
  }, [
    activeGraphStats,
    currentGraphId,
    graphStorage,
    handleAddNode,
    handleAnalyzeBoard,
    handleBackToParentGraph,
    handleGenerateDocs,
    handleGenerateWorkspaceDiagram,
    handleIndexCodebase,
    handleLoadFromProject,
    handleSaveToProject,
    isGenerating,
    onSidebarStateChange,
    selectedElement,
    updateSelectedData,
    viewHistory,
  ]);

  return (
    <div
      ref={boardRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 30%), radial-gradient(circle at top right, rgba(168,85,247,0.16), transparent 26%), linear-gradient(180deg, #0b0f17 0%, #0a0d14 100%)",
      }}
    >
      <div style={{ flex: 1, width: "100%", position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onSelectionChange={onSelectionChange}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          onError={(id, message) => {
            if (message.includes('ResizeObserver')) return;
            console.error(id, message);
          }}
        >
          <Controls />
          <MiniMap
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.14)",
            }}
          />
          <Background variant="dots" gap={18} size={1} color="rgba(148,163,184,0.24)" />

          

          {viewHistory.length > 0 && (
            <Panel position="bottom-left">
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "999px",
                  background: "rgba(15, 23, 42, 0.82)",
                  border: "1px solid rgba(148,163,184,0.14)",
                  color: "#cbd5e1",
                  fontSize: "12px",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
                }}
              >
                <span style={{ color: "#94a3b8" }}>Path</span>
                <span>System Overview</span>
                {viewHistory.map((entry) => (
                  <span key={`${entry.id}-${entry.label}`} style={{ color: "#94a3b8" }}>
                    / {entry.label}
                  </span>
                ))}
              </div>
            </Panel>
          )}

        </ReactFlow>

      </div>
    </div>
  );
}
