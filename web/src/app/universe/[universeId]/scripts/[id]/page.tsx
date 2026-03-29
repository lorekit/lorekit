"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Check,
} from "lucide-react";
import {
  getScript,
  updateScript,
  deleteScript,
  getUniverseCharacters,
} from "@/lib/api";
import type { Script, Character } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

const SCRIPT_TYPES = ["idea", "outline", "full_script"] as const;
const STATUSES = ["draft", "review", "ready", "archived"] as const;

function parseCharacterIds(json: string | null): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export default function ScriptDetailPage({
  params,
}: {
  params: Promise<{ universeId: string; id: string }>;
}) {
  const { universeId, id: scriptId } = use(params);
  const router = useRouter();

  const [script, setScript] = useState<Script | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Local edit state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getScript(universeId, scriptId),
      getUniverseCharacters(universeId),
    ])
      .then(([s, c]) => {
        if (cancelled) return;
        setScript(s);
        setCharacters(c);
        setTitle(s.title);
        setContent(s.content);
        setSelectedCharIds(parseCharacterIds(s.character_ids_json));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [universeId, scriptId]);

  const save = useCallback(async (updates: Parameters<typeof updateScript>[2]) => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateScript(universeId, scriptId, updates);
      setScript(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [universeId, scriptId]);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteScript(universeId, scriptId);
      router.push(`/universe/${universeId}/scripts`);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function toggleCharacter(charId: string) {
    const next = selectedCharIds.includes(charId)
      ? selectedCharIds.filter((id) => id !== charId)
      : [...selectedCharIds, charId];
    setSelectedCharIds(next);
    save({ character_ids: next });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!script) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400">Script not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`/universe/${universeId}/scripts`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Scripts
      </Link>

      {/* Title (editable) */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title !== script.title) save({ title }); }}
        className="w-full text-3xl font-bold text-white bg-transparent border-none outline-none placeholder-slate-600 focus:ring-0"
        placeholder="Script title..."
      />

      {/* Badges + selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Type selector */}
        <div className="flex gap-1">
          {SCRIPT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => save({ script_type: t })}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                script.script_type === t
                  ? TYPE_COLORS[t]
                  : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:border-slate-600"
              )}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>

        <span className="text-slate-700">·</span>

        {/* Status selector */}
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => save({ status: s })}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                script.status === s
                  ? STATUS_COLORS[s]
                  : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:border-slate-600"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Save indicator */}
        {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
        {saved && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
      </div>

      {/* Character selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-300">Characters</p>
        <div className="flex flex-wrap gap-2">
          {characters.map((c) => {
            const isSelected = selectedCharIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCharacter(c.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  isSelected
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-slate-800/50 text-slate-500 border-slate-700/50 hover:border-slate-600 hover:text-slate-300"
                )}
              >
                {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                {c.name}
              </button>
            );
          })}
          {characters.length === 0 && (
            <p className="text-xs text-slate-600">No characters in this universe yet</p>
          )}
        </div>
      </div>

      {/* Content editor */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-300">Content</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => { if (content !== script.content) save({ content }); }}
          placeholder="Write your script content here..."
          className="w-full min-h-[400px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500/30 resize-y"
        />
      </div>

      {/* Delete */}
      <div className="pt-4 border-t border-slate-800 flex justify-end">
        <Button
          variant="ghost"
          onClick={handleDelete}
          disabled={deleting}
          className={cn(
            "text-sm",
            confirmDelete ? "text-red-400 hover:text-red-300" : "text-slate-500 hover:text-red-400"
          )}
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 mr-2" />
          )}
          {confirmDelete ? "Click again to confirm delete" : "Delete Script"}
        </Button>
      </div>
    </div>
  );
}
