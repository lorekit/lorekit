"use client";

import { useCallback, useEffect, useState } from "react";
import { Key, Bot, Save, Shield, Palette, LayoutTemplate, Plus, Copy, Pencil, Trash2, X, Lock } from "lucide-react";
import {
  getSettings, updateSettings, getVibePresets, getArcTemplates,
  listVideoStyles, createVideoStyle, updateVideoStyle, deleteVideoStyle, duplicateVideoStyle,
  type Settings, type VibePreset, type ArcTemplate, type VideoStyle,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const OPENAI_MODELS = [
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { value: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
];

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    openai_api_key: "",
    anthropic_api_key: "",
    fal_key: "",
    llm_provider: "openai",
    llm_model: "gpt-5.4",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vibePresets, setVibePresets] = useState<Record<string, VibePreset>>({});
  const [arcTemplates, setArcTemplates] = useState<Record<string, ArcTemplate>>({});
  const [videoStyles, setVideoStyles] = useState<VideoStyle[]>([]);
  const [editingStyle, setEditingStyle] = useState<VideoStyle | null>(null);
  const [newStyle, setNewStyle] = useState(false);

  // If API keys are not in the response, we're in cloud mode
  const isCloudMode = settings.openai_api_key === undefined;

  const refreshStyles = useCallback(async () => {
    try {
      const data = await listVideoStyles();
      setVideoStyles(data.styles);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    Promise.all([getSettings(), getVibePresets(), getArcTemplates()])
      .then(([settingsData, vibeData, arcData]) => {
        setSettings(settingsData);
        setVibePresets(vibeData.presets);
        setVideoStyles(vibeData.styles || []);
        setArcTemplates(arcData.templates);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveKeys = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings({
        openai_api_key: settings.openai_api_key,
        anthropic_api_key: settings.anthropic_api_key,
        fal_key: settings.fal_key,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = async (provider: "openai" | "anthropic") => {
    const defaultModel = provider === "openai" ? "gpt-5.4" : "claude-sonnet-4-20250514";
    const next = { ...settings, llm_provider: provider, llm_model: defaultModel };
    setSettings(next);
    try {
      await updateSettings({ llm_provider: provider, llm_model: defaultModel });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update provider");
    }
  };

  const handleModelChange = async (model: string) => {
    setSettings((prev) => ({ ...prev, llm_model: model }));
    try {
      await updateSettings({ llm_model: model });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update model");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">
          {isCloudMode
            ? "Configure your LLM provider and view available styles"
            : "Configure API keys, LLM provider, and integrations"}
        </p>
      </div>

      {/* Billing link (cloud mode) */}
      {isCloudMode && (
        <a
          href="/app/settings/billing"
          className="mb-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 hover:border-amber-500/30 transition-colors group"
        >
          <div>
            <h2 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">Billing & Credits</h2>
            <p className="text-xs text-slate-400">Manage subscription, view usage, buy credits</p>
          </div>
          <span className="text-slate-600 group-hover:text-amber-400 transition-colors">&rarr;</span>
        </a>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 mb-6">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* API Keys — only shown in self-hosted mode */}
        {!isCloudMode && (
          <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-lg bg-slate-800 p-2">
                <Key className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">API Keys</h2>
                <p className="text-sm text-slate-400">Credentials for external services</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={settings.openai_api_key ?? ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, openai_api_key: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                <Input
                  id="anthropic-key"
                  type="password"
                  placeholder="sk-ant-..."
                  value={settings.anthropic_api_key ?? ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, anthropic_api_key: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fal-key">fal.ai API Key</Label>
                <Input
                  id="fal-key"
                  type="password"
                  placeholder="fal-..."
                  value={settings.fal_key ?? ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, fal_key: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSaveKeys} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Keys"}
                </Button>
                {saved && (
                  <span className="text-sm text-emerald-400 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    Keys saved securely
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* LLM Provider */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-slate-800 p-2">
              <Bot className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">LLM Provider</h2>
              <p className="text-sm text-slate-400">Choose your language model for story generation</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => handleProviderChange("openai")}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-all",
                settings.llm_provider === "openai"
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
              )}
            >
              <p className="font-semibold text-white">OpenAI</p>
              <p className="text-xs text-slate-400 mt-1">GPT-5.4, Mini, and Nano</p>
            </button>

            <button
              onClick={() => handleProviderChange("anthropic")}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-all",
                settings.llm_provider === "anthropic"
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
              )}
            >
              <p className="font-semibold text-white">Anthropic</p>
              <p className="text-xs text-slate-400 mt-1">Claude Sonnet 4 and Haiku 4.5</p>
            </button>
          </div>

          <Select
            label="Model"
            value={settings.llm_model}
            onChange={handleModelChange}
            options={
              settings.llm_provider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS
            }
          />
        </section>

        {/* Video Styles */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-800 p-2">
                <Palette className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Video Styles</h2>
                <p className="text-sm text-slate-400">Visual styles for video generation. Built-in styles can be duplicated.</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setNewStyle(true);
                setEditingStyle({ id: "", name: "", description: "", prompt: "", character_prompt: "", image_model: "kontext", is_builtin: 0, organization_id: "local", created_at: "" });
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Style
            </Button>
          </div>

          {/* Style Editor (inline) */}
          {editingStyle && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-400">{newStyle ? "New Style" : `Editing: ${editingStyle.name}`}</p>
                <button onClick={() => { setEditingStyle(null); setNewStyle(false); }} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editingStyle.name} onChange={(e) => setEditingStyle({ ...editingStyle, name: e.target.value })} placeholder="Style name" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={editingStyle.description} onChange={(e) => setEditingStyle({ ...editingStyle, description: e.target.value })} placeholder="Short description" />
              </div>
              <div className="space-y-2">
                <Label>Style Prompt</Label>
                <Textarea value={editingStyle.prompt} onChange={(e) => setEditingStyle({ ...editingStyle, prompt: e.target.value })} rows={4} placeholder="Image generation style instructions..." />
              </div>
              <div className="space-y-2">
                <Label>Character Prompt (optional)</Label>
                <Textarea value={editingStyle.character_prompt} onChange={(e) => setEditingStyle({ ...editingStyle, character_prompt: e.target.value })} rows={2} placeholder="Extra prompt when character is present..." />
              </div>
              <div className="space-y-2">
                <Label>Image Generation Model</Label>
                <select
                  value={editingStyle.image_model}
                  onChange={(e) => setEditingStyle({ ...editingStyle, image_model: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="kontext">Kontext Max Multi — Best for stylized, fantasy, cartoon characters. Preserves character identity.</option>
                  <option value="nano_banana_2">Nano Banana 2 — Best for photorealistic scenes. May alter stylized characters toward realism.</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      if (newStyle) {
                        await createVideoStyle({ name: editingStyle.name, description: editingStyle.description, prompt: editingStyle.prompt, character_prompt: editingStyle.character_prompt, image_model: editingStyle.image_model });
                      } else {
                        await updateVideoStyle(editingStyle.id, { name: editingStyle.name, description: editingStyle.description, prompt: editingStyle.prompt, character_prompt: editingStyle.character_prompt, image_model: editingStyle.image_model });
                      }
                      setEditingStyle(null);
                      setNewStyle(false);
                      await refreshStyles();
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : "Failed to save style");
                    }
                  }}
                  disabled={!editingStyle.name || !editingStyle.prompt}
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> {newStyle ? "Create" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingStyle(null); setNewStyle(false); }}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {videoStyles.map((style) => (
              <div
                key={style.id}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-2 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white text-sm">{style.name}</p>
                    {style.is_builtin ? (
                      <Lock className="w-3 h-3 text-slate-600" />
                    ) : null}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={async () => {
                        try {
                          await duplicateVideoStyle(style.id);
                          await refreshStyles();
                        } catch (err: unknown) {
                          setError(err instanceof Error ? err.message : "Failed to duplicate");
                        }
                      }}
                      className="p-1 text-slate-500 hover:text-amber-400"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {!style.is_builtin && (
                      <>
                        <button
                          onClick={() => { setEditingStyle(style); setNewStyle(false); }}
                          className="p-1 text-slate-500 hover:text-amber-400"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete "${style.name}"?`)) return;
                            try {
                              await deleteVideoStyle(style.id);
                              await refreshStyles();
                            } catch (err: unknown) {
                              setError(err instanceof Error ? err.message : "Failed to delete");
                            }
                          }}
                          className="p-1 text-slate-500 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400">{style.description}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Default style is set per-universe. Projects can override the style.
          </p>
        </section>

        {/* Story Templates — read-only reference */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-slate-800 p-2">
              <LayoutTemplate className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Story Templates</h2>
              <p className="text-sm text-slate-400">Narrative structures for generated videos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {Object.entries(arcTemplates).map(([key, tmpl]) => (
              <div
                key={key}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-2"
              >
                <p className="font-medium text-white text-sm">{tmpl.name}</p>
                <p className="text-xs text-slate-400">{tmpl.description}</p>
                <div className="flex gap-3 text-[11px] text-slate-500">
                  <span>{tmpl.min_duration}–{tmpl.max_duration}s</span>
                  <span>{tmpl.min_scenes}–{tmpl.max_scenes} scenes</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Story templates are selected when generating new projects.
          </p>
        </section>
      </div>
    </div>
  );
}
