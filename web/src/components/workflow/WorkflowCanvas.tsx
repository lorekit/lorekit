"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Image as ImageIcon,
  Film,
  Volume2,
  Terminal,
  Shuffle,
  Clapperboard,
  Loader2,
  Check,
  X,
  AlertCircle,
  Clock,
  Play,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/stores/workflow-store";
import { clipUrl, getWorkflowNodeTypes, updateWorkflowFull } from "@/lib/api";
import type { WorkflowNode } from "@/lib/api";

// ---------------------------------------------------------------------------
// Category styling
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<
  string,
  { border: string; bg: string; icon: React.ElementType; accent: string }
> = {
  image: {
    border: "border-blue-500/60",
    bg: "bg-blue-500/10",
    icon: ImageIcon,
    accent: "text-blue-400",
  },
  video: {
    border: "border-purple-500/60",
    bg: "bg-purple-500/10",
    icon: Film,
    accent: "text-purple-400",
  },
  audio: {
    border: "border-emerald-500/60",
    bg: "bg-emerald-500/10",
    icon: Volume2,
    accent: "text-emerald-400",
  },
  local: {
    border: "border-orange-500/60",
    bg: "bg-orange-500/10",
    icon: Terminal,
    accent: "text-orange-400",
  },
  transform: {
    border: "border-amber-500/60",
    bg: "bg-amber-500/10",
    icon: Shuffle,
    accent: "text-amber-400",
  },
  content: {
    border: "border-cyan-500/60",
    bg: "bg-cyan-500/10",
    icon: Clapperboard,
    accent: "text-cyan-400",
  },
};

export function getCategoryFromType(type: string): string {
  if (type === "scene" || type === "transition" || type === "character_ref") return "content";
  if (type.includes("image") || type.includes("keyframe") || type.includes("kontext")) return "image";
  if (type.includes("video") || type.includes("kling") || type.includes("minimax") || type.includes("wan")) return "video";
  if (type.includes("audio") || type.includes("tts") || type.includes("narrat") || type.includes("music")) return "audio";
  if (type.includes("ffmpeg") || type.includes("render") || type.includes("concat") || type.includes("compose")) return "local";
  return "transform";
}

const STATUS_STYLES: Record<
  WorkflowNode["status"],
  { dot: string; label: string; icon: React.ElementType }
> = {
  pending: { dot: "bg-slate-500", label: "Pending", icon: Clock },
  running: { dot: "bg-blue-500 animate-pulse", label: "Running", icon: Loader2 },
  completed: { dot: "bg-emerald-500", label: "Done", icon: Check },
  failed: { dot: "bg-red-500", label: "Failed", icon: X },
  skipped: { dot: "bg-slate-600", label: "Skipped", icon: AlertCircle },
};

// ---------------------------------------------------------------------------
// Resolve media URL from a node
// ---------------------------------------------------------------------------

function resolveFileUrl(val: string): string {
  if (val.startsWith("http")) return val;
  // Local paths need /files/ prefix for the backend file server
  const normalized = val.startsWith("/") ? val : `/${val}`;
  return clipUrl(normalized.startsWith("/files/") ? normalized : `/files${normalized}`);
}

function getMediaUrl(node: WorkflowNode): string | null {
  if (node.status !== "completed") return null;
  const urlVal = node.outputs.url;
  if (typeof urlVal === "string" && urlVal.length > 5) return resolveFileUrl(urlVal);
  for (const val of Object.values(node.outputs)) {
    if (typeof val === "string" && (val.startsWith("http") || val.startsWith("projects/") || val.startsWith("characters/"))) {
      return resolveFileUrl(val);
    }
  }
  return null;
}

function isVideoType(node: WorkflowNode, url: string | null): boolean {
  return !!(url?.includes(".mp4")) || node.type.includes("kling") || node.type.includes("wan") || node.type.includes("minimax");
}

// ---------------------------------------------------------------------------
// Custom Node Component — Media-Rich
// ---------------------------------------------------------------------------

export type WorkflowNodeData = {
  workflowNode: WorkflowNode;
  category: string;
  onExecuteNode?: (nodeId: string) => void;
};

/** Kontext max supports up to 4 reference images */
const MAX_KEYFRAME_REFS = 4;
const KEYFRAME_REF_HANDLES = Array.from({ length: MAX_KEYFRAME_REFS }, (_, i) => `ref_${i + 1}`);

function isKeyframeNode(wn: WorkflowNode): boolean {
  return wn.type === "scene" || (wn.params.scene_id != null && wn.type.includes("keyframe"));
}

/** Count how many ref handles are connected on a keyframe node */
function countConnectedRefs(wn: WorkflowNode): number {
  return KEYFRAME_REF_HANDLES.filter((h) => wn.inputs[h]).length;
}

function WorkflowNodeComponent({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const { workflowNode, category, onExecuteNode } = data;
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.transform;
  const statusStyle = STATUS_STYLES[workflowNode.status];
  const IconComponent = style.icon;

  // For keyframe nodes, show connected ref handles + 1 empty slot (up to MAX_KEYFRAME_REFS)
  const isKeyframe = isKeyframeNode(workflowNode);
  const isKontextEdit = workflowNode.type === "kontext_edit";
  const isStitch = workflowNode.type === "video_stitch";
  const inputKeys = useMemo(() => {
    // Kontext Edit: always exactly 1 input handle
    if (isKontextEdit) return ["image"];
    // Stitch: show all connected inputs + keep existing
    if (isStitch) return Object.keys(workflowNode.inputs).length > 0
      ? Object.keys(workflowNode.inputs)
      : ["clips"];
    if (isKeyframe) {
      const connected = countConnectedRefs(workflowNode);
      const visibleCount = Math.min(connected + 1, MAX_KEYFRAME_REFS);
      const refHandles = KEYFRAME_REF_HANDLES.slice(0, visibleCount);
      const otherInputs = Object.keys(workflowNode.inputs).filter((k) => !k.startsWith("ref_"));
      return [...refHandles, ...otherInputs];
    }
    return Object.keys(workflowNode.inputs);
  }, [isKeyframe, isKontextEdit, isStitch, workflowNode.inputs]);

  // Always include "url" as an output handle since it's the standard output key
  // for generation nodes, even before they have outputs
  const outputKeys = Object.keys(workflowNode.outputs);
  if (outputKeys.length === 0) outputKeys.push("url");
  const [isHovering, setIsHovering] = React.useState(false);

  // Determine the thumbnail to show
  const mediaUrl = useMemo(() => {
    // Direct output from this node
    const directUrl = getMediaUrl(workflowNode);
    if (directUrl) return directUrl;

    return null;
  }, [workflowNode]);

  const isVideo = mediaUrl ? isVideoType(workflowNode, mediaUrl) : false;

  const sceneBeat = isKeyframe ? workflowNode.params.beat : null;
  // Count connected refs for keyframe nodes
  const connectedRefs = isKeyframe ? countConnectedRefs(workflowNode) : 0;
  // Show duration on clip/video nodes instead
  const isClipNode = workflowNode.type.includes("kling") || workflowNode.type.includes("wan") || workflowNode.type.includes("minimax");
  const clipDuration = isClipNode ? workflowNode.params.duration : null;

  return (
    <div
      className={cn(
        "rounded-xl border-2 shadow-lg transition-all group",
        "w-[260px]",
        style.border,
        "bg-slate-900/95 backdrop-blur-sm",
        selected && "ring-2 ring-amber-500/60 shadow-amber-500/20",
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Input handles */}
      {inputKeys.length > 0 ? (
        inputKeys.map((key, i) => (
          <Handle
            key={`in-${key}`}
            type="target"
            position={Position.Left}
            id={key}
            className="!w-3.5 !h-3.5 !bg-slate-400 !border-2 !border-slate-700 hover:!bg-amber-400 !transition-colors"
            style={{ top: `${((i + 1) / (inputKeys.length + 1)) * 100}%` }}
          />
        ))
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          id="default"
          className="!w-3.5 !h-3.5 !bg-slate-400 !border-2 !border-slate-700 hover:!bg-amber-400 !transition-colors"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50">
        <div className={cn("p-1 rounded-md", style.bg)}>
          <IconComponent className={cn("w-4 h-4", style.accent)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">
            {workflowNode.label}
          </p>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] text-slate-500 font-mono truncate">
              {workflowNode.type}
            </p>
            {clipDuration && (
              <span className="text-[10px] text-amber-400 font-medium">{clipDuration}s</span>
            )}
            {isKeyframe && connectedRefs > 0 && (
              <span className="text-[10px] text-cyan-400 font-medium">{connectedRefs} ref{connectedRefs !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {sceneBeat && (
            <span className="text-[9px] font-medium text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              {sceneBeat}
            </span>
          )}
          <div className={cn("w-2.5 h-2.5 rounded-full", statusStyle.dot)} />
        </div>
      </div>

      {/* Media preview — larger for visibility */}
      {mediaUrl && (
        <div className="px-2 pt-2">
          {isVideo ? (
            <video
              src={mediaUrl}
              muted
              playsInline
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
              onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
              className="w-full h-40 object-cover rounded-lg border border-slate-700/50"
            />
          ) : (
            <img
              src={mediaUrl}
              alt={workflowNode.label}
              className="w-full h-40 object-cover rounded-lg border border-slate-700/50"
            />
          )}
        </div>
      )}

      {/* Pending state placeholder for gen nodes */}
      {!mediaUrl && workflowNode.status === "pending" && category !== "content" && category !== "local" && (
        <div className="px-2 pt-2">
          <div className="w-full h-24 rounded-lg border border-dashed border-slate-700/50 bg-slate-800/30 flex items-center justify-center">
            <span className="text-[10px] text-slate-600">Waiting for input...</span>
          </div>
        </div>
      )}

      {/* Running state */}
      {workflowNode.status === "running" && (
        <div className="px-2 pt-2">
          <div className="w-full h-24 rounded-lg border border-blue-500/30 bg-blue-500/5 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-[10px] text-blue-400">Generating...</span>
          </div>
        </div>
      )}

      {/* Keyframe node: show visual description snippet */}
      {isKeyframe && !mediaUrl && workflowNode.status !== "running" && (
        <div className="px-3 pt-2">
          <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
            {workflowNode.params.visual_description || "No description yet"}
          </p>
        </div>
      )}

      {/* Footer: cost + status + run button */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] text-slate-500">
          {workflowNode.cost > 0 ? `${workflowNode.cost} credits` : ""}
        </span>
        <div className="flex items-center gap-2">
          {/* Run button — visible on hover for pending nodes */}
          {isHovering && workflowNode.status === "pending" && onExecuteNode && (
            <button
              onClick={(e) => { e.stopPropagation(); onExecuteNode(workflowNode.id); }}
              className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded transition-colors"
            >
              <Play className="w-3 h-3" />
              Run
            </button>
          )}
          <span
            className={cn(
              "text-[10px] font-medium",
              workflowNode.status === "completed" && "text-emerald-400",
              workflowNode.status === "failed" && "text-red-400",
              workflowNode.status === "running" && "text-blue-400",
              workflowNode.status === "pending" && "text-slate-500",
              workflowNode.status === "skipped" && "text-slate-600"
            )}
          >
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* Error message */}
      {workflowNode.error && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1 truncate">
            {workflowNode.error}
          </p>
        </div>
      )}

      {/* Output handles */}
      {outputKeys.length > 0 ? (
        outputKeys.map((key, i) => (
          <Handle
            key={`out-${key}`}
            type="source"
            position={Position.Right}
            id={key}
            className="!w-3.5 !h-3.5 !bg-slate-400 !border-2 !border-slate-700 hover:!bg-amber-400 !transition-colors"
            style={{ top: `${((i + 1) / (outputKeys.length + 1)) * 100}%` }}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="default"
          className="!w-3.5 !h-3.5 !bg-slate-400 !border-2 !border-slate-700 hover:!bg-amber-400 !transition-colors"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node types registry
// ---------------------------------------------------------------------------

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNodeComponent,
};

// ---------------------------------------------------------------------------
// Canvas Component
// ---------------------------------------------------------------------------

interface WorkflowCanvasProps {
  onNodesChange?: (nodes: Node[]) => void;
  onExecuteNode?: (nodeId: string) => void;
  onDropImage?: (imageUrl: string, label: string, position: { x: number; y: number }) => void;
}

export function WorkflowCanvas({ onNodesChange, onExecuteNode, onDropImage }: WorkflowCanvasProps) {
  const { workflow, selectedNodeId, setSelectedNode, updateNodePosition, addNodeInput, removeNode } =
    useWorkflowStore();
  const reactFlowRef = React.useRef<HTMLDivElement>(null);

  // Convert workflow nodes to React Flow nodes with connected media info
  const initialNodes: Node<WorkflowNodeData>[] = useMemo(() => {
    if (!workflow) return [];

    return Object.values(workflow.nodes)
      .filter((wn) => wn.type !== "transition") // Transitions live on the timeline, not the canvas
      .map((wn) => {
      return {
        id: wn.id,
        type: "workflowNode",
        position: wn.position,
        selected: wn.id === selectedNodeId,
        data: {
          workflowNode: wn,
          category: getCategoryFromType(wn.type),
          onExecuteNode,
        },
      };
    });
  }, [workflow, selectedNodeId, onExecuteNode]);

  // Convert workflow node inputs to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!workflow) return [];
    const edges: Edge[] = [];
    for (const node of Object.values(workflow.nodes)) {
      for (const [inputKey, sourceRef] of Object.entries(node.inputs)) {
        // sourceRef format: "nodeId.outputs.key" or "nodeId"
        const parts = sourceRef.split(".");
        const sourceNodeId = parts[0];
        const sourceHandle = parts.length > 2 ? parts[parts.length - 1] : (parts[1] || "default");
        if (workflow.nodes[sourceNodeId]) {
          const sourceNode = workflow.nodes[sourceNodeId];
          edges.push({
            id: `${sourceNodeId}-${sourceHandle}-${node.id}-${inputKey}`,
            source: sourceNodeId,
            sourceHandle,
            target: node.id,
            targetHandle: inputKey || "default",
            animated: sourceNode.status === "running",
            style: {
              stroke: sourceNode.status === "completed" ? "#10b981" : sourceNode.status === "running" ? "#3b82f6" : "#64748b",
              strokeWidth: 2,
            },
          });
        }
      }
    }
    return edges;
  }, [workflow]);

  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges);

  // Sync when workflow changes
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !workflow) return;
      const sourceHandle = connection.sourceHandle || "url";
      let targetHandle = connection.targetHandle || "default";
      const sourceRef = `${connection.source}.outputs.${sourceHandle}`;

      const targetNode = workflow.nodes[connection.target];
      const sourceNode = workflow.nodes[connection.source];

      // Kontext Edit: only 1 image input
      if (targetNode?.type === "kontext_edit") {
        if (targetNode.inputs.image) {
          setToast("Kontext Edit accepts only 1 input image");
          return;
        }
        targetHandle = "image";
      }

      // For keyframe nodes receiving character_ref connections, auto-assign ref slot
      if (targetNode && sourceNode?.type === "character_ref" && isKeyframeNode(targetNode)) {
        // Prevent connecting the same source node twice
        const alreadyConnected = Object.values(targetNode.inputs).some(
          (ref) => ref.startsWith(connection.source!)
        );
        if (alreadyConnected) {
          setToast("This image is already connected");
          return;
        }
        const connected = countConnectedRefs(targetNode);
        if (connected >= MAX_KEYFRAME_REFS) {
          setToast(`Maximum ${MAX_KEYFRAME_REFS} reference images per keyframe (Kontext multi limit)`);
          return;
        }
        // Find next available ref slot
        const nextSlot = KEYFRAME_REF_HANDLES.find((h) => !targetNode.inputs[h]);
        if (!nextSlot) {
          setToast(`Maximum ${MAX_KEYFRAME_REFS} reference images per keyframe (Kontext multi limit)`);
          return;
        }
        targetHandle = nextSlot;
      }

      addNodeInput(connection.target, targetHandle, sourceRef);
      // Persist to backend
      const wf = useWorkflowStore.getState().workflow;
      if (wf) {
        import("@/lib/api").then(({ updateWorkflowFull }) =>
          updateWorkflowFull(wf.project_id, wf).catch(console.error)
        );
      }
    },
    [addNodeInput, workflow]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  // Delete selected node on Delete/Backspace (unless typing in an input)
  const handleDeleteSelected = useCallback(() => {
    const state = useWorkflowStore.getState();
    const nodeId = state.selectedNodeId;
    if (!nodeId || !state.workflow) return;
    const node = state.workflow.nodes[nodeId];
    if (!node) return;
    // Don't delete nodes with completed downstream generations
    const hasCompletedDownstream = Object.values(state.workflow.nodes).some(
      (other) =>
        other.id !== nodeId &&
        Object.values(other.inputs).some((ref) => ref.startsWith(nodeId)) &&
        other.status === "completed"
    );
    if (hasCompletedDownstream) {
      setToast("Cannot delete: connected to completed generation");
      return;
    }
    removeNode(nodeId);
    const wf = useWorkflowStore.getState().workflow;
    if (wf) {
      import("@/lib/api").then(({ updateWorkflowFull }) =>
        updateWorkflowFull(wf.project_id, wf).catch(console.error)
      );
    }
  }, [removeNode, setToast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Don't trigger if user is typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        handleDeleteSelected();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleDeleteSelected]);

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      updateNodePosition(node.id, { x: node.position.x, y: node.position.y });
      // Persist to backend
      const wf = useWorkflowStore.getState().workflow;
      if (wf) {
        import("@/lib/api").then(({ updateWorkflowFull }) =>
          updateWorkflowFull(wf.project_id, wf).catch(console.error)
        );
      }
    },
    [updateNodePosition]
  );

  // Handle drops from the media gallery
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/workflow-image")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const data = e.dataTransfer.getData("application/workflow-image");
      if (!data || !onDropImage) return;
      e.preventDefault();
      try {
        const { image_url, label } = JSON.parse(data);
        // Convert screen coords to React Flow canvas coords
        const bounds = reactFlowRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const position = {
          x: e.clientX - bounds.left - 120,
          y: e.clientY - bounds.top - 80,
        };
        onDropImage(image_url, label, position);
      } catch {}
    },
    [onDropImage]
  );

  if (!workflow) return null;

  return (
    <div className="w-full h-full relative" ref={reactFlowRef} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{
          style: { stroke: "#64748b", strokeWidth: 2 },
          type: "smoothstep",
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-950"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1e293b"
        />
        <Controls
          className="!bg-slate-900 !border-slate-700 !rounded-lg !shadow-lg [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-400 [&>button:hover]:!bg-slate-700"
        />
        <MiniMap
          nodeColor={(node) => {
            const category = (node.data as WorkflowNodeData)?.category || "transform";
            const colors: Record<string, string> = {
              image: "#3b82f6",
              video: "#a855f7",
              audio: "#10b981",
              local: "#f97316",
              transform: "#f59e0b",
              content: "#06b6d4",
            };
            return colors[category] || "#64748b";
          }}
          maskColor="rgba(2, 6, 23, 0.8)"
          className="!bg-slate-900 !border-slate-700 !rounded-lg"
        />
      </ReactFlow>

      {/* Floating canvas toolbar — Miro/Lucidchart style */}
      <CanvasToolbar
        selectedNodeId={selectedNodeId}
        onDelete={handleDeleteSelected}
        toast={toast}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating Canvas Toolbar
// ---------------------------------------------------------------------------

function CanvasToolbar({
  selectedNodeId,
  onDelete,
  toast,
}: {
  selectedNodeId: string | null;
  onDelete: () => void;
  toast: string | null;
}) {
  const { workflow, setWorkflow } = useWorkflowStore();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nodeTypes, setNodeTypes] = useState<
    Array<{ type: string; category: string; label: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  const loadNodeTypes = useCallback(async () => {
    if (nodeTypes.length > 0) return;
    setLoading(true);
    try {
      const data = await getWorkflowNodeTypes();
      setNodeTypes(data.node_types);
    } catch {} finally {
      setLoading(false);
    }
  }, [nodeTypes.length]);

  const handleAdd = useCallback(
    async (type: string, label: string) => {
      if (!workflow) return;
      setShowAddMenu(false);
      try {
        const existingNodes = Object.values(workflow.nodes);
        let x = 200, y = 200;
        if (existingNodes.length > 0) {
          const maxX = Math.max(...existingNodes.map((n) => n.position?.x ?? 0));
          const avgY = existingNodes.reduce((s, n) => s + (n.position?.y ?? 0), 0) / existingNodes.length;
          x = maxX + 350;
          y = Math.round(avgY);
        }
        // Create node client-side and persist via PUT
        const nodeId = crypto.randomUUID().slice(0, 12);
        const newNode = {
          id: nodeId, type, label, params: {}, inputs: {}, outputs: {},
          status: "pending" as const, error: null, cost: 0, position: { x, y },
        };
        const updatedWf = {
          ...workflow,
          nodes: { ...workflow.nodes, [nodeId]: newNode },
        };
        setWorkflow(updatedWf);
        await updateWorkflowFull(updatedWf.project_id, updatedWf);
      } catch {}
    },
    [workflow, setWorkflow]
  );

  // Close on outside click
  useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest("[data-canvas-add-menu]")) setShowAddMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddMenu]);

  // Filter out transition (handled on timeline) and scene/character_ref (auto-created)
  const filteredTypes = nodeTypes.filter((nt) => !["transition", "scene", "character_ref"].includes(nt.type));
  const grouped = filteredTypes.reduce<Record<string, typeof nodeTypes>>((acc, nt) => {
    const cat = nt.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(nt);
    return acc;
  }, {});
  const catOrder = ["image", "video", "audio", "local", "transform", "content"];
  const catColors: Record<string, string> = {
    image: "text-blue-400", video: "text-purple-400", audio: "text-emerald-400",
    local: "text-orange-400", transform: "text-amber-400", content: "text-cyan-400",
  };

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-amber-500/40 text-amber-400 text-xs px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Bottom-center floating bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl px-1.5 py-1 shadow-2xl">
        {/* Add Node */}
        <div className="relative" data-canvas-add-menu>
          <button
            onClick={() => { setShowAddMenu(!showAddMenu); loadNodeTypes(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Node
            <ChevronDown className={cn("w-3 h-3 transition-transform", showAddMenu && "rotate-180")} />
          </button>

          {showAddMenu && (
            <div className="absolute bottom-full mb-2 left-0 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-1 max-h-72 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                </div>
              ) : (
                catOrder
                  .filter((cat) => grouped[cat])
                  .map((cat) => (
                    <div key={cat}>
                      <p className={cn("text-[10px] uppercase tracking-wider px-3 pt-2 pb-0.5 font-medium", catColors[cat] || "text-slate-500")}>
                        {cat}
                      </p>
                      {grouped[cat].map((nt) => (
                        <button
                          key={nt.type}
                          onClick={() => handleAdd(nt.type, nt.label)}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                        >
                          {nt.label}
                        </button>
                      ))}
                    </div>
                  ))
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-700" />

        {/* Delete selected */}
        <button
          onClick={() => selectedNodeId && setShowDeleteConfirm(true)}
          disabled={!selectedNodeId}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${selectedNodeId ? "text-red-400 hover:text-red-300 hover:bg-red-500/20 cursor-pointer" : "text-slate-600 opacity-30 cursor-not-allowed"}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-80 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">Delete Node</h3>
            <p className="text-xs text-slate-400 mb-4">
              Are you sure you want to delete this node? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(); setShowDeleteConfirm(false); }}
                className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
