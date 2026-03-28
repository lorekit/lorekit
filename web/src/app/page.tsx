"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Users,
  Film,
  Quote,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { getProjects, getStats } from "@/lib/api";
import type { Project, Stats } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  story_ready: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  generating: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  clips_ready: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  assembling: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
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
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoadingStats(false));

    getProjects()
      .then((data) => setProjects((data || []).slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, []);

  const statCards = [
    {
      label: "Total Videos",
      value: stats ? (stats.videos?.total ?? 0).toString() : "\u2014",
      icon: Film,
    },
    {
      label: "Total Quotes",
      value: stats ? (stats.quotes?.total_quotes ?? 0).toLocaleString() : "\u2014",
      icon: Quote,
    },
    {
      label: "Total Cost",
      value: stats ? `$${(stats.videos?.total_cost ?? 0).toFixed(2)}` : "\u2014",
      icon: DollarSign,
    },
    {
      label: "Avg Cost / Video",
      value: stats ? `$${(stats.videos?.avg_cost ?? 0).toFixed(2)}` : "\u2014",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            LoreKit
          </h1>
          <p className="text-slate-400 mt-1">
            Universe-based AI video creation studio
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-amber-400 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Generate New Video
          </Link>
          <Link
            href="/characters"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <Users className="h-4 w-4" />
            Browse Characters
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <Film className="h-4 w-4" />
            View Projects
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-slate-900 rounded-xl p-5 border border-slate-800"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{card.label}</p>
                  <p
                    className={cn(
                      "text-2xl font-bold mt-1",
                      loadingStats ? "text-slate-500 animate-pulse" : "text-white"
                    )}
                  >
                    {card.value}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Projects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Recent Projects</h2>
          <Link
            href="/projects"
            className="text-sm text-amber-500 hover:text-amber-400 transition-colors"
          >
            View all &rarr;
          </Link>
        </div>

        {loadingProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden animate-pulse"
              >
                <div className="h-36 bg-slate-800" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-800 rounded w-1/2" />
                  <div className="flex items-center justify-between">
                    <div className="h-5 bg-slate-800 rounded w-16" />
                    <div className="h-3 bg-slate-800 rounded w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
            <Film className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No projects yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Generate your first video to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-colors group"
              >
                {/* Thumbnail placeholder */}
                <div className="h-36 bg-slate-800 flex items-center justify-center">
                  {project.thumbnail_url ? (
                    <img
                      src={project.thumbnail_url}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="h-8 w-8 text-slate-600 group-hover:text-slate-500 transition-colors" />
                  )}
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-white truncate group-hover:text-amber-400 transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {project.character_name}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <Badge
                      className={cn(
                        STATUS_STYLES[project.status] ?? STATUS_STYLES.draft
                      )}
                    >
                      {STATUS_LABELS[project.status] ?? project.status}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
