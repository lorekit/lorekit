"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Users,
  Film,
  BookOpen,
  Loader2,

} from "lucide-react";
import { getUniverse, getUniverseProjects, getUniverseCharacters } from "@/lib/api";
import type { Universe, Project, Character } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export default function UniverseDashboardPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = use(params);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getUniverse(universeId),
      getUniverseProjects(universeId).catch(() => [] as Project[]),
      getUniverseCharacters(universeId).catch(() => [] as Character[]),
    ])
      .then(([uni, proj, chars]) => {
        if (cancelled) return;
        setUniverse(uni);
        setProjects(proj);
        setCharacters(chars);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [universeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!universe) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Universe not found.</p>
        <Link
          href="/"
          className="text-amber-400 hover:underline mt-2 inline-block"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const totalSourceItems = characters.reduce(
    (sum, c) => sum + (c.quote_count ?? 0),
    0
  );

  const recentProjects = projects.slice(0, 6);

  return (
    <div className="p-8 space-y-6">
      <div className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Characters</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {universe.character_count}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Source Items</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {totalSourceItems}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Projects</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {universe.project_count}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                <Film className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/app/universe/${universeId}/projects/generate`}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-slate-950 hover:bg-amber-400 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Generate
          </Link>
          <Link
            href={`/app/universe/${universeId}/characters`}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <Users className="h-4 w-4" />
            Browse Characters
          </Link>
          <Link
            href={`/app/universe/${universeId}/projects`}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <Film className="h-4 w-4" />
            View Projects
          </Link>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Recent Projects</h2>
          {projects.length > 6 && (
            <Link
              href={`/app/universe/${universeId}/projects`}
              className="text-sm text-amber-500 hover:text-amber-400 transition-colors"
            >
              View all &rarr;
            </Link>
          )}
        </div>

        {recentProjects.length === 0 ? (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
            <Film className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No projects yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Generate your first video to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/app/projects/${project.id}`}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-slate-700 transition-colors group"
              >
                {/* Thumbnail */}
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
