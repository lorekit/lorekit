"use client";

import { useEffect, useState } from "react";
import { Key, Bot, Video, Save, Shield, Palette } from "lucide-react";
import { getSettings, updateSettings, getVibePresets, type Settings, type VibePreset } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    video_vibe: "",
    video_vibe_preset: "mobile_game",
  });
  const [presets, setPresets] = useState<Record<string, VibePreset>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSettings(), getVibePresets()])
      .then(([settingsData, presetsData]) => {
        setSettings(settingsData);
        setPresets(presetsData.presets);
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

  const handlePresetChange = async (presetKey: string) => {
    const preset = presets[presetKey];
    if (!preset) return;

    const newVibe = presetKey === "custom" ? settings.video_vibe : preset.prompt;
    setSettings((prev) => ({
      ...prev,
      video_vibe_preset: presetKey,
      video_vibe: newVibe,
    }));
    try {
      await updateSettings({
        video_vibe_preset: presetKey,
        ...(presetKey === "custom" ? {} : { video_vibe: newVibe }),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update vibe preset");
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

        {/* Video Vibe Presets */}
        <section className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-lg bg-slate-800 p-2">
              <Palette className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Video Vibe</h2>
              <p className="text-sm text-slate-400">Choose the visual style for all generated videos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {Object.entries(presets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handlePresetChange(key)}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-all",
                  settings.video_vibe_preset === key
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                )}
              >
                <p className="font-semibold text-white">{preset.name}</p>
                <p className="text-xs text-slate-400 mt-1">{preset.description}</p>
              </button>
            ))}
          </div>

          {/* Show prompt preview or custom editor */}
          {settings.video_vibe_preset === "custom" ? (
            <div className="space-y-2">
              <Label htmlFor="video-vibe">Custom style prompt</Label>
              <Textarea
                id="video-vibe"
                rows={4}
                value={settings.video_vibe}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, video_vibe: e.target.value }))
                }
                onBlur={async () => {
                  try {
                    await updateSettings({ video_vibe: settings.video_vibe });
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : "Failed to save vibe");
                  }
                }}
                placeholder="Describe the visual style you want for your videos..."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {settings.video_vibe && (
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Environment & Style prompt <span className="text-slate-600">(all scenes)</span></Label>
                  <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3 text-sm text-slate-300 leading-relaxed">
                    {settings.video_vibe}
                  </div>
                </div>
              )}
              {presets[settings.video_vibe_preset]?.character_prompt && (
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Character style prompt <span className="text-slate-600">(only when &ldquo;Character in Scene&rdquo; is ON)</span></Label>
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-sm text-amber-200/80 leading-relaxed">
                    {presets[settings.video_vibe_preset].character_prompt}
                  </div>
                </div>
              )}
            </div>
          )}
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
