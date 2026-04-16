"use client";

import React, { useCallback, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/stores/workflow-store";
import { clipUrl } from "@/lib/api";
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

function getCategoryFromType(type: string): string {
  if (type === "scene" || type === "transition") return "content";
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
// Custom Node Component
// ---------------------------------------------------------------------------

type WorkflowNodeData = {
  workflowNode: WorkflowNode;
  category: string;
};

function WorkflowNodeComponent({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const { workflowNode, category } = data;
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.transform;
  const statusStyle = STATUS_STYLES[workflowNode.status];
  const IconComponent = style.icon;
  const inputKeys = Object.keys(workflowNode.inputs);
  const outputKeys = Object.keys(workflowNode.outputs);

  // Check for thumbnail in outputs — show for any completed node with a URL
  const thumbnailUrl = useMemo(() => {
    if (workflowNode.status !== "completed") return null;
    const urlVal = workflowNode.outputs.url;
    if (typeof urlVal === "string" && urlVal.length > 5) {
      return clipUrl(urlVal);
    }
    // Fallback: check all output values
    for (const val of Object.values(workflowNode.outputs)) {
      if (typeof val === "string" && (val.startsWith("http") || val.startsWith("projects/") || val.startsWith("characters/"))) {
        return clipUrl(val);
      }
    }
    return null;
  }, [workflowNode.status, workflowNode.outputs]);

  const isVideo = thumbnailUrl?.includes(".mp4") || workflowNode.type.includes("kling");

  return (
    <div
      className={cn(
        "rounded-xl border-2 min-w-[200px] max-w-[260px] shadow-lg transition-shadow",
        style.border,
        style.bg,
        "bg-slate-900/95 backdrop-blur-sm",
        selected && "ring-2 ring-amber-500/60 shadow-amber-500/20"
      )}
    >
      {/* Input handles */}
      {inputKeys.length > 0 ? (
        inputKeys.map((key, i) => (
          <Handle
            key={`in-${key}`}
            type="target"
            position={Position.Left}
            id={key}
            className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-700 hover:!bg-amber-400"
            style={{ top: `${((i + 1) / (inputKeys.length + 1)) * 100}%` }}
          />
        ))
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          id="default"
          className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-700 hover:!bg-amber-400"
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50">
        <div className={cn("p-1 rounded-md", style.bg)}>
          <IconComponent className={cn("w-4 h-4", style.accent)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-300 truncate">
            {workflowNode.label}
          </p>
          <p className="text-[10px] text-slate-500 font-mono truncate">
            {workflowNode.type}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", statusStyle.dot)} />
        </div>
      </div>

      {/* Thumbnail preview */}
      {thumbnailUrl && (
        <div className="px-2 pt-2">
          {isVideo ? (
            <video
              src={thumbnailUrl}
              muted
              playsInline
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
              onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
              className="w-full h-28 object-cover rounded-md border border-slate-700/50"
            />
          ) : (
            <img
              src={thumbnailUrl}
              alt="Output"
              className="w-full h-28 object-cover rounded-md border border-slate-700/50"
            />
          )}
        </div>
      )}

      {/* Footer: cost + status */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] text-slate-500">
          {workflowNode.cost > 0 ? `${workflowNode.cost} credits` : ""}
        </span>
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
            className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-700 hover:!bg-amber-400"
            style={{ top: `${((i + 1) / (outputKeys.length + 1)) * 100}%` }}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="default"
          className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-700 hover:!bg-amber-400"
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
}

export function WorkflowCanvas({ onNodesChange }: WorkflowCanvasProps) {
  const { workflow, selectedNodeId, setSelectedNode, updateNodePosition } =
    useWorkflowStore();

  // Convert workflow nodes to React Flow nodes
  const initialNodes: Node<WorkflowNodeData>[] = useMemo(() => {
    if (!workflow) return [];
    return Object.values(workflow.nodes).map((wn) => ({
      id: wn.id,
      type: "workflowNode",
      position: wn.position,
      selected: wn.id === selectedNodeId,
      data: {
        workflowNode: wn,
        category: getCategoryFromType(wn.type),
      },
    }));
  }, [workflow, selectedNodeId]);

  // Convert workflow node inputs to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    if (!workflow) return [];
    const edges: Edge[] = [];
    for (const node of Object.values(workflow.nodes)) {
      for (const [inputKey, sourceRef] of Object.entries(node.inputs)) {
        // sourceRef format: "nodeId" or "nodeId.outputKey"
        const parts = sourceRef.split(".");
        const sourceNodeId = parts[0];
        const sourceHandle = parts[1] || "default";
        if (workflow.nodes[sourceNodeId]) {
          edges.push({
            id: `${sourceNodeId}-${sourceHandle}-${node.id}-${inputKey}`,
            source: sourceNodeId,
            sourceHandle,
            target: node.id,
            targetHandle: inputKey || "default",
            animated: workflow.nodes[sourceNodeId].status === "running",
            style: { stroke: "#64748b", strokeWidth: 2 },
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

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            style: { stroke: "#64748b", strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
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

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      updateNodePosition(node.id, { x: node.position.x, y: node.position.y });
    },
    [updateNodePosition]
  );

  if (!workflow) return null;

  return (
    <div className="w-full h-full">
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
            };
            return colors[category] || "#64748b";
          }}
          maskColor="rgba(2, 6, 23, 0.8)"
          className="!bg-slate-900 !border-slate-700 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
