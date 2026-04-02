"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Globe,
  Users,
  Film,
} from "lucide-react";
import { getUniverses } from "@/lib/api";
import type { Universe } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUniverseStore } from "@/stores/universe-store";

export default function UniversePage() {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [loading, setLoading] = useState(true);
  const { setActiveUniverse } = useUniverseStore();

  useEffect(() => {
    getUniverses()
      .then(setUniverses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalCharacters = universes.reduce((s, u) => s + (u.character_count ?? 0), 0);
  const totalProjects = universes.reduce((s, u) => s + (u.project_count ?? 0), 0);

  return (
    <div className="p-8 space-y-8">

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Universes", value: universes.length, icon: Globe },
          { label: "Characters", value: totalCharacters, icon: Users },
          { label: "Projects", value: totalProjects, icon: Film },
        ].map((card) => {
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
                      loading ? "text-slate-500 animate-pulse" : "text-white"
                    )}
                  >
                    {loading ? "\u2014" : card.value}
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

      {/* Universe Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Your Universes</h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-900 rounded-xl border border-slate-800 p-6 animate-pulse"
              >
                <div className="h-12 w-12 bg-slate-800 rounded-lg mb-4" />
                <div className="h-5 bg-slate-800 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {universes.map((uni) => (
              <Link
                key={uni.id}
                href={`/app/universe/${uni.id}`}
                onClick={() => setActiveUniverse(uni.id)}
                className="bg-slate-900 rounded-xl border border-slate-800 p-6 hover:border-slate-700 transition-all group"
              >
                <div className="text-4xl mb-3">{uni.icon || "🌐"}</div>
                <h3 className="text-lg font-semibold text-white group-hover:text-amber-400 transition-colors">
                  {uni.name}
                </h3>
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                  {uni.description || "No description"}
                </p>
                <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {uni.character_count ?? 0} characters
                  </span>
                  <span className="flex items-center gap-1">
                    <Film className="h-3.5 w-3.5" />
                    {uni.project_count ?? 0} projects
                  </span>
                </div>
                {uni.video_vibe_preset && (
                  <div className="mt-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {uni.video_vibe_preset.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </div>
                )}
              </Link>
            ))}

            {/* Create Universe Card */}
            <Link
              href="/app/universes/new"
              className="bg-slate-900 rounded-xl border border-dashed border-slate-700 p-6 hover:border-slate-600 transition-all flex flex-col items-center justify-center text-center min-h-[200px]"
            >
              <div className="h-12 w-12 rounded-lg bg-slate-800 flex items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-300">
                Create Universe
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Start a new creative world
              </p>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
