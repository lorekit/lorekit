"use client";

import React, { useEffect, useState } from "react";
import {
  Image as ImageIcon,
  Film,
  Volume2,
  Terminal,
  Shuffle,
  Loader2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getWorkflowNodeTypes } from "@/lib/api";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  image: { icon: ImageIcon, color: "text-blue-400", bg: "bg-blue-500/10" },
  video: { icon: Film, color: "text-purple-400", bg: "bg-purple-500/10" },
  audio: { icon: Volume2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  local: { icon: Terminal, color: "text-orange-400", bg: "bg-orange-500/10" },
  transform: { icon: Shuffle, color: "text-amber-400", bg: "bg-amber-500/10" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NodePalette() {
  const [nodeTypes, setNodeTypes] = useState<
    Array<{ type: string; category: string; label: string; input_keys: string[]; output_keys: string[] }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["image", "video", "audio", "local", "transform"])
  );

  useEffect(() => {
    async function load() {
      try {
        const data = await getWorkflowNodeTypes().catch(() => ({ node_types: [] }));
        setNodeTypes(data.node_types);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Group and filter
  const filtered = search
    ? nodeTypes.filter(
        (nt) =>
          nt.label.toLowerCase().includes(search.toLowerCase()) ||
          nt.type.toLowerCase().includes(search.toLowerCase())
      )
    : nodeTypes;

  const grouped = filtered.reduce<Record<string, typeof nodeTypes>>(
    (acc, nt) => {
      const cat = nt.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(nt);
      return acc;
    },
    {}
  );

  const categoryOrder = ["image", "video", "audio", "local", "transform", "other"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
          Node Palette
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search nodes..."
            className="w-full bg-slate-800 text-xs text-slate-300 pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500/50 placeholder:text-slate-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Node types by category */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {categoryOrder
          .filter((cat) => grouped[cat])
          .map((cat) => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.transform;
            const CatIcon = config.icon;
            const expanded = expandedCategories.has(cat);

            return (
              <div key={cat} className="mb-2">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center gap-2 py-1.5 text-left group"
                >
                  <CatIcon className={cn("w-3.5 h-3.5", config.color)} />
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium flex-1">
                    {cat}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {grouped[cat].length}
                  </span>
                </button>
                {expanded && (
                  <div className="space-y-0.5 ml-1 mb-2">
                    {grouped[cat].map((nt) => (
                      <div
                        key={nt.type}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800/50 cursor-grab active:cursor-grabbing transition-colors group"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "application/workflow-node",
                            JSON.stringify({ type: nt.type, label: nt.label })
                          );
                          e.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        <div className={cn("w-1.5 h-1.5 rounded-full", config.bg, config.color.replace("text-", "bg-"))} />
                        <span className="text-xs text-slate-400 group-hover:text-slate-200 truncate flex-1">
                          {nt.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        {filtered.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-8">
            No matching nodes found
          </p>
        )}
      </div>
    </div>
  );
}
