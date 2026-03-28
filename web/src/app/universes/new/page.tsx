"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Globe,
  Palette,
  LayoutTemplate,
} from "lucide-react";
import { createUniverse, createEnvironment, createTemplate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUniverseStore } from "@/stores/universe-store";

const STEPS = ["Basics", "Theme", "Environments", "Templates"] as const;
type StepIdx = 0 | 1 | 2 | 3;

const THEME_OPTIONS = [
  { id: "cinematic", label: "Cinematic Realism", desc: "Dramatic, moody, photorealistic" },
  { id: "mobile_game", label: "Mobile Game", desc: "Colorful, chunky, fun" },
  { id: "stylized_cinematic", label: "Stylized Cinematic", desc: "Painterly, Arcane-style" },
  { id: "dark_masculine", label: "Dark Masculine", desc: "Desaturated, high-contrast, raw" },
];

const ICON_OPTIONS = ["🌐", "🏛️", "⚔️", "🎭", "🧠", "🔮", "🏔️", "🌊", "🔥", "💀", "👑", "📚", "🎬", "🚀", "🌙"];

interface EnvDraft {
  name: string;
  font: string;
  text_color: string;
  environment_description: string;
}

interface TmplDraft {
  name: string;
  description: string;
  min_duration: number;
  max_duration: number;
  min_scenes: number;
  max_scenes: number;
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

  // Step 2
  const [theme, setTheme] = useState("cinematic");

  // Step 3
  const [environments, setEnvironments] = useState<EnvDraft[]>([]);

  // Step 4
  const [templates, setTemplates] = useState<TmplDraft[]>([
    { name: "Full Story", description: "Narrative arc with hook, conflict, truth, and loop", min_duration: 30, max_duration: 50, min_scenes: 5, max_scenes: 8 },
    { name: "Rapid Montage", description: "Fast cuts with intense imagery", min_duration: 8, max_duration: 18, min_scenes: 6, max_scenes: 14 },
  ]);

  function addEnvironment() {
    setEnvironments([...environments, { name: "", font: "Cinzel", text_color: "#FFFFFF", environment_description: "" }]);
  }

  function updateEnv(idx: number, updates: Partial<EnvDraft>) {
    setEnvironments(environments.map((e, i) => (i === idx ? { ...e, ...updates } : e)));
  }

  function removeEnv(idx: number) {
    setEnvironments(environments.filter((_, i) => i !== idx));
  }

  function addTemplate() {
    setTemplates([...templates, { name: "", description: "", min_duration: 15, max_duration: 60, min_scenes: 3, max_scenes: 10 }]);
  }

  function updateTmpl(idx: number, updates: Partial<TmplDraft>) {
    setTemplates(templates.map((t, i) => (i === idx ? { ...t, ...updates } : t)));
  }

  function removeTmpl(idx: number) {
    setTemplates(templates.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const uni = await createUniverse({ name: name.trim(), description: description.trim(), theme, icon });

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

      // Create templates
      for (const tmpl of templates) {
        if (tmpl.name.trim()) {
          await createTemplate(uni.id, {
            name: tmpl.name.trim(),
            description: tmpl.description,
            min_duration: tmpl.min_duration,
            max_duration: tmpl.max_duration,
            min_scenes: tmpl.min_scenes,
            max_scenes: tmpl.max_scenes,
          });
        }
      }

      setActiveUniverse(uni.id);
      await fetchUniverses();
      router.push(`/studio/${uni.id}`);
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

      {/* Step 2: Theme */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Select a default visual theme for this universe.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  theme === t.id
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-slate-800 bg-slate-900 hover:border-slate-600"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Palette className="w-4 h-4 text-slate-400" />
                  <p className="font-medium text-white text-sm">{t.label}</p>
                  {theme === t.id && <Check className="w-4 h-4 text-amber-400 ml-auto" />}
                </div>
                <p className="text-xs text-slate-400">{t.desc}</p>
              </button>
            ))}
          </div>
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

      {/* Step 4: Templates */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Configure scene templates (story structures) for this universe.
          </p>

          {templates.map((tmpl, idx) => (
            <div key={idx} className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  value={tmpl.name}
                  onChange={(e) => updateTmpl(idx, { name: e.target.value })}
                  placeholder="Template name"
                  className="flex-1"
                />
                <button
                  onClick={() => removeTmpl(idx)}
                  className="text-slate-500 hover:text-red-400 text-xs"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={tmpl.description}
                onChange={(e) => updateTmpl(idx, { description: e.target.value })}
                placeholder="Description..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-500 resize-none"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500">Min Duration</label>
                  <Input
                    type="number"
                    value={tmpl.min_duration}
                    onChange={(e) => updateTmpl(idx, { min_duration: +e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Max Duration</label>
                  <Input
                    type="number"
                    value={tmpl.max_duration}
                    onChange={(e) => updateTmpl(idx, { max_duration: +e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Min Scenes</label>
                  <Input
                    type="number"
                    value={tmpl.min_scenes}
                    onChange={(e) => updateTmpl(idx, { min_scenes: +e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Max Scenes</label>
                  <Input
                    type="number"
                    value={tmpl.max_scenes}
                    onChange={(e) => updateTmpl(idx, { max_scenes: +e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addTemplate}
            className="w-full rounded-lg border border-dashed border-slate-700 p-3 text-sm text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            + Add Template
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

        {step < 3 ? (
          <Button onClick={() => setStep((s) => Math.min(3, s + 1) as StepIdx)} disabled={!canNext}>
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
