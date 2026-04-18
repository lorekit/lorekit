"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Plus,
  ChevronDown,
  Loader2,
  Check,
  AlertCircle,
  Circle,
  Sparkles,
  Clapperboard,
  Download,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { useWorkflowStore } from "@/stores/workflow-store";
import {
  getWorkflowNodeTypes,
  updateWorkflowFull,
} from "@/lib/api";
import type { Workflow } from "@/lib/api";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const WORKFLOW_STATUS: Record<
  Workflow["status"],
  { label: string; color: string; icon: React.ElementType }
> = {
  draft: { label: "Draft", color: "text-slate-400", icon: Circle },
  running: { label: "Running", color: "text-blue-400", icon: Loader2 },
  completed: { label: "Completed", color: "text-emerald-400", icon: Check },
  failed: { label: "Failed", color: "text-red-400", icon: AlertCircle },
  partial: { label: "Partial", color: "text-amber-400", icon: AlertCircle },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WorkflowToolbarProps {
  universeId: string;
  projectId: string;
  projectName?: string;
  onRenameProject?: (name: string) => void;
  clipsGenerated?: number;
  totalScenes?: number;
  totalDuration?: number;
  allClipsDone?: boolean;
  generatingAll?: boolean;
  allClipsProgress?: string | null;
  isRendering?: boolean;
  renderProgress?: string | null;
  isPublishing?: boolean;
  hasOutput?: boolean;
  isRendered?: boolean;
  onExecuteWorkflow?: () => void;
  onGenerateAll?: () => void;
  onRender?: () => void;
  onDownload?: () => void;
  onSelectFullVideo?: () => void;
}

export function WorkflowToolbar({
  universeId,
  projectId,
  projectName,
  onRenameProject,
  clipsGenerated = 0,
  totalScenes = 0,
  totalDuration = 0,
  allClipsDone,
  generatingAll,
  allClipsProgress,
  isRendering,
  renderProgress,
  isPublishing,
  hasOutput,
  isRendered,
  onExecuteWorkflow,
  onGenerateAll,
  onRender,
  onDownload,
  onSelectFullVideo,
}: WorkflowToolbarProps) {
  const { workflow, setWorkflow } = useWorkflowStore();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [nodeTypes, setNodeTypes] = useState<
    Array<{ type: string; category: string; label: string; input_keys: string[]; output_keys: string[] }>
  >([]);
  const [loadingNodeTypes, setLoadingNodeTypes] = useState(false);

  const loadNodeTypes = useCallback(async () => {
    if (nodeTypes.length > 0) return;
    setLoadingNodeTypes(true);
    try {
      const data = await getWorkflowNodeTypes();
      setNodeTypes(data.node_types);
    } catch {} finally {
      setLoadingNodeTypes(false);
    }
  }, [nodeTypes.length]);

  const handleAddNode = useCallback(
    async (type: string, label: string) => {
      if (!workflow) return;
      setShowAddMenu(false);
      try {
        const existingNodes = Object.values(workflow.nodes);
        let x = 100, y = 100;
        if (existingNodes.length > 0) {
          const maxX = Math.max(...existingNodes.map((n) => n.position?.x ?? 0));
          const maxY = Math.max(...existingNodes.map((n) => n.position?.y ?? 0));
          x = maxX + 350;
          y = maxY > 400 ? 100 : maxY;
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

  // Close dropdown on outside click
  useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-add-menu]")) setShowAddMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddMenu]);

  const statusInfo = workflow ? WORKFLOW_STATUS[workflow.status] : null;
  const StatusIcon = statusInfo?.icon || Circle;
  const isRunning = workflow?.status === "running";

  const groupedNodeTypes = nodeTypes.reduce<Record<string, typeof nodeTypes>>(
    (acc, nt) => {
      const cat = nt.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(nt);
      return acc;
    },
    {}
  );
  const categoryOrder = ["image", "video", "audio", "local", "transform", "other"];

  return (
    <div className="flex items-center gap-2 px-3 h-10 bg-black border-b border-slate-800 z-20 flex-shrink-0">
      {/* Left: Back + project name */}
      <Link
        href={`/app/universe/${universeId}`}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-md px-2.5 py-1.5 transition-colors flex-shrink-0"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Dashboard
      </Link>

      <div className="w-px h-5 bg-slate-800 flex-shrink-0" />

      {editingName ? (
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            if (nameDraft.trim() && nameDraft.trim() !== projectName) {
              onRenameProject?.(nameDraft.trim());
            }
            setEditingName(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setEditingName(false); }
          }}
          className="text-sm font-semibold text-white bg-slate-800 border border-slate-600 rounded px-2 py-0.5 outline-none focus:border-amber-500 max-w-[240px]"
        />
      ) : (
        <button
          onClick={() => { setNameDraft(projectName || ""); setEditingName(true); }}
          className="text-sm font-semibold text-white truncate max-w-[240px] hover:text-amber-400 transition-colors cursor-text"
        >
          {projectName || "Untitled Project"}
        </button>
      )}

      {/* Clip count */}
      {totalScenes > 0 && (
        <span className="text-[10px] text-slate-500 hidden md:inline">
          {clipsGenerated}/{totalScenes} clips &middot; {formatDuration(totalDuration)}
        </span>
      )}

      {/* Progress messages */}
      {(renderProgress || allClipsProgress) && (
        <span className="text-[10px] text-amber-400 animate-pulse max-w-40 truncate">
          {allClipsProgress || renderProgress}
        </span>
      )}

      <div className="flex-1" />

      {/* Preview button */}
      {clipsGenerated > 0 && (
        <button
          onClick={onSelectFullVideo}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Play className="w-3 h-3" />
          Preview
        </button>
      )}

      {/* Generate All */}
      {totalScenes > 0 && (!allClipsDone || generatingAll) && (
        <button
          onClick={onGenerateAll}
          disabled={!!generatingAll || totalScenes === 0}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          {generatingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {generatingAll ? "Generating..." : "Generate All"}
        </button>
      )}

      {/* Render */}
      <button
        onClick={onRender}
        disabled={isRendering || totalScenes === 0}
        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 rounded-md disabled:opacity-40 transition-colors"
      >
        {isRendering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clapperboard className="w-3 h-3" />}
        {isRendering ? "Rendering..." : "Render"}
      </button>

      {/* Execute Workflow */}
      <button
        onClick={onExecuteWorkflow}
        disabled={isRunning || !workflow}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors",
          isRunning
            ? "bg-blue-500/20 text-blue-300 cursor-not-allowed"
            : "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
        )}
      >
        {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
        {isRunning ? "Running..." : "Execute"}
      </button>

      {/* Download */}
      {hasOutput && (
        <button
          onClick={onDownload}
          disabled={!!isPublishing || !isRendered}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-slate-300 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          <Download className="w-3 h-3" />
          Download
        </button>
      )}
    </div>
  );
}
