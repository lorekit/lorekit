"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  RefreshCw,
  BookOpen,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
} from "lucide-react";
import {
  getCharacter,
  getSourceItems,
  generateCharacterImage,
  generateCharacterForCharacter,
  getCharacterImages,
  getVibePresets,
  clipUrl,
  updateCharacter,
  createSourceItem,
  updateSourceItem,
  deleteSourceItem,
} from "@/lib/api";
import type { Character, SourceItem, CharacterImage, VibePreset } from "@/lib/api";
import { cn, CIV_COLORS } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const THEME_COLORS: Record<string, string> = {
  mortality: "bg-red-500/20 text-red-400 border-red-500/30",
  wisdom: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  discipline: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  mindset: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  virtue: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  nature: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  strategy: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const EMOTIONAL_FUNCTIONS = ["hook", "truth", "conflict", "loop"] as const;

// --- Inline editable text ---
function InlineEdit({
  value,
  onSave,
  className,
  as: Tag = "span",
  inputClassName,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  className?: string;
  as?: "span" | "p" | "h1";
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      /* keep editing on error */
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span className="relative inline-flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={cn(
            "bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white outline-none focus:border-amber-500 transition-colors",
            inputClassName
          )}
        />
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 absolute -right-5" />}
      </span>
    );
  }

  return (
    <Tag
      className={cn("cursor-pointer hover:bg-slate-800/50 rounded px-1 -mx-1 transition-colors group inline", className)}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value}
      <Pencil className="w-3 h-3 text-slate-600 group-hover:text-slate-400 inline ml-1.5 -mt-0.5" />
    </Tag>
  );
}

// --- Inline editable textarea ---
function InlineTextarea({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      /* keep editing */
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="relative">
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 leading-relaxed outline-none focus:border-amber-500 transition-colors resize-none"
        />
        {saving && (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 absolute top-2 right-2" />
        )}
      </div>
    );
  }

  return (
    <p
      className={cn(
        "cursor-pointer hover:bg-slate-800/50 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors group",
        className
      )}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value}
      <Pencil className="w-3 h-3 text-slate-600 group-hover:text-slate-400 inline ml-1.5 -mt-0.5" />
    </p>
  );
}

// --- Source item edit form (inline) ---
function SourceItemEditForm({
  sourceItem,
  onSave,
  onCancel,
}: {
  sourceItem: { text: string; theme: string; emotional_function: string };
  onSave: (data: { text: string; theme: string; emotional_function: SourceItem["emotional_function"] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(sourceItem.text);
  const [theme, setTheme] = useState(sourceItem.theme);
  const [fn, setFn] = useState<SourceItem["emotional_function"]>(sourceItem.emotional_function as SourceItem["emotional_function"]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave({ text: text.trim(), theme: theme.trim(), emotional_function: fn });
    } catch {
      /* stay open */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-amber-500/40 p-4 space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Source text..."
        rows={3}
        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-500 resize-none"
      />
      <div className="flex gap-2">
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Theme (e.g. wisdom)"
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500"
        />
        <select
          value={fn}
          onChange={(e) => setFn(e.target.value as SourceItem["emotional_function"])}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500"
        >
          {EMOTIONAL_FUNCTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !text.trim()}
          className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded disabled:opacity-50 flex items-center gap-1.5 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}

// --- Source item card ---
function SourceItemCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: SourceItem;
  onUpdate: (id: string, data: Partial<SourceItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (editing) {
    return (
      <SourceItemEditForm
        sourceItem={item}
        onSave={async (data) => {
          await onUpdate(item.id, data);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition-colors group/card relative">
      {/* Action buttons */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-amber-400 transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1 text-xs">
            <button
              onClick={async () => {
                await onDelete(item.id);
              }}
              className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-sm text-slate-200 italic leading-relaxed mb-3 pr-16">
        &ldquo;{item.text}&rdquo;
      </p>
      <div className="flex items-center gap-2">
        <Badge
          className={cn(
            "text-[10px]",
            THEME_COLORS[item.theme] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"
          )}
        >
          {item.theme}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {item.emotional_function}
        </Badge>
      </div>
    </div>
  );
}

// --- Main page ---
export default function StudioCharacterProfilePage({
  params,
}: {
  params: Promise<{ universeId: string; id: string }>;
}) {
  const { universeId, id } = use(params);
  const [character, setCharacter] = useState<Character | null>(null);
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([]);
  const [charImages, setCharImages] = useState<CharacterImage[]>([]);
  const [vibePresets, setVibePresets] = useState<Record<string, VibePreset>>({});
  const [selectedTheme, setSelectedTheme] = useState<string>("dark_masculine");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingTheme, setGeneratingTheme] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  const refreshCharImages = useCallback(async () => {
    try {
      const data = await getCharacterImages(id);
      setCharImages(data.images);
    } catch {}
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getCharacter(id),
      getSourceItems({ character_id: id, limit: 500 }),
      getCharacterImages(id).catch(() => ({ images: [] as CharacterImage[] })),
      getVibePresets().catch(() => ({ presets: {} as Record<string, VibePreset> })),
    ])
      .then(([char, items, charData, vibeData]) => {
        if (cancelled) return;
        setCharacter(char);
        setSourceItems(items);
        setCharImages(charData.images);
        setVibePresets(vibeData.presets);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const themes = Array.from(new Set(sourceItems.map((q) => q.theme))).sort();
  const filteredItems =
    filter === "all" ? sourceItems : sourceItems.filter((q) => q.theme === filter);

  const handleGenerateImage = useCallback(
    async (theme: string, force = false) => {
      if (!character) return;
      setGeneratingImage(true);
      setGeneratingTheme(theme);
      try {
        const data = await generateCharacterForCharacter(character.id, { theme, force });
        setCharacter((prev) =>
          prev ? { ...prev, character_image_url: data.image_url } : prev
        );
        // Refresh the gallery
        await refreshCharImages();
      } catch (err) {
        console.error("Failed to generate character image:", err);
      } finally {
        setGeneratingImage(false);
        setGeneratingTheme(null);
      }
    },
    [character, refreshCharImages]
  );

  const saveCharacterField = useCallback(
    async (field: string, value: string) => {
      if (!character) return;
      const updated = await updateCharacter(character.id, { [field]: value });
      setCharacter((prev) => (prev ? { ...prev, ...updated } : prev));
    },
    [character]
  );

  const handleUpdateItem = useCallback(
    async (itemId: string, data: Partial<SourceItem>) => {
      const updated = await updateSourceItem(itemId, data);
      setSourceItems((prev) => prev.map((q) => (q.id === itemId ? { ...q, ...updated } : q)));
    },
    []
  );

  const handleDeleteItem = useCallback(async (itemId: string) => {
    await deleteSourceItem(itemId);
    setSourceItems((prev) => prev.filter((q) => q.id !== itemId));
  }, []);

  const handleCreateItem = useCallback(
    async (data: { text: string; theme: string; emotional_function: string }) => {
      const created = await createSourceItem({ ...data, character_id: id });
      setSourceItems((prev) => [created, ...prev]);
      setAddingItem(false);
    },
    [id]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Character not found.</p>
        <Link
          href={`/studio/${universeId}/characters`}
          className="text-amber-400 hover:underline mt-2 inline-block"
        >
          &larr; Back to Characters
        </Link>
      </div>
    );
  }

  const groupClass =
    CIV_COLORS[character.group] ??
    "bg-slate-500/20 text-slate-400 border-slate-500/30";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href={`/studio/${universeId}/characters`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Characters
      </Link>

      {/* Hero section */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Character images — per-theme gallery */}
        <div className="shrink-0 space-y-4">
          {/* Theme selector tabs */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(vibePresets)
              .filter(([k]) => k !== "custom")
              .map(([key, preset]) => {
                const hasImage = charImages.some((ci) => ci.theme === key && ci.url);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTheme(key)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border",
                      selectedTheme === key
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : hasImage
                        ? "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500"
                        : "bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600"
                    )}
                  >
                    {preset.name}
                    {hasImage && <span className="ml-1 text-emerald-400">●</span>}
                  </button>
                );
              })}
          </div>

          {/* Active theme image */}
          {(() => {
            const activeImage = charImages.find((ci) => ci.theme === selectedTheme && ci.url);
            const themeName = vibePresets[selectedTheme]?.name || selectedTheme.replace(/_/g, " ");
            const isGeneratingThis = generatingImage && generatingTheme === selectedTheme;

            if (activeImage?.url) {
              return (
                <div className="space-y-2">
                  <img
                    src={activeImage.url}
                    alt={`${character.name} — ${themeName}`}
                    className="w-48 h-64 object-cover rounded-xl border border-slate-700 shadow-lg"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">{themeName}</span>
                    <button
                      onClick={() => handleGenerateImage(selectedTheme, true)}
                      disabled={generatingImage}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors disabled:opacity-40"
                    >
                      {isGeneratingThis ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Regenerate
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="w-48 h-64 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center gap-3">
                <ImageIcon className="w-10 h-10 text-slate-600" />
                <p className="text-[11px] text-slate-500 text-center px-3">
                  No <span className="text-slate-300">{themeName}</span> image
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleGenerateImage(selectedTheme, false)}
                  disabled={generatingImage}
                >
                  {isGeneratingThis ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Generate
                </Button>
              </div>
            );
          })()}

          {/* Thumbnail strip of all themed images */}
          {charImages.filter((ci) => ci.url).length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {charImages
                .filter((ci) => ci.url)
                .map((ci) => (
                  <button
                    key={ci.theme}
                    onClick={() => setSelectedTheme(ci.theme)}
                    className={cn(
                      "shrink-0 rounded-lg border overflow-hidden transition-all",
                      selectedTheme === ci.theme
                        ? "border-amber-500 ring-1 ring-amber-500/30"
                        : "border-slate-700 hover:border-slate-500 opacity-60 hover:opacity-100"
                    )}
                  >
                    <img
                      src={ci.url!}
                      alt={ci.theme_name}
                      className="w-12 h-16 object-cover"
                    />
                    <p className="text-[9px] text-slate-400 text-center py-0.5 bg-slate-900 truncate px-1">
                      {ci.theme_name}
                    </p>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <InlineEdit
                value={character.name}
                onSave={(v) => saveCharacterField("name", v)}
                as="h1"
                className="text-3xl font-bold text-white"
                inputClassName="text-3xl font-bold w-64"
              />
              <Badge className={cn("text-sm", groupClass)}>
                {character.group}
              </Badge>
            </div>
            <InlineEdit
              value={character.era}
              onSave={(v) => saveCharacterField("era", v)}
              className="text-slate-400"
              inputClassName="w-48"
            />
          </div>

          <InlineTextarea
            value={character.character_description}
            onSave={(v) => saveCharacterField("character_description", v)}
            className="text-slate-300 leading-relaxed"
          />

          {/* Stats */}
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-3">
              <p className="text-2xl font-bold text-white">
                {sourceItems.length}
              </p>
              <p className="text-xs text-slate-500">Total Sources</p>
            </div>
            <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-3">
              <p className="text-2xl font-bold text-red-400">
                {sourceItems.filter((q) => q.emotional_function === "hook").length}
              </p>
              <p className="text-xs text-slate-500">Hooks</p>
            </div>
            <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-3">
              <p className="text-2xl font-bold text-amber-400">
                {sourceItems.filter((q) => q.emotional_function === "truth").length}
              </p>
              <p className="text-xs text-slate-500">Truths</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Link href={`/studio/${universeId}/generate?character=${character.id}`}>
              <Button>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Video
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Source items section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl font-semibold text-white">Sources</h2>
          <span className="text-sm text-slate-500">({sourceItems.length})</span>
          <button
            onClick={() => setAddingItem(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Source
          </button>
        </div>

        {/* Theme filters */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
              filter === "all"
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-slate-800/80 text-slate-500 border-slate-700/60 hover:text-slate-300"
            )}
          >
            All ({sourceItems.length})
          </button>
          {themes.map((theme) => {
            const count = sourceItems.filter((q) => q.theme === theme).length;
            const colors =
              THEME_COLORS[theme] ??
              "bg-slate-500/20 text-slate-400 border-slate-500/30";
            return (
              <button
                key={theme}
                onClick={() => setFilter(theme)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                  filter === theme
                    ? colors
                    : "bg-slate-800/80 text-slate-500 border-slate-700/60 hover:text-slate-300"
                )}
              >
                {theme.charAt(0).toUpperCase() + theme.slice(1)} ({count})
              </button>
            );
          })}
        </div>

        {/* New item form */}
        {addingItem && (
          <SourceItemEditForm
            sourceItem={{ text: "", theme: "", emotional_function: "hook" }}
            onSave={handleCreateItem}
            onCancel={() => setAddingItem(false)}
          />
        )}

        {/* Source item grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => (
            <SourceItemCard
              key={item.id}
              item={item}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
