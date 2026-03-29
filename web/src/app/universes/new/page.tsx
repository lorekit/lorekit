"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Globe,
  Palette,
} from "lucide-react";
import { createUniverse, createEnvironment, getVibePresets } from "@/lib/api";
import type { VibePreset } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUniverseStore } from "@/stores/universe-store";

const STEPS = ["Basics", "Video Style", "Environments"] as const;
type StepIdx = 0 | 1 | 2;

const ICON_OPTIONS = ["🌐", "🏛️", "⚔️", "🎭", "🧠", "🔮", "🏔️", "🌊", "🔥", "💀", "👑", "📚", "🎬", "🚀", "🌙"];

interface EnvDraft {
  name: string;
  font: string;
  text_color: string;
  environment_description: string;
}

export default function NewUniversePage() {
  const router = useRouter();
  const { setActiveUniverse, fetchUniverses } = useUniverseStore();

  const [step, setStep] = useState<StepIdx>(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🌐");

  // Step 2 - Video Style
  const [videoVibePreset, setVideoVibePreset] = useState("mobile_game");
  const [vibePresets, setVibePresets] = useState<Record<string, VibePreset>>({});
  const [loadingPresets, setLoadingPresets] = useState(true);

  // Step 3
  const [environments, setEnvironments] = useState<EnvDraft[]>([]);

  // Fetch vibe presets on mount
  useEffect(() => {
    getVibePresets()
      .then((data) => setVibePresets(data.presets))
      .catch(() => {})
      .finally(() => setLoadingPresets(false));
  }, []);

  function addEnvironment() {
    setEnvironments([...environments, { name: "", font: "Cinzel", text_color: "#FFFFFF", environment_description: "" }]);
  }

  function updateEnv(idx: number, updates: Partial<EnvDraft>) {
    setEnvironments(environments.map((e, i) => (i === idx ? { ...e, ...updates } : e)));
  }

  function removeEnv(idx: number) {
    setEnvironments(environments.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const uni = await createUniverse({ name: name.trim(), description: description.trim(), icon, video_vibe_preset: videoVibePreset });

      // Create environments
      for (const env of environments) {
        if (env.name.trim()) {
          await createEnvironment(uni.id, {
            name: env.name.trim(),
            font: env.font,
            text_color: env.text_color,
            environment_description: env.environment_description,
          });
        }
      }

      setActiveUniverse(uni.id);
      await fetchUniverses();
      router.push(`/universe/${uni.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create universe");
      setCreating(false);
    }
  }

  const canNext = step === 0 ? name.trim().length > 0 : true;

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-3xl font-bold text-white mb-2">Create Universe</h1>
      <p className="text-slate-400 mb-8">Set up a new creative world for your content.</p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, idx) => (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <button
              onClick={() => idx <= step && setStep(idx as StepIdx)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                idx === step
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : idx < step
                  ? "bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
                  : "bg-slate-900 text-slate-500 border border-slate-800"
              )}
            >
              {idx < step ? <Check className="w-3 h-3" /> : <span>{idx + 1}</span>}
              {label}
            </button>
            {idx < STEPS.length - 1 && (
              <div className={cn("flex-1 h-px", idx < step ? "bg-amber-500" : "bg-slate-800")} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basics */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PhilosophyWise, FinanceBros, FutbolLegends"
              className="max-w-md"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this universe about?"
              rows={3}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div>
            <label className="text-sm text-slate-400 mb-2 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((ico) => (
                <button
                  key={ico}
                  onClick={() => setIcon(ico)}
                  className={cn(
                    "w-10 h-10 rounded-lg border text-xl flex items-center justify-center transition-all",
                    icon === ico
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-slate-700 bg-slate-900 hover:border-slate-600"
                  )}
                >
                  {ico}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Video Style */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Choose the default video style for this universe. This determines the visual vibe for generated clips.
          </p>
          {loadingPresets ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(vibePresets)
                .filter(([k]) => k !== "custom")
                .map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setVideoVibePreset(key)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      videoVibePreset === key
                        ? "border-amber-500 bg-amber-500/5"
                        : "border-slate-800 bg-slate-900 hover:border-slate-600"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Palette className="w-4 h-4 text-slate-400" />
                      <p className="font-medium text-white text-sm">{preset.name}</p>
                      {videoVibePreset === key && <Check className="w-4 h-4 text-amber-400 ml-auto" />}
                    </div>
                    <p className="text-xs text-slate-400">{preset.description}</p>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Environments */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Add environments (visual presets) for your universe. You can skip this and add them later.
          </p>

          {environments.map((env, idx) => (
            <div key={idx} className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  value={env.name}
                  onChange={(e) => updateEnv(idx, { name: e.target.value })}
                  placeholder="Environment name (e.g. Roman, Cyberpunk)"
                  className="flex-1"
                />
                <button
                  onClick={() => removeEnv(idx)}
                  className="text-slate-500 hover:text-red-400 text-xs"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={env.font}
                  onChange={(e) => updateEnv(idx, { font: e.target.value })}
                  placeholder="Font (e.g. Cinzel)"
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={env.text_color}
                    onChange={(e) => updateEnv(idx, { text_color: e.target.value })}
                    placeholder="#FFFFFF"
                    className="flex-1"
                  />
                  <div
                    className="w-8 h-8 rounded border border-slate-700 shrink-0"
                    style={{ backgroundColor: env.text_color }}
                  />
                </div>
              </div>
              <textarea
                value={env.environment_description}
                onChange={(e) => updateEnv(idx, { environment_description: e.target.value })}
                placeholder="Description of this environment..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-500 resize-none"
              />
            </div>
          ))}

          <button
            onClick={addEnvironment}
            className="w-full rounded-lg border border-dashed border-slate-700 p-3 text-sm text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            + Add Environment
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1) as StepIdx)}
          disabled={step === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {step < 2 ? (
          <Button onClick={() => setStep((s) => Math.min(2, s + 1) as StepIdx)} disabled={!canNext}>
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={creating || !name.trim()}>
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Globe className="w-4 h-4 mr-2" />
            )}
            {creating ? "Creating..." : "Create Universe"}
          </Button>
        )}
      </div>
    </div>
  );
}
