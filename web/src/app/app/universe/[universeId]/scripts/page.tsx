"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ScrollText } from "lucide-react";
import {
  getUniverseScripts,
  getUniverseCharacters,
  createScript,
} from "@/lib/api";
import type { Script, Character } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TYPE_FILTERS = [
  { label: "All", value: null },
  { label: "Ideas", value: "idea" },
  { label: "Outlines", value: "outline" },
  { label: "Full Scripts", value: "full_script" },
] as const;

const TYPE_COLORS: Record<string, string> = {
  idea: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  outline: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  full_script: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ready: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  archived: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

function parseCharacterIds(json: string | null): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export default function ScriptsPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = use(params);
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getUniverseScripts(universeId, typeFilter ? { script_type: typeFilter } : undefined),
      getUniverseCharacters(universeId),
    ])
      .then(([s, c]) => {
        if (!cancelled) {
          setScripts(s);
          setCharacters(c);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [universeId, typeFilter]);

  const charMap = new Map(characters.map((c) => [c.id, c]));

  async function handleCreate() {
    setCreating(true);
    try {
      const script = await createScript(universeId, { title: "Untitled Script" });
      router.push(`/app/universe/${universeId}/scripts/${script.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Scripts</h1>
          <p className="text-slate-400 mt-1">Ideas, outlines, and full scripts for your videos</p>
        </div>
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          New Script
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              typeFilter === f.value
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-slate-800/80 text-slate-500 border-slate-700/60 hover:text-slate-300 hover:border-slate-600"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : scripts.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center space-y-3">
          <ScrollText className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-400">No scripts yet. Create your first script to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((script) => {
            const charIds = parseCharacterIds(script.character_ids_json);
            const charNames = charIds
              .map((id) => charMap.get(id)?.name)
              .filter(Boolean);

            return (
              <Link
                key={script.id}
                href={`/app/universe/${universeId}/scripts/${script.id}`}
                className="bg-slate-900 rounded-xl border border-slate-800 p-5 transition-all hover:border-slate-700 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white truncate">{script.title}</h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn("text-[10px]", TYPE_COLORS[script.script_type] ?? TYPE_COLORS.idea)}>
                    {script.script_type.replace("_", " ")}
                  </Badge>
                  <Badge className={cn("text-[10px]", STATUS_COLORS[script.status] ?? STATUS_COLORS.draft)}>
                    {script.status}
                  </Badge>
                </div>

                {charNames.length > 0 && (
                  <p className="text-xs text-slate-500 truncate">
                    Characters: {charNames.join(", ")}
                  </p>
                )}

                {script.content && (
                  <p className="text-sm text-slate-400 line-clamp-2">{script.content}</p>
                )}

                <p className="text-[10px] text-slate-600">
                  {new Date(script.created_at).toLocaleDateString()}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
