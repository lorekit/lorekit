"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
  Pencil,
  Save,
  Trash2,
  X,
  FileText,
} from "lucide-react";
import {
  type Character,
  type SourceItem,
  getUniverseCharacters,
  getSourceItems,
  createSourceItem,
  updateSourceItem,
  deleteSourceItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMOTIONAL_FUNCTIONS = ["all", "hook", "truth", "conflict", "loop"] as const;
type EmotionalFilter = (typeof EMOTIONAL_FUNCTIONS)[number];

const FUNCTION_COLORS: Record<string, string> = {
  hook: "bg-red-500/20 text-red-400 border-red-500/30",
  truth: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  conflict: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  loop: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

interface NewItemForm {
  character_id: string;
  text: string;
  theme: string;
  emotional_function: string;
}

const emptyForm = (characterId: string): NewItemForm => ({
  character_id: characterId,
  text: "",
  theme: "",
  emotional_function: "hook",
});

export default function SourcesPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = use(params);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [sourcesByCharacter, setSourcesByCharacter] = useState<
    Record<string, SourceItem[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [expandedCharacters, setExpandedCharacters] = useState<Set<string>>(
    new Set()
  );
  const [emotionalFilter, setEmotionalFilter] = useState<EmotionalFilter>("all");
  const [themeFilter, setThemeFilter] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SourceItem>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<NewItemForm>(emptyForm(""));
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const chars = await getUniverseCharacters(universeId);
      setCharacters(chars);

      const grouped: Record<string, SourceItem[]> = {};
      await Promise.all(
        chars.map(async (c) => {
          const items = await getSourceItems({ character_id: c.id });
          grouped[c.id] = items;
        })
      );
      setSourcesByCharacter(grouped);
    } catch (err) {
      console.error("Failed to load sources:", err);
    } finally {
      setLoading(false);
    }
  }, [universeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allThemes = useMemo(() => {
    const themes = new Set<string>();
    Object.values(sourcesByCharacter)
      .flat()
      .forEach((item) => {
        if (item.theme) themes.add(item.theme);
      });
    return Array.from(themes).sort();
  }, [sourcesByCharacter]);

  const filteredSources = useMemo(() => {
    const result: Record<string, SourceItem[]> = {};
    for (const [charId, items] of Object.entries(sourcesByCharacter)) {
      result[charId] = items.filter((item) => {
        if (emotionalFilter !== "all" && item.emotional_function !== emotionalFilter)
          return false;
        if (themeFilter && item.theme !== themeFilter) return false;
        return true;
      });
    }
    return result;
  }, [sourcesByCharacter, emotionalFilter, themeFilter]);

  const toggleCharacter = (id: string) => {
    setExpandedCharacters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartEdit = (item: SourceItem) => {
    setEditingItem(item.id);
    setEditForm({
      text: item.text,
      theme: item.theme,
      emotional_function: item.emotional_function,
    });
  };

  const handleSaveEdit = async (id: string, characterId: string) => {
    setSaving(true);
    try {
      await updateSourceItem(id, editForm);
      const items = await getSourceItems({ character_id: characterId });
      setSourcesByCharacter((prev) => ({ ...prev, [characterId]: items }));
      setEditingItem(null);
    } catch (err) {
      console.error("Failed to update source item:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, characterId: string) => {
    if (!confirm("Delete this source item?")) return;
    try {
      await deleteSourceItem(id);
      setSourcesByCharacter((prev) => ({
        ...prev,
        [characterId]: prev[characterId].filter((i) => i.id !== id),
      }));
    } catch (err) {
      console.error("Failed to delete source item:", err);
    }
  };

  const handleStartAdd = (characterId: string) => {
    setAddingFor(characterId);
    setNewForm(emptyForm(characterId));
    if (!expandedCharacters.has(characterId)) {
      toggleCharacter(characterId);
    }
  };

  const handleCreate = async () => {
    if (!newForm.text.trim() || !newForm.theme.trim()) return;
    setSaving(true);
    try {
      await createSourceItem(newForm);
      const items = await getSourceItems({ character_id: newForm.character_id });
      setSourcesByCharacter((prev) => ({
        ...prev,
        [newForm.character_id]: items,
      }));
      setAddingFor(null);
    } catch (err) {
      console.error("Failed to create source item:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-white">Source Materials</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-400">Filter:</span>

          <div className="flex gap-1">
            {EMOTIONAL_FUNCTIONS.map((fn) => (
              <button
                key={fn}
                onClick={() => setEmotionalFilter(fn)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  emotionalFilter === fn
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                )}
              >
                {fn}
              </button>
            ))}
          </div>

          <select
            value={themeFilter}
            onChange={(e) => setThemeFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-700 bg-slate-800 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All themes</option>
            {allThemes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Character sections */}
        {characters.map((character) => {
          const items = filteredSources[character.id] ?? [];
          const totalItems = sourcesByCharacter[character.id]?.length ?? 0;
          const isExpanded = expandedCharacters.has(character.id);

          return (
            <div
              key={character.id}
              className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden"
            >
              {/* Character header */}
              <button
                onClick={() => toggleCharacter(character.id)}
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-amber-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                  )}
                  <h2 className="text-lg font-semibold text-white">
                    {character.name}
                  </h2>
                  <Badge variant="secondary">{items.length}/{totalItems}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartAdd(character.id);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-slate-800">
                  {/* New item form */}
                  {addingFor === character.id && (
                    <div className="border-b border-slate-800 bg-slate-950/50 p-4 space-y-3">
                      <h3 className="text-sm font-medium text-amber-500">
                        New Source Item
                      </h3>
                      <textarea
                        placeholder="Source text..."
                        value={newForm.text}
                        onChange={(e) =>
                          setNewForm((f) => ({ ...f, text: e.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                      />
                      <div className="flex gap-3">
                        <Input
                          placeholder="Theme"
                          value={newForm.theme}
                          onChange={(e) =>
                            setNewForm((f) => ({ ...f, theme: e.target.value }))
                          }
                          className="flex-1"
                        />
                        <select
                          value={newForm.emotional_function}
                          onChange={(e) =>
                            setNewForm((f) => ({
                              ...f,
                              emotional_function: e.target.value,
                            }))
                          }
                          className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          {EMOTIONAL_FUNCTIONS.filter((f) => f !== "all").map(
                            (fn) => (
                              <option key={fn} value={fn}>
                                {fn}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddingFor(null)}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleCreate}
                          disabled={saving || !newForm.text.trim() || !newForm.theme.trim()}
                        >
                          {saving ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="mr-1 h-3 w-3" />
                          )}
                          Create
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Source items list */}
                  {items.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No source items match the current filters.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 transition-colors hover:bg-slate-800/30"
                        >
                          {editingItem === item.id ? (
                            /* Edit mode */
                            <div className="space-y-3">
                              <textarea
                                value={editForm.text ?? ""}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    text: e.target.value,
                                  }))
                                }
                                rows={3}
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
                              />
                              <div className="flex gap-3">
                                <Input
                                  placeholder="Theme"
                                  value={editForm.theme ?? ""}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      theme: e.target.value,
                                    }))
                                  }
                                  className="flex-1"
                                />
                                <select
                                  value={editForm.emotional_function ?? "hook"}
                                  onChange={(e) =>
                                    setEditForm((f) => ({
                                      ...f,
                                      emotional_function: e.target.value as SourceItem["emotional_function"],
                                    }))
                                  }
                                  className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                  {EMOTIONAL_FUNCTIONS.filter((f) => f !== "all").map(
                                    (fn) => (
                                      <option key={fn} value={fn}>
                                        {fn}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingItem(null)}
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleSaveEdit(item.id, item.character_id)
                                  }
                                  disabled={saving}
                                >
                                  {saving ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Save className="mr-1 h-3 w-3" />
                                  )}
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* Display mode */
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <p className="text-sm italic text-slate-300 leading-relaxed">
                                  &ldquo;{item.text}&rdquo;
                                </p>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={cn(
                                      FUNCTION_COLORS[item.emotional_function]
                                    )}
                                  >
                                    {item.emotional_function}
                                  </Badge>
                                  <Badge variant="secondary">{item.theme}</Badge>
                                  {item.word_count > 0 && (
                                    <span className="text-xs text-slate-500">
                                      {item.word_count} words
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleStartEdit(item)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={() =>
                                    handleDelete(item.id, item.character_id)
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {characters.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-900 p-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">
              No characters in this universe yet.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add characters to start managing source materials.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
