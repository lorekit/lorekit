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
  getPhilosopher,
  getQuotes,
  generateCharacterImage,
  clipUrl,
  updatePhilosopher,
  createQuote,
  updateQuote,
  deleteQuote,
} from "@/lib/api";
import type { Philosopher, Quote } from "@/lib/api";
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

// --- Quote edit form (inline) ---
function QuoteEditForm({
  quote,
  onSave,
  onCancel,
}: {
  quote: { text: string; theme: string; emotional_function: string };
  onSave: (data: { text: string; theme: string; emotional_function: Quote["emotional_function"] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(quote.text);
  const [theme, setTheme] = useState(quote.theme);
  const [fn, setFn] = useState<Quote["emotional_function"]>(quote.emotional_function as Quote["emotional_function"]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave({ text: text.trim(), theme: theme.trim(), emotional_function: fn });
      // onSave handles closing
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
        placeholder="Quote text..."
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
          onChange={(e) => setFn(e.target.value as Quote["emotional_function"])}
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

// --- Quote card ---
function QuoteCard({
  q,
  onUpdate,
  onDelete,
}: {
  q: Quote;
  onUpdate: (id: string, data: Partial<Quote>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (editing) {
    return (
      <QuoteEditForm
        quote={q}
        onSave={async (data) => {
          await onUpdate(q.id, data);
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
          title="Edit quote"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1 text-xs">
            <button
              onClick={async () => {
                await onDelete(q.id);
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
            title="Delete quote"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-sm text-slate-200 italic leading-relaxed mb-3 pr-16">
        &ldquo;{q.text}&rdquo;
      </p>
      <div className="flex items-center gap-2">
        <Badge
          className={cn(
            "text-[10px]",
            THEME_COLORS[q.theme] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"
          )}
        >
          {q.theme}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {q.emotional_function}
        </Badge>
      </div>
    </div>
  );
}

// --- Main page ---
export default function PhilosopherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [philosopher, setPhilosopher] = useState<Philosopher | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [addingQuote, setAddingQuote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getPhilosopher(id), getQuotes({ philosopher_id: id, limit: 500 })])
      .then(([phil, q]) => {
        if (cancelled) return;
        setPhilosopher(phil);
        setQuotes(q);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const themes = Array.from(new Set(quotes.map((q) => q.theme))).sort();
  const filteredQuotes =
    filter === "all" ? quotes : quotes.filter((q) => q.theme === filter);

  const handleGenerateImage = useCallback(
    async (force = false) => {
      if (!philosopher) return;
      setGeneratingImage(true);
      try {
        const resp = await fetch(
          "http://localhost:8000/api/character/generate-for-philosopher",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ philosopher_id: philosopher.id, force }),
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          setPhilosopher((prev) =>
            prev ? { ...prev, character_image_url: data.image_url } : prev
          );
        }
      } catch (err) {
        console.error("Failed to generate character image:", err);
      } finally {
        setGeneratingImage(false);
      }
    },
    [philosopher]
  );

  const savePhilosopherField = useCallback(
    async (field: string, value: string) => {
      if (!philosopher) return;
      const updated = await updatePhilosopher(philosopher.id, { [field]: value });
      setPhilosopher((prev) => (prev ? { ...prev, ...updated } : prev));
    },
    [philosopher]
  );

  const handleUpdateQuote = useCallback(
    async (quoteId: string, data: Partial<Quote>) => {
      const updated = await updateQuote(quoteId, data);
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, ...updated } : q)));
    },
    []
  );

  const handleDeleteQuote = useCallback(async (quoteId: string) => {
    await deleteQuote(quoteId);
    setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
  }, []);

  const handleCreateQuote = useCallback(
    async (data: { text: string; theme: string; emotional_function: string }) => {
      const created = await createQuote({ ...data, philosopher_id: id });
      setQuotes((prev) => [created, ...prev]);
      setAddingQuote(false);
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

  if (!philosopher) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Philosopher not found.</p>
        <Link
          href="/philosophers"
          className="text-amber-400 hover:underline mt-2 inline-block"
        >
          ← Back to Philosophers
        </Link>
      </div>
    );
  }

  const civClass =
    CIV_COLORS[philosopher.civilization] ??
    "bg-slate-500/20 text-slate-400 border-slate-500/30";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href="/philosophers"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Philosophers
      </Link>

      {/* Hero section */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Character images */}
        <div className="shrink-0">
          {philosopher.character_image_url ? (
            <div className="space-y-3">
              <img
                src={philosopher.character_image_url!}
                alt={philosopher.name}
                className="w-48 h-64 object-cover rounded-xl border border-slate-700 shadow-lg"
              />
              <button
                onClick={() => handleGenerateImage(true)}
                disabled={generatingImage}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                title="Regenerate character images"
              >
                {generatingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {generatingImage
                  ? "Generating 3 angles..."
                  : "Regenerate"}
              </button>
            </div>
          ) : (
            <div className="w-48 h-64 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center gap-3">
              <ImageIcon className="w-10 h-10 text-slate-600" />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleGenerateImage(false)}
                disabled={generatingImage}
              >
                {generatingImage ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Generate
              </Button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <InlineEdit
                value={philosopher.name}
                onSave={(v) => savePhilosopherField("name", v)}
                as="h1"
                className="text-3xl font-bold text-white"
                inputClassName="text-3xl font-bold w-64"
              />
              <Badge className={cn("text-sm", civClass)}>
                {philosopher.civilization}
              </Badge>
            </div>
            <InlineEdit
              value={philosopher.era}
              onSave={(v) => savePhilosopherField("era", v)}
              className="text-slate-400"
              inputClassName="w-48"
            />
          </div>

          <InlineTextarea
            value={philosopher.character_description}
            onSave={(v) => savePhilosopherField("character_description", v)}
            className="text-slate-300 leading-relaxed"
          />

          {/* Stats */}
          <div className="flex flex-wrap gap-4 pt-2">
            <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-3">
              <p className="text-2xl font-bold text-white">
                {quotes.length}
              </p>
              <p className="text-xs text-slate-500">Total Quotes</p>
            </div>
            <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-3">
              <p className="text-2xl font-bold text-red-400">
                {quotes.filter((q) => q.emotional_function === "hook").length}
              </p>
              <p className="text-xs text-slate-500">Hooks</p>
            </div>
            <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-3">
              <p className="text-2xl font-bold text-amber-400">
                {quotes.filter((q) => q.emotional_function === "truth").length}
              </p>
              <p className="text-xs text-slate-500">Truths</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Link href={`/generate?philosopher=${philosopher.id}`}>
              <Button>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Video
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quotes section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl font-semibold text-white">Quotes</h2>
          <span className="text-sm text-slate-500">({quotes.length})</span>
          <button
            onClick={() => setAddingQuote(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Quote
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
            All ({quotes.length})
          </button>
          {themes.map((theme) => {
            const count = quotes.filter((q) => q.theme === theme).length;
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

        {/* New quote form */}
        {addingQuote && (
          <QuoteEditForm
            quote={{ text: "", theme: "", emotional_function: "hook" }}
            onSave={handleCreateQuote}
            onCancel={() => setAddingQuote(false)}
          />
        )}

        {/* Quote grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredQuotes.map((q) => (
            <QuoteCard
              key={q.id}
              q={q}
              onUpdate={handleUpdateQuote}
              onDelete={handleDeleteQuote}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
