"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getCharacters } from "@/lib/api";
import type { Character } from "@/lib/api";
import { cn, CIV_COLORS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    getCharacters()
      .then(setCharacters)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Characters
        </h1>
        <p className="text-slate-400 mt-1">
          Browse the characters across groups
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
          <p className="text-slate-400">No characters found</p>
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
                href={`/characters/${character.id}`}
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
