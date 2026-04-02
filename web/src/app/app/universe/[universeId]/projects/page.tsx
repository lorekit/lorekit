"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Film,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  MoreVertical,
  X,
  Check,
  Copy,
} from "lucide-react";
import { getUniverseProjects, deleteProject, updateProject, type Project } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-600/20 text-slate-400 border-slate-600/30",
  story_ready: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  generating: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  clips_ready: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  assembling: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  rendered: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  published: "bg-green-500/20 text-green-400 border-green-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  story_ready: "Story Ready",
  generating: "Generating",
  clips_ready: "Clips Ready",
  assembling: "Assembling",
  rendered: "Rendered",
  published: "Published",
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UniverseProjectsPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = use(params);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Menu open
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getUniverseProjects(universeId)
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [universeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteProject(id);
        setProjects((prev) => prev.filter((p) => p.id !== id));
        setDeletingId(null);
      } catch {
        setError("Failed to delete project");
      }
    },
    []
  );

  const handleRename = useCallback(
    async (id: string) => {
      if (!editName.trim()) return;
      try {
        const updated = await updateProject(id, { name: editName.trim() });
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
        );
        setEditingId(null);
      } catch {
        setError("Failed to rename project");
      }
    },
    [editName]
  );

  const handleDuplicate = useCallback(
    (project: Project) => {
      // Navigate to generate wizard pre-filled
      window.location.href = `/app/universe/${universeId}/projects/generate?character=${project.character_id}`;
    },
    [universeId]
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Projects</h1>
          <p className="text-slate-400 mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href={`/app/universe/${universeId}/projects/generate`}>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 mb-6 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-slate-800 p-4 mb-4">
            <Sparkles className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No projects yet</h2>
          <p className="text-slate-400 mb-6 max-w-sm">
            Create your first video project to get started.
          </p>
          <Link href={`/app/universe/${universeId}/projects/generate`}>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>
      )}

      {/* Project Grid */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => {
            const isDeleting = deletingId === project.id;
            const isEditing = editingId === project.id;
            const isMenuOpen = menuOpenId === project.id;

            return (
              <div
                key={project.id}
                className={cn(
                  "bg-slate-900 rounded-xl border transition-all relative group",
                  isDeleting
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-slate-800 hover:border-slate-700"
                )}
              >
                {/* Delete confirmation overlay */}
                {isDeleting && (
                  <div className="absolute inset-0 z-10 bg-slate-950/90 flex flex-col items-center justify-center gap-3 p-6 rounded-xl">
                    <p className="text-sm text-slate-300 text-center">
                      Delete <span className="font-medium text-white">{project.name}</span>?
                    </p>
                    <p className="text-xs text-slate-500 text-center">
                      This will remove the project and all generated clips.
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(project.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Thumbnail */}
                <Link href={`/app/universe/${universeId}/projects/${project.id}`}>
                  <div className="relative aspect-video bg-slate-800 cursor-pointer">
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Film className="w-10 h-10 text-slate-600" />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Content */}
                <div className="p-4">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(project.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRename(project.id)}
                          className="text-emerald-400 hover:text-emerald-300 shrink-0"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-slate-500 hover:text-slate-300 shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Link href={`/app/universe/${universeId}/projects/${project.id}`} className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white hover:text-amber-400 transition-colors truncate">
                            {project.name || "Untitled"}
                          </h3>
                        </Link>

                        {/* Actions menu */}
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setMenuOpenId(isMenuOpen ? null : project.id)}
                            className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <>
                              {/* Click outside to close */}
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setMenuOpenId(null)}
                              />
                              <div className="absolute right-0 bottom-8 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]">
                                <button
                                  onClick={() => {
                                    setEditingId(project.id);
                                    setEditName(project.name || "");
                                    setMenuOpenId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Rename
                                </button>
                                <button
                                  onClick={() => {
                                    handleDuplicate(project);
                                    setMenuOpenId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  New with Same Character
                                </button>
                                <div className="border-t border-slate-700 my-1" />
                                <button
                                  onClick={() => {
                                    setDeletingId(project.id);
                                    setMenuOpenId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Character name */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm text-slate-400">
                      {project.character_name}
                    </span>
                  </div>

                  {/* Hook quote */}
                  {project.hook_quote && (
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2 italic">
                      &ldquo;{project.hook_quote}&rdquo;
                    </p>
                  )}

                  {/* Date + cost */}
                  <div className="flex items-center justify-end mt-3">
                    <div className="flex items-center gap-2">
                      {project.cost_usd > 0 && (
                        <span className="text-xs text-slate-600">
                          ${project.cost_usd.toFixed(2)}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {formatDate(project.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
