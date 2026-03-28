"use client";

import { use, useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Film,
  GripVertical,
  Layers,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  type SceneTemplate,
  getUniverseTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Beat {
  name: string;
  duration_range: [number, number];
  purpose: string;
}

interface TemplateFormData {
  name: string;
  description: string;
  min_duration: number;
  max_duration: number;
  min_scenes: number;
  max_scenes: number;
  beats: Beat[];
}

function parseBeats(json: string | null): Beat[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((b: Record<string, unknown>) => ({
      name: String(b.name ?? ""),
      duration_range: Array.isArray(b.duration_range)
        ? [Number(b.duration_range[0] ?? 0), Number(b.duration_range[1] ?? 0)]
        : [0, 0],
      purpose: String(b.purpose ?? ""),
    }));
  } catch {
    return [];
  }
}

function templateToForm(t: SceneTemplate): TemplateFormData {
  return {
    name: t.name,
    description: t.description,
    min_duration: t.min_duration,
    max_duration: t.max_duration,
    min_scenes: t.min_scenes,
    max_scenes: t.max_scenes,
    beats: parseBeats(t.beats_json),
  };
}

const emptyForm = (): TemplateFormData => ({
  name: "",
  description: "",
  min_duration: 30,
  max_duration: 90,
  min_scenes: 4,
  max_scenes: 8,
  beats: [],
});

const emptyBeat = (): Beat => ({
  name: "",
  duration_range: [3, 8],
  purpose: "",
});

export default function TemplatesPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = use(params);

  const [templates, setTemplates] = useState<SceneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TemplateFormData>(emptyForm());
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<TemplateFormData>(emptyForm());
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const tmpls = await getUniverseTemplates(universeId);
      setTemplates(tmpls);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  }, [universeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartEdit = (t: SceneTemplate) => {
    setEditingId(t.id);
    setEditForm(templateToForm(t));
    setCreating(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (tmplId: string) => {
    setSaving(true);
    try {
      await updateTemplate(universeId, tmplId, {
        name: editForm.name,
        description: editForm.description,
        beats: editForm.beats,
        min_duration: editForm.min_duration,
        max_duration: editForm.max_duration,
        min_scenes: editForm.min_scenes,
        max_scenes: editForm.max_scenes,
      });
      await loadData();
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update template:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleStartCreate = () => {
    setCreating(true);
    setNewForm(emptyForm());
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!newForm.name.trim()) return;
    setSaving(true);
    try {
      await createTemplate(universeId, {
        name: newForm.name,
        description: newForm.description,
        beats: newForm.beats,
        min_duration: newForm.min_duration,
        max_duration: newForm.max_duration,
        min_scenes: newForm.min_scenes,
        max_scenes: newForm.max_scenes,
      });
      await loadData();
      setCreating(false);
    } catch (err) {
      console.error("Failed to create template:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tmplId: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    try {
      await deleteTemplate(universeId, tmplId);
      setTemplates((prev) => prev.filter((t) => t.id !== tmplId));
      if (editingId === tmplId) setEditingId(null);
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const renderBeatEditor = (
    beats: Beat[],
    setBeats: (beats: Beat[]) => void
  ) => {
    const moveBeat = (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= beats.length) return;
      const updated = [...beats];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      setBeats(updated);
    };

    const updateBeat = (index: number, patch: Partial<Beat>) => {
      const updated = beats.map((b, i) =>
        i === index ? { ...b, ...patch } : b
      );
      setBeats(updated);
    };

    const removeBeat = (index: number) => {
      setBeats(beats.filter((_, i) => i !== index));
    };

    const addBeat = () => {
      setBeats([...beats, emptyBeat()]);
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Layers className="h-4 w-4 text-amber-500" />
            Beat Sequence
          </h4>
          <Button variant="ghost" size="sm" onClick={addBeat}>
            <Plus className="mr-1 h-3 w-3" />
            Add Beat
          </Button>
        </div>

        {beats.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
            No beats yet. Add a beat to define the scene structure.
          </div>
        ) : (
          <div className="space-y-2">
            {beats.map((beat, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md border border-slate-700 bg-slate-950/50 p-3"
              >
                {/* Reorder controls */}
                <div className="flex flex-col gap-0.5 pt-1 shrink-0">
                  <button
                    onClick={() => moveBeat(index, -1)}
                    disabled={index === 0}
                    className="rounded p-0.5 text-slate-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                    aria-label="Move beat up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <GripVertical className="h-3.5 w-3.5 text-slate-600" />
                  <button
                    onClick={() => moveBeat(index, 1)}
                    disabled={index === beats.length - 1}
                    className="rounded p-0.5 text-slate-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                    aria-label="Move beat down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Beat fields */}
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        value={beat.name}
                        onChange={(e) =>
                          updateBeat(index, { name: e.target.value })
                        }
                        placeholder="Beat name"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={beat.duration_range[0]}
                        onChange={(e) =>
                          updateBeat(index, {
                            duration_range: [
                              Number(e.target.value),
                              beat.duration_range[1],
                            ],
                          })
                        }
                        className="h-8 w-16 text-xs text-center"
                        min={0}
                      />
                      <span className="text-xs text-slate-500">-</span>
                      <Input
                        type="number"
                        value={beat.duration_range[1]}
                        onChange={(e) =>
                          updateBeat(index, {
                            duration_range: [
                              beat.duration_range[0],
                              Number(e.target.value),
                            ],
                          })
                        }
                        className="h-8 w-16 text-xs text-center"
                        min={0}
                      />
                      <span className="text-xs text-slate-500">s</span>
                    </div>
                  </div>
                  <Input
                    value={beat.purpose}
                    onChange={(e) =>
                      updateBeat(index, { purpose: e.target.value })
                    }
                    placeholder="Purpose of this beat..."
                    className="h-8 text-xs"
                  />
                </div>

                {/* Delete beat */}
                <button
                  onClick={() => removeBeat(index)}
                  className="shrink-0 rounded p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  aria-label="Remove beat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFormFields = (
    form: TemplateFormData,
    setForm: (updater: (prev: TemplateFormData) => TemplateFormData) => void
  ) => (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-300">Name</label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Template name"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-300">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          placeholder="Describe this template's narrative style..."
          rows={3}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
        />
      </div>

      {/* Duration Range */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Clock className="h-4 w-4 text-amber-500" />
            Duration Range (seconds)
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={form.min_duration}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  min_duration: Number(e.target.value),
                }))
              }
              placeholder="Min"
              min={0}
            />
            <span className="text-slate-500">to</span>
            <Input
              type="number"
              value={form.max_duration}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_duration: Number(e.target.value),
                }))
              }
              placeholder="Max"
              min={0}
            />
          </div>
        </div>

        {/* Scene Count Range */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Film className="h-4 w-4 text-amber-500" />
            Scene Count Range
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={form.min_scenes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  min_scenes: Number(e.target.value),
                }))
              }
              placeholder="Min"
              min={1}
            />
            <span className="text-slate-500">to</span>
            <Input
              type="number"
              value={form.max_scenes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_scenes: Number(e.target.value),
                }))
              }
              placeholder="Max"
              min={1}
            />
          </div>
        </div>
      </div>

      {/* Beat Sequence Editor */}
      {renderBeatEditor(form.beats, (beats) =>
        setForm((f) => ({ ...f, beats }))
      )}
    </div>
  );

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
            <Layers className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-white">Scene Templates</h1>
            <Badge variant="secondary">{templates.length}</Badge>
          </div>
          <Button onClick={handleStartCreate} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>

        {/* Create new form */}
        {creating && (
          <div className="rounded-lg border-2 border-amber-500/30 bg-slate-900 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-amber-500">
              Create Template
            </h3>
            {renderFormFields(newForm, setNewForm)}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving || !newForm.name.trim()}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Create
              </Button>
            </div>
          </div>
        )}

        {/* Template cards */}
        <div className="space-y-4">
          {templates.map((tmpl) => {
            const isEditing = editingId === tmpl.id;
            const beats = parseBeats(tmpl.beats_json);

            if (isEditing) {
              return (
                <div
                  key={tmpl.id}
                  className="rounded-lg border-2 border-amber-500/30 bg-slate-900 p-6 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-amber-500">
                      Edit Template
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDelete(tmpl.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {renderFormFields(editForm, setEditForm)}
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="ghost" onClick={handleCancelEdit}>
                      <X className="mr-1 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleSaveEdit(tmpl.id)}
                      disabled={saving || !editForm.name.trim()}
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={tmpl.id}
                onClick={() => handleStartEdit(tmpl)}
                className="group cursor-pointer rounded-lg border border-slate-800 bg-slate-900 p-5 transition-all hover:border-amber-500/30 hover:bg-slate-800/50"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleStartEdit(tmpl);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Name + description */}
                    <div>
                      <h3 className="text-base font-semibold text-white group-hover:text-amber-400 transition-colors">
                        {tmpl.name}
                      </h3>
                      {tmpl.description && (
                        <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                          {tmpl.description}
                        </p>
                      )}
                    </div>

                    {/* Stats badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {tmpl.min_duration}s - {tmpl.max_duration}s
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <Film className="h-3 w-3" />
                        {tmpl.min_scenes} - {tmpl.max_scenes} scenes
                      </Badge>
                      <Badge className="gap-1">
                        <Layers className="h-3 w-3" />
                        {beats.length} beats
                      </Badge>
                    </div>

                    {/* Beats list */}
                    {beats.length > 0 && (
                      <ol className="space-y-1 pl-1">
                        {beats.map((beat, i) => (
                          <li
                            key={i}
                            className="flex items-baseline gap-2 text-xs"
                          >
                            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-amber-500">
                              {i + 1}
                            </span>
                            <span className="font-medium text-slate-300">
                              {beat.name}
                            </span>
                            {beat.purpose && (
                              <span className="text-slate-500 truncate">
                                - {beat.purpose}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(tmpl.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {templates.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-900 p-12 text-center">
            <Layers className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">
              No scene templates yet.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Create a template to define the narrative structure for your
              scenes.
            </p>
            <Button onClick={handleStartCreate} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create First Template
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
