"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Film,
  Image,
  Music,
  Download,
  FolderOpen,
  Loader2,
  Video,
  FileAudio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getUniverseProjects,
  listProjectAssets,
  API_BASE,
  type ProjectAsset,
} from "@/lib/api";

interface ProjectWithAssets {
  id: string;
  name: string;
  status: string;
  character_id: string;
  created_at: string;
  assets: ProjectAsset[];
  loading: boolean;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Film; color: string }> = {
  renders: { label: "Renders", icon: Video, color: "text-amber-400" },
  clips: { label: "Clips", icon: Film, color: "text-blue-400" },
  keyframes: { label: "Keyframes", icon: Image, color: "text-emerald-400" },
  audio: { label: "Audio", icon: Music, color: "text-purple-400" },
};

function getCategoryIcon(category: string) {
  return CATEGORY_META[category]?.icon || FileAudio;
}

function getCategoryColor(category: string) {
  return CATEGORY_META[category]?.color || "text-slate-400";
}

export default function AssetsPage() {
  const { universeId } = useParams<{ universeId: string }>();
  const [projects, setProjects] = useState<ProjectWithAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    getUniverseProjects(universeId)
      .then((data) => {
        const items: ProjectWithAssets[] = data.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          character_id: p.character_id,
          created_at: p.created_at,
          assets: [],
          loading: false,
        }));
        setProjects(items);
        // Auto-expand the first project
        if (items.length > 0) {
          setExpandedProject(items[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [universeId]);

  const loadAssets = useCallback(async (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, loading: true } : p))
    );
    try {
      const data = await listProjectAssets(projectId);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, assets: data.assets, loading: false } : p
        )
      );
    } catch {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, loading: false } : p))
      );
    }
  }, []);

  const handleToggleProject = useCallback(
    (projectId: string) => {
      if (expandedProject === projectId) {
        setExpandedProject(null);
      } else {
        setExpandedProject(projectId);
        const proj = projects.find((p) => p.id === projectId);
        if (proj && proj.assets.length === 0 && !proj.loading) {
          loadAssets(projectId);
        }
      }
    },
    [expandedProject, projects, loadAssets]
  );

  const handleDownload = (url: string) => {
    const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
    window.open(fullUrl, "_blank");
  };

  // Collect all categories across all loaded assets for filtering
  const allCategories = new Set<string>();
  projects.forEach((p) => p.assets.forEach((a) => allCategories.add(a.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FolderOpen className="w-7 h-7 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Assets</h1>
        </div>
        <p className="text-slate-400 text-sm">
          All generated files across your projects — clips, renders, keyframes, and audio.
        </p>
      </div>

      {/* Category filter */}
      {allCategories.size > 0 && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              !filter ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            )}
          >
            All
          </button>
          {Array.from(allCategories).sort().map((cat) => {
            const meta = CATEGORY_META[cat];
            return (
              <button
                key={cat}
                onClick={() => setFilter(filter === cat ? null : cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  filter === cat
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                )}
              >
                {meta?.label || cat}
              </button>
            );
          })}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No projects yet. Generate your first video to see assets here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => {
            const isExpanded = expandedProject === project.id;
            const filteredAssets = filter
              ? project.assets.filter((a) => a.category === filter)
              : project.assets;

            return (
              <div
                key={project.id}
                className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden"
              >
                {/* Project header */}
                <button
                  onClick={() => handleToggleProject(project.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <Film className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {project.name || project.id}
                    </p>
                    <p className="text-xs text-slate-500">
                      {project.status} &middot; {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {project.assets.length > 0 && (
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                      {project.assets.length} files
                    </span>
                  )}
                  <svg
                    className={cn(
                      "w-4 h-4 text-slate-500 transition-transform",
                      isExpanded && "rotate-180"
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Assets list */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/50">
                    {project.loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                      </div>
                    ) : filteredAssets.length === 0 ? (
                      <div className="py-6 text-center text-sm text-slate-600">
                        {project.assets.length === 0
                          ? "No files generated yet for this project."
                          : "No files match this filter."}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/50">
                        {filteredAssets.map((asset) => {
                          const Icon = getCategoryIcon(asset.category);
                          const color = getCategoryColor(asset.category);
                          return (
                            <div
                              key={asset.path}
                              className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/30 transition-colors"
                            >
                              <Icon className={cn("w-4 h-4 shrink-0", color)} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-slate-200 truncate">
                                  {asset.filename}
                                </p>
                                <p className="text-xs text-slate-600">
                                  {CATEGORY_META[asset.category]?.label || asset.category}
                                  {asset.scene_id != null && ` — Scene ${asset.scene_id}`}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(asset.url)}
                                className="gap-1.5 text-xs text-slate-400 hover:text-white"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
