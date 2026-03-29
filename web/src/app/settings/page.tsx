"use client";

import { useEffect, useState } from "react";
import { Key, Bot, Video, Save, Shield, Palette, LayoutTemplate } from "lucide-react";
import { getSettings, updateSettings, getVibePresets, getArcTemplates, type Settings, type VibePreset, type ArcTemplate } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    openai_api_key: "",
    anthropic_api_key: "",
    fal_api_key: "",
    llm_provider: "openai",
    llm_model: "gpt-4o",
    youtube_connected: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vibePresets, setVibePresets] = useState<Record<string, VibePreset>>({});
  const [arcTemplates, setArcTemplates] = useState<Record<string, ArcTemplate>>({});

  useEffect(() => {
    Promise.all([getSettings(), getVibePresets(), getArcTemplates()])
      .then(([settingsData, vibeData, arcData]) => {
        setSettings(settingsData);
        setVibePresets(vibeData.presets);
        setArcTemplates(arcData.templates);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveKeys = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateSettings({
        openai_api_key: settings.openai_api_key,
        anthropic_api_key: settings.anthropic_api_key,
        fal_api_key: settings.fal_api_key,
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = async (provider: "openai" | "anthropic") => {
    const defaultModel = provider === "openai" ? "gpt-4o" : "claude-sonnet-4-20250514";
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

  const handleConnectYouTube = () => {
    window.open("http://localhost:8000/api/youtube/auth", "_blank");
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Configure API keys, LLM provider, and integrations</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 mb-6">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* API Keys */}
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
                value={settings.openai_api_key}
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
                value={settings.anthropic_api_key}
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
                value={settings.fal_api_key}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, fal_api_key: e.target.value }))
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

        {/* LLM Provider */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-slate-800 p-2">
              <Bot className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">LLM Provider</h2>
              <p className="text-sm text-slate-400">Choose your language model provider</p>
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
              <p className="text-xs text-slate-400 mt-1">GPT-4o and GPT-4o Mini</p>
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
              <p className="text-xs text-slate-400 mt-1">Claude Sonnet and Haiku</p>
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
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-slate-800 p-2">
              <Palette className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Video Styles</h2>
              <p className="text-sm text-slate-400">Available visual styles for video generation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {Object.entries(vibePresets)
              .filter(([key]) => key !== "custom")
              .map(([key, preset]) => (
                <div
                  key={key}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-2"
                >
                  <p className="font-medium text-white text-sm">{preset.name}</p>
                  <p className="text-xs text-slate-400">{preset.description}</p>
                  {preset.prompt && (
                    <p className="text-[11px] text-slate-500 italic line-clamp-2">
                      {preset.prompt}
                    </p>
                  )}
                </div>
              ))}
          </div>
          <p className="text-xs text-slate-500">
            Video styles are selected per-universe from the universe dashboard.
          </p>
        </section>

        {/* Story Templates */}
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

        {/* YouTube */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-slate-800 p-2">
              <Video className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">YouTube</h2>
              <p className="text-sm text-slate-400">Publish videos directly to YouTube</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {settings.youtube_connected ? (
              <>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Connected
                </Badge>
                <span className="text-sm text-slate-400">
                  Your YouTube account is linked and ready for publishing.
                </span>
              </>
            ) : (
              <>
                <Button
                  onClick={handleConnectYouTube}
                  className="bg-red-500 text-white hover:bg-red-400 active:bg-red-600"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Connect YouTube
                </Button>
                <span className="text-sm text-slate-400">Not connected</span>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
