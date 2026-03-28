"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getUniverseCharacters, getUniverse } from "@/lib/api";
import type { Character, Universe } from "@/lib/api";
import { cn, CIV_COLORS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function UniverseCharactersPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = use(params);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getUniverseCharacters(universeId),
      getUniverse(universeId).catch(() => null),
    ])
      .then(([chars, uni]) => {
        if (cancelled) return;
        setCharacters(chars);
        setUniverse(uni);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [universeId]);

  return (
    <div className="p-8 space-y-6">
      {/* Back link */}
      <Link
        href={`/studio/${universeId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {universe?.name ?? "Universe"}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Characters
        </h1>
        <p className="text-slate-400 mt-1">
          {universe
            ? `Characters in ${universe.name}`
            : "Browse the characters in this universe"}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-900 rounded-xl border border-slate-800 p-5 animate-pulse"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-5 bg-slate-800 rounded w-32" />
                <div className="h-5 bg-slate-800 rounded w-16" />
              </div>
              <div className="h-3 bg-slate-800 rounded w-24 mb-3" />
              <div className="h-3 bg-slate-800 rounded w-40 mb-2" />
              <div className="space-y-2 mt-4">
                <div className="h-3 bg-slate-800 rounded w-full" />
                <div className="h-3 bg-slate-800 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      ) : characters.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
          <p className="text-slate-400">No characters found in this universe</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((character) => {
            const groupClass =
              CIV_COLORS[character.group] ??
              "bg-slate-500/20 text-slate-400 border-slate-500/30";

            return (
              <Link
                key={character.id}
                href={`/studio/${universeId}/characters/${character.id}`}
                className="bg-slate-900 rounded-xl border border-slate-800 transition-all hover:border-slate-700 flex overflow-hidden"
              >
                {/* Character image */}
                {character.character_image_url ? (
                  <div className="shrink-0 w-28">
                    <img
                      src={character.character_image_url}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-28 bg-slate-800/50 flex items-center justify-center">
                    <span className="text-3xl text-slate-600">🏛️</span>
                  </div>
                )}

                {/* Content */}
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {character.name}
                    </h3>
                    <Badge className={cn("shrink-0", groupClass)}>
                      {character.group}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-500 mb-2">
                    {character.era}
                  </p>

                  <div className="text-sm text-slate-300 mb-2">
                    <span className="font-medium text-white">
                      {character.quote_count}
                    </span>{" "}
                    quotes
                    <span className="text-slate-600 mx-1">&middot;</span>
                    <span className="text-slate-500">
                      {character.hook_count} hooks &middot;{" "}
                      {character.truth_count} truths
                    </span>
                  </div>

                  <p className="text-sm text-slate-400 line-clamp-2">
                    {character.character_description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
