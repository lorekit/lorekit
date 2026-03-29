"use client";

import { use, useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Paintbrush,
  Palette,
  Plus,
  Save,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  type Environment,
  getUniverseEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface ColorGrade {
  temperature: number;
  saturation: number;
  contrast: number;
  vignette: number;
}

const DEFAULT_COLOR_GRADE: ColorGrade = {
  temperature: 6500,
  saturation: 1,
  contrast: 1,
  vignette: 0,
};

interface EnvFormData {
  name: string;
  colorGrade: ColorGrade;
  font: string;
  text_color: string;
  text_shadow: string;
  environment_description: string;
}

function parseColorGrade(json: string | null): ColorGrade {
  if (!json) return { ...DEFAULT_COLOR_GRADE };
  try {
    const parsed = JSON.parse(json);
    return {
      temperature: parsed.temperature ?? DEFAULT_COLOR_GRADE.temperature,
      saturation: parsed.saturation ?? DEFAULT_COLOR_GRADE.saturation,
      contrast: parsed.contrast ?? DEFAULT_COLOR_GRADE.contrast,
      vignette: parsed.vignette ?? DEFAULT_COLOR_GRADE.vignette,
    };
  } catch {
    return { ...DEFAULT_COLOR_GRADE };
  }
}

function envToForm(env: Environment): EnvFormData {
  return {
    name: env.name,
    colorGrade: parseColorGrade(env.color_grade_json),
    font: env.font,
    text_color: env.text_color,
    text_shadow: env.text_shadow,
    environment_description: env.environment_description,
  };
}

const emptyForm = (): EnvFormData => ({
  name: "",
  colorGrade: { ...DEFAULT_COLOR_GRADE },
  font: "",
  text_color: "#ffffff",
  text_shadow: "0 2px 4px rgba(0,0,0,0.8)",
  environment_description: "",
});

export default function EnvironmentsPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = use(params);

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EnvFormData>(emptyForm());
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<EnvFormData>(emptyForm());
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const envs = await getUniverseEnvironments(universeId);
      setEnvironments(envs);
    } catch (err) {
      console.error("Failed to load environments:", err);
    } finally {
      setLoading(false);
    }
  }, [universeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartEdit = (env: Environment) => {
    setEditingId(env.id);
    setEditForm(envToForm(env));
    setCreating(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (envId: string) => {
    setSaving(true);
    try {
      await updateEnvironment(universeId, envId, {
        name: editForm.name,
        color_grade: editForm.colorGrade as unknown as Record<string, number>,
        font: editForm.font,
        text_color: editForm.text_color,
        text_shadow: editForm.text_shadow,
        environment_description: editForm.environment_description,
      });
      await loadData();
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update environment:", err);
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
      await createEnvironment(universeId, {
        name: newForm.name,
        color_grade: newForm.colorGrade as unknown as Record<string, number>,
        font: newForm.font,
        text_color: newForm.text_color,
        text_shadow: newForm.text_shadow,
        environment_description: newForm.environment_description,
      });
      await loadData();
      setCreating(false);
    } catch (err) {
      console.error("Failed to create environment:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (envId: string) => {
    if (!confirm("Delete this environment? This cannot be undone.")) return;
    try {
      await deleteEnvironment(universeId, envId);
      setEnvironments((prev) => prev.filter((e) => e.id !== envId));
      if (editingId === envId) setEditingId(null);
    } catch (err) {
      console.error("Failed to delete environment:", err);
    }
  };

  const renderFormFields = (
    form: EnvFormData,
    setForm: (updater: (prev: EnvFormData) => EnvFormData) => void
  ) => (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-300">Name</label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Environment name"
        />
      </div>

      {/* Color Grade Sliders */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Palette className="h-4 w-4 text-amber-500" />
          Color Grade
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Temperature</label>
              <span className="text-xs font-mono text-amber-400">
                {form.colorGrade.temperature}K
              </span>
            </div>
            <Slider
              min={3000}
              max={9000}
              step={100}
              value={form.colorGrade.temperature}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  colorGrade: { ...f.colorGrade, temperature: v },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Saturation</label>
              <span className="text-xs font-mono text-amber-400">
                {form.colorGrade.saturation.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={form.colorGrade.saturation}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  colorGrade: { ...f.colorGrade, saturation: v },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Contrast</label>
              <span className="text-xs font-mono text-amber-400">
                {form.colorGrade.contrast.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={form.colorGrade.contrast}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  colorGrade: { ...f.colorGrade, contrast: v },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Vignette</label>
              <span className="text-xs font-mono text-amber-400">
                {form.colorGrade.vignette.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={form.colorGrade.vignette}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  colorGrade: { ...f.colorGrade, vignette: v },
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* Font */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Type className="h-4 w-4 text-amber-500" />
          Font
        </label>
        <Input
          value={form.font}
          onChange={(e) => setForm((f) => ({ ...f, font: e.target.value }))}
          placeholder="e.g. Inter, serif, monospace"
        />
      </div>

      {/* Text Color */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-300">Text Color</label>
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 shrink-0 rounded-md border border-slate-700"
            style={{ backgroundColor: form.text_color || "#ffffff" }}
          />
          <Input
            value={form.text_color}
            onChange={(e) =>
              setForm((f) => ({ ...f, text_color: e.target.value }))
            }
            placeholder="#ffffff"
            className="font-mono"
          />
        </div>
      </div>

      {/* Text Shadow */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-300">Text Shadow</label>
        <Input
          value={form.text_shadow}
          onChange={(e) =>
            setForm((f) => ({ ...f, text_shadow: e.target.value }))
          }
          placeholder="0 2px 4px rgba(0,0,0,0.8)"
          className="font-mono"
        />
      </div>

      {/* Environment Description */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-300">
          Description
        </label>
        <textarea
          value={form.environment_description}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              environment_description: e.target.value,
            }))
          }
          placeholder="Describe the visual environment..."
          rows={3}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
        />
      </div>
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
            <Paintbrush className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-white">Environments</h1>
            <Badge variant="secondary">{environments.length}</Badge>
          </div>
          <Button onClick={handleStartCreate} disabled={creating}>
            <Plus className="mr-2 h-4 w-4" />
            New Environment
          </Button>
        </div>

        {/* Create new form */}
        {creating && (
          <div className="rounded-lg border-2 border-amber-500/30 bg-slate-900 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-amber-500">
              Create Environment
            </h3>
            {renderFormFields(newForm, setNewForm)}
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => setCreating(false)}
              >
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

        {/* Environment cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {environments.map((env) => {
            const isEditing = editingId === env.id;
            const colorGrade = parseColorGrade(env.color_grade_json);

            if (isEditing) {
              return (
                <div
                  key={env.id}
                  className="col-span-full rounded-lg border-2 border-amber-500/30 bg-slate-900 p-6 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-amber-500">
                      Edit Environment
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDelete(env.id)}
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
                      onClick={() => handleSaveEdit(env.id)}
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
                key={env.id}
                onClick={() => handleStartEdit(env)}
                className="group cursor-pointer rounded-lg border border-slate-800 bg-slate-900 p-5 space-y-3 transition-all hover:border-amber-500/30 hover:bg-slate-800/50"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleStartEdit(env);
                  }
                }}
              >
                {/* Name and font */}
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-semibold text-white group-hover:text-amber-400 transition-colors">
                    {env.name}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(env.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Font */}
                {env.font && (
                  <div className="flex items-center gap-2">
                    <Type className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs text-slate-400 font-mono">
                      {env.font}
                    </span>
                  </div>
                )}

                {/* Color swatch + text shadow */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-5 w-5 rounded border border-slate-700"
                      style={{
                        backgroundColor: env.text_color || "#ffffff",
                      }}
                    />
                    <span className="text-xs text-slate-500 font-mono">
                      {env.text_color}
                    </span>
                  </div>
                  {env.text_shadow && (
                    <Badge variant="secondary" className="text-[10px]">
                      shadow
                    </Badge>
                  )}
                </div>

                {/* Color grade summary */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {colorGrade.temperature}K
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    sat {colorGrade.saturation.toFixed(1)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    con {colorGrade.contrast.toFixed(1)}
                  </Badge>
                  {colorGrade.vignette > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      vig {colorGrade.vignette.toFixed(1)}
                    </Badge>
                  )}
                </div>

                {/* Description truncated */}
                {env.environment_description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {env.environment_description}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {environments.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-900 p-12 text-center">
            <Paintbrush className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">
              No environments yet.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Create an environment to define visual styles for your scenes.
            </p>
            <Button onClick={handleStartCreate} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create First Environment
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
