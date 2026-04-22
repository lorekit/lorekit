"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getUniverseCharacters,
  getSourceItems,
  getVibePresets,
  getArcTemplates,
  getCharacterImages,
  getUniverse,
  getUniverseScripts,
  generateStory,
  generateCharacterForCharacter,
  getCharacterVoice,
  uploadAudio,
  createArcTemplate,
  clipUrl,
} from "@/lib/api";
import type { Character, SourceItem, VibePreset, ArcTemplate, CharacterImageEntry, Universe, Script, CharacterVoice, AudioAnalysis } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  Shuffle,
  Loader2,
  Film,
  Zap,
  Palette,
  ScrollText,
  Wand2,
  Music,
  Mic,
  Upload,
  VolumeX,
  Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const STEPS = [
  "Choose Character",
  "Pick a Source",
  "Story Template & Create",
] as const;

type StepIndex = 0 | 1 | 2;

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  currentStep,
  completedSteps,
}: {
  currentStep: StepIndex;
  completedSteps: Set<number>;
}) {
  return (
    <nav aria-label="Wizard progress" className="w-full px-4 py-6">
      <ol className="flex items-center justify-between max-w-3xl mx-auto">
        {STEPS.map((label, idx) => {
          const isCompleted = completedSteps.has(idx);
          const isCurrent = idx === currentStep;
          const isFuture = !isCompleted && !isCurrent;

          return (
            <li
              key={label}
              className="flex items-center flex-1 last:flex-none"
            >
              {/* Circle */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-colors shrink-0",
                    isCompleted && "bg-amber-500 text-white",
                    isCurrent && "bg-amber-500 text-white ring-2 ring-amber-500/30 ring-offset-2 ring-offset-slate-950",
                    isFuture && "bg-slate-700 text-slate-400"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs whitespace-nowrap hidden sm:block",
                    isCurrent
                      ? "text-amber-400 font-medium"
                      : isCompleted
                        ? "text-amber-400/70"
                        : "text-slate-500"
                  )}
                >
                  {label}
                </span>
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-px mx-3 mt-[-1.25rem] sm:mt-0",
                    isCompleted ? "bg-amber-500" : "bg-slate-700"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Step 1 – Choose Character
// ---------------------------------------------------------------------------

function StepChooseCharacter({
  characters,
  loading,
  selected,
  onSelect,
  vibePresets,
  selectedTheme,
  onThemeChange,
}: {
  characters: Character[];
  loading: boolean;
  selected: Character[];
  onSelect: (chars: Character[]) => void;
  vibePresets: Record<string, VibePreset>;
  selectedTheme: string;
  onThemeChange: (theme: string) => void;
}) {
  const [randomMode, setRandomMode] = useState(false);

  function handleRandom() {
    if (characters.length === 0) return;
    const pick = characters[Math.floor(Math.random() * characters.length)];
    onSelect([pick]);
    setRandomMode(true);
  }

  function handleSelect(c: Character) {
    setRandomMode(false);
    const isAlreadySelected = selected.some((s) => s.id === c.id);
    if (isAlreadySelected) {
      // Deselect
      onSelect(selected.filter((s) => s.id !== c.id));
    } else {
      // Add to selection (multi-select)
      onSelect([...selected, c]);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <span className="ml-3 text-slate-400">Loading characters...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Video Style selector */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-slate-400" /> Video Style
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(vibePresets)
            .filter(([key]) => key !== "custom")
            .map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => onThemeChange(key)}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition-all",
                  selectedTheme === key
                    ? "border-amber-500 bg-amber-500/5"
                    : "border-slate-800 bg-slate-950/50 hover:border-slate-600"
                )}
              >
                <p className="text-sm font-medium text-white">{preset.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{preset.description}</p>
              </button>
            ))}
        </div>
      </div>

      {/* Character selection */}
      <div>
        <h2 className="text-xl font-semibold text-white">
          Choose Characters
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Select one or more characters for your video.
          {selected.length > 1 && (
            <span className="text-amber-400 ml-1">({selected.length} selected)</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Random card */}
        <button
          type="button"
          onClick={handleRandom}
          className={cn(
            "rounded-xl border p-4 text-left transition-all",
            "bg-slate-900 border-slate-800 hover:border-slate-600",
            randomMode && selected.length > 0
              ? "border-amber-500 bg-amber-500/5"
              : ""
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800">
              <Shuffle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-white">Random</p>
              <p className="text-xs text-slate-400">Surprise me</p>
            </div>
          </div>
        </button>

        {/* Character cards */}
        {characters.map((c) => {
          const isSelected = selected.some((s) => s.id === c.id) && !randomMode;

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all relative",
                "bg-slate-900 border-slate-800 hover:border-slate-600",
                isSelected && "border-amber-500 bg-amber-500/5"
              )}
            >
              {/* Checkbox overlay */}
              <div className={cn(
                "absolute top-2 right-2 w-5 h-5 rounded border flex items-center justify-center transition-colors",
                isSelected
                  ? "bg-amber-500 border-amber-500"
                  : "border-slate-600 bg-slate-800/50"
              )}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex items-center gap-3">
                {(() => {
                  const styles = c.character_styles_json ? JSON.parse(c.character_styles_json) : {};
                  const themedUrl = styles[selectedTheme]?.image_url || styles[selectedTheme]?.image_path;
                  const imageUrl = themedUrl || c.character_image_url;
                  return imageUrl ? (
                    <img
                      src={clipUrl(imageUrl)}
                      alt={c.name}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                    />
                  ) : null;
                })()}
                <div>
                  <p className="font-medium text-white">{c.name}</p>
                  <span className="text-xs text-slate-500 mt-1">
                    {c.quote_count} sources
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 – Choose Source Items
// ---------------------------------------------------------------------------

const THEME_COLORS: Record<string, string> = {
  mortality: "bg-red-500/20 text-red-400 border-red-500/30",
  wisdom: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  discipline: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  mindset: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  virtue: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  nature: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  strategy: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

type SourceTab = "quotes" | "scripts" | "ai_generate";

function StepChooseSources({
  characters: selectedChars,
  sourceItems,
  scripts,
  loadingItems,
  loadingScripts,
  selectedItem,
  selectedScript,
  sourceType,
  onSelectItem,
  onSelectScript,
  onSelectAiGenerate,
}: {
  characters: Character[];
  sourceItems: SourceItem[];
  scripts: Script[];
  loadingItems: boolean;
  loadingScripts: boolean;
  selectedItem: SourceItem | null;
  selectedScript: Script | null;
  sourceType: "quote" | "script" | "ai_generated";
  onSelectItem: (item: SourceItem) => void;
  onSelectScript: (script: Script) => void;
  onSelectAiGenerate: () => void;
}) {
  const isSingle = selectedChars.length === 1;
  const character = selectedChars[0];
  const charNames = selectedChars.map((c) => c.name).join(", ");

  const availableTabs: { id: SourceTab; label: string; icon: typeof ScrollText }[] = isSingle
    ? [
        { id: "quotes", label: "Quotes", icon: Film },
        { id: "scripts", label: "Scripts", icon: ScrollText },
        { id: "ai_generate", label: "AI Generate", icon: Wand2 },
      ]
    : [
        { id: "scripts", label: "Scripts", icon: ScrollText },
        { id: "ai_generate", label: "AI Generate", icon: Wand2 },
      ];

  const defaultTab = isSingle
    ? (sourceType === "quote" ? "quotes" : sourceType === "script" ? "scripts" : "ai_generate")
    : (sourceType === "script" ? "scripts" : "ai_generate");
  const [activeTab, setActiveTab] = useState<SourceTab>(defaultTab as SourceTab);
  const [filter, setFilter] = useState<string>("all");

  const themes = Array.from(new Set(sourceItems.map((q) => q.theme))).sort();
  const filteredItems = filter === "all" ? sourceItems : sourceItems.filter((q) => q.theme === filter);

  const SCRIPT_TYPE_COLORS: Record<string, string> = {
    idea: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    outline: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    full_script: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Pick a Source</h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose a source for{" "}
          <span className="text-amber-400 font-medium">{charNames}</span>
          , or let the AI generate one.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800 pb-px">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.id
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quotes tab */}
      {activeTab === "quotes" && isSingle && (
        <>
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border",
                filter === "all"
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-slate-800/80 text-slate-500 border-slate-700/60 hover:text-slate-300 hover:border-slate-600"
              )}
            >
              All ({sourceItems.length})
            </button>
            {themes.map((theme) => {
              const count = sourceItems.filter((q) => q.theme === theme).length;
              const colors = THEME_COLORS[theme] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
              return (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setFilter(theme)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border",
                    filter === theme
                      ? colors
                      : "bg-slate-800/80 text-slate-500 border-slate-700/60 hover:text-slate-300 hover:border-slate-600"
                  )}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {loadingItems ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[28rem] overflow-y-auto pr-1 custom-scrollbar">
              {filteredItems.length === 0 && (
                <p className="text-sm text-slate-500 py-8 text-center col-span-full">
                  No sources match this filter.
                </p>
              )}
              {filteredItems.map((q) => {
                const isSelected = sourceType === "quote" && selectedItem?.id === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onSelectItem(q)}
                    className={cn(
                      "text-left rounded-lg p-3 border transition-all",
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                        : "bg-slate-900/60 border-slate-800/60 hover:border-slate-600 hover:bg-slate-800/40"
                    )}
                  >
                    <p className="text-sm text-slate-200 italic leading-relaxed line-clamp-3">
                      &ldquo;{q.text}&rdquo;
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge className={cn("text-[10px]", THEME_COLORS[q.theme] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30")}>
                        {q.theme}
                      </Badge>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 ml-auto" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Scripts tab */}
      {activeTab === "scripts" && (
        <>
          {loadingScripts ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : scripts.length === 0 ? (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center space-y-2">
              <ScrollText className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-slate-400">No scripts found for {isSingle ? "this character" : "these characters"}.</p>
              <p className="text-xs text-slate-500">Create scripts from the Scripts page first.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[28rem] overflow-y-auto pr-1 custom-scrollbar">
              {scripts.map((s) => {
                const isSelected = sourceType === "script" && selectedScript?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectScript(s)}
                    className={cn(
                      "text-left rounded-lg p-4 border transition-all space-y-2",
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                        : "bg-slate-900/60 border-slate-800/60 hover:border-slate-600 hover:bg-slate-800/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white truncate">{s.title}</p>
                      {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </div>
                    <Badge className={cn("text-[10px]", SCRIPT_TYPE_COLORS[s.script_type] ?? SCRIPT_TYPE_COLORS.idea)}>
                      {s.script_type.replace("_", " ")}
                    </Badge>
                    {s.content && (
                      <p className="text-xs text-slate-400 line-clamp-2">{s.content}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* AI Generate tab */}
      {activeTab === "ai_generate" && (
        <button
          type="button"
          onClick={onSelectAiGenerate}
          className={cn(
            "w-full text-left rounded-xl border p-6 transition-all space-y-3",
            sourceType === "ai_generated"
              ? "border-amber-500 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.08)]"
              : "bg-slate-900 border-slate-800 hover:border-slate-600"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-lg",
              sourceType === "ai_generated" ? "bg-amber-500/20" : "bg-slate-800"
            )}>
              <Wand2 className={cn("w-5 h-5", sourceType === "ai_generated" ? "text-amber-400" : "text-slate-400")} />
            </div>
            <div>
              <p className="font-medium text-white">AI Generate</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Let AI generate a story from {isSingle ? `${character.name}'s` : "the selected characters'"} profile and knowledge base. No specific source needed.
              </p>
            </div>
            {sourceType === "ai_generated" && <Check className="w-5 h-5 text-amber-400 ml-auto shrink-0" />}
          </div>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 – Format & Create (combined)
// ---------------------------------------------------------------------------

const ARC_ICONS: Record<string, typeof Film> = {
  story: Film,
  rapid_montage: Zap,
};

function StepFormatAndCreate({
  character,
  selectedItem,
  selectedScript,
  sourceType,
  arcTemplates,
  vibePresets,
  universe,
  selectedArc,
  onSelectArc,
  audioMode,
  onSelectAudioMode,
  characterVoice,
  uploadedAudio,
  onUploadedAudioChange,
  uploadingAudio,
  onUploadAudio,
  aspectRatio,
  onSelectAspectRatio,
  selectedTheme,
  loading,
  generating,
  error,
  onGenerate,
  onTemplatesChange,
}: {
  character: Character;
  selectedItem: SourceItem | null;
  selectedScript: Script | null;
  sourceType: "quote" | "script" | "ai_generated";
  arcTemplates: Record<string, ArcTemplate>;
  vibePresets: Record<string, VibePreset>;
  universe: Universe | null;
  selectedArc: string;
  onSelectArc: (id: string) => void;
  audioMode: string;
  onSelectAudioMode: (mode: string) => void;
  characterVoice: CharacterVoice | null;
  uploadedAudio: (AudioAnalysis & { filename: string; file_path: string }) | null;
  onUploadedAudioChange: (audio: AudioAnalysis & { filename: string; file_path: string }) => void;
  uploadingAudio: boolean;
  onUploadAudio: (file: File) => void;
  aspectRatio: string;
  onSelectAspectRatio: (ratio: string) => void;
  selectedTheme: string;
  loading: boolean;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onTemplatesChange?: () => void;
}) {
  const [showCreateArc, setShowCreateArc] = useState(false);
  const [newArcName, setNewArcName] = useState("");
  const [newArcDesc, setNewArcDesc] = useState("");
  const [newArcMinDuration, setNewArcMinDuration] = useState(30);
  const [newArcMaxDuration, setNewArcMaxDuration] = useState(50);
  const [newArcMinScenes, setNewArcMinScenes] = useState(5);
  const [newArcMaxScenes, setNewArcMaxScenes] = useState(8);
  const [creatingArc, setCreatingArc] = useState(false);
  const vibeLabel = vibePresets[selectedTheme]?.name ?? selectedTheme;
  const arcLabel = arcTemplates[selectedArc]?.name ?? selectedArc;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <span className="ml-3 text-slate-400">Loading options...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Video Format */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Story Template</h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose the narrative structure for your video.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(arcTemplates).map(([id, arc]) => {
            const isSelected = selectedArc === id;
            const Icon = ARC_ICONS[id] ?? Film;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectArc(id)}
                className={cn(
                  "rounded-xl border p-5 text-left transition-all",
                  "bg-slate-900 hover:border-slate-600",
                  isSelected
                    ? "border-amber-500 bg-amber-500/5 shadow-[0_0_12px_rgba(245,158,11,0.08)]"
                    : "border-slate-800"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
                      isSelected ? "bg-amber-500/20" : "bg-slate-800"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        isSelected ? "text-amber-400" : "text-slate-400"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{arc.name}</p>
                      {isSelected && (
                        <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {arc.description}
                    </p>
                    <p className="mt-2 text-[10px] text-slate-500">
                      {arc.min_duration}-{arc.max_duration}s
                      {" · "}
                      {arc.min_scenes}-{arc.max_scenes} scenes
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Create custom template card */}
          {!showCreateArc ? (
            <button
              type="button"
              onClick={() => setShowCreateArc(true)}
              className="rounded-xl border border-dashed border-slate-700 p-5 text-left transition-all bg-slate-900/50 hover:border-slate-500 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5 text-slate-500" />
              <span className="text-sm text-slate-400">Custom Template</span>
            </button>
          ) : (
            <div className="rounded-xl border border-slate-700 p-5 bg-slate-900 space-y-3 col-span-full">
              <p className="text-sm font-medium text-white">Create Custom Template</p>
              <input
                type="text"
                placeholder="Template name"
                value={newArcName}
                onChange={(e) => setNewArcName(e.target.value)}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500"
              />
              <input
                type="text"
                placeholder="Description"
                value={newArcDesc}
                onChange={(e) => setNewArcDesc(e.target.value)}
                className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500">Duration (seconds)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={newArcMinDuration} onChange={(e) => setNewArcMinDuration(+e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white" />
                    <span className="text-slate-500">–</span>
                    <input type="number" value={newArcMaxDuration} onChange={(e) => setNewArcMaxDuration(+e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Scenes</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={newArcMinScenes} onChange={(e) => setNewArcMinScenes(+e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white" />
                    <span className="text-slate-500">–</span>
                    <input type="number" value={newArcMaxScenes} onChange={(e) => setNewArcMaxScenes(+e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  disabled={!newArcName || creatingArc}
                  onClick={async () => {
                    setCreatingArc(true);
                    try {
                      const created = await createArcTemplate({
                        name: newArcName,
                        description: newArcDesc,
                        min_duration: newArcMinDuration,
                        max_duration: newArcMaxDuration,
                        min_scenes: newArcMinScenes,
                        max_scenes: newArcMaxScenes,
                      });
                      onSelectArc(created.id);
                      onTemplatesChange?.();
                      setShowCreateArc(false);
                      setNewArcName("");
                      setNewArcDesc("");
                    } finally {
                      setCreatingArc(false);
                    }
                  }}
                >
                  {creatingArc ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  Create
                </Button>
                <button onClick={() => setShowCreateArc(false)} className="text-sm text-slate-400 hover:text-white">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Aspect Ratio</h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose the video format.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          {[
            { value: "9:16", label: "9:16 Portrait", desc: "YouTube Shorts, TikTok, Reels" },
            { value: "16:9", label: "16:9 Landscape", desc: "YouTube, Vimeo, widescreen" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelectAspectRatio(opt.value)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                aspectRatio === opt.value
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-slate-800 bg-slate-900 hover:border-slate-600"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={cn(
                    "border-2 rounded",
                    aspectRatio === opt.value ? "border-amber-500" : "border-slate-600",
                    opt.value === "9:16" ? "w-4 h-6" : "w-6 h-4"
                  )}
                />
                <p className="font-medium text-white text-sm">{opt.label}</p>
                {aspectRatio === opt.value && <Check className="w-4 h-4 text-amber-400 ml-auto" />}
              </div>
              <p className="text-xs text-slate-400">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Audio Mode */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Audio</h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose how audio is handled for your video.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { id: "auto", label: "Auto", desc: "AI generates background music automatically", icon: Music },
            { id: "narration", label: "Narration", desc: "AI narrates using character voice", icon: Mic, disabled: !characterVoice },
            { id: "uploaded", label: "Upload Music", desc: "Upload your own audio track", icon: Upload },
            { id: "silent", label: "Silent", desc: "No audio", icon: VolumeX },
          ].map(({ id, label, desc, icon: Icon, disabled }) => (
            <button
              key={id}
              type="button"
              onClick={() => !disabled && onSelectAudioMode(id)}
              disabled={disabled}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                "bg-slate-900 hover:border-slate-600",
                disabled && "opacity-40 cursor-not-allowed",
                audioMode === id
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-slate-800"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("w-5 h-5 shrink-0", audioMode === id ? "text-amber-400" : "text-slate-400")} />
                <div>
                  <p className={cn("text-sm font-medium", audioMode === id ? "text-white" : "text-slate-300")}>{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                  {id === "narration" && !characterVoice && (
                    <p className="text-xs text-red-400 mt-0.5">No voice profile configured</p>
                  )}
                </div>
                {audioMode === id && <Check className="w-4 h-4 text-amber-400 ml-auto shrink-0" />}
              </div>
            </button>
          ))}
        </div>

        {/* Upload zone when Upload is selected */}
        {audioMode === "uploaded" && (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center">
            {uploadedAudio ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">✓ {uploadedAudio.filename}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUploadedAudioChange(null as any); }}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                {/* Audio Player */}
                <audio
                  controls
                  src={clipUrl(`/files/${uploadedAudio.file_path.replace(/^\.\//, '')}`)}
                  className="w-full h-10 rounded-lg"
                  style={{ colorScheme: "dark" }}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Duration</p>
                    <p className="text-sm font-medium text-white">{uploadedAudio.duration_seconds.toFixed(1)}s</p>
                  </div>
                  {uploadedAudio.beats && (
                    <>
                      <div className="bg-slate-800 rounded-lg p-3">
                        <p className="text-[10px] text-slate-500">BPM</p>
                        <p className="text-sm font-medium text-white">{uploadedAudio.beats.bpm}</p>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-3">
                        <p className="text-[10px] text-slate-500">Beats</p>
                        <p className="text-sm font-medium text-white">{uploadedAudio.beats.beat_count}</p>
                      </div>
                    </>
                  )}
                  {uploadedAudio.energy && (
                    <div className="bg-slate-800 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500">Bass Drops</p>
                      <p className="text-sm font-medium text-amber-400">{uploadedAudio.energy.bass_drop_count}</p>
                    </div>
                  )}
                </div>
                {/* Cut Speed Selector */}
                <div className="mt-3">
                  <p className="text-[10px] text-slate-500 mb-1.5">Cut Speed</p>
                  <div className="flex gap-2">
                    {[
                      { value: 1, label: "Every Beat", desc: "Rapid fire" },
                      { value: 2, label: "Every 2 Beats", desc: "Fast" },
                      { value: 4, label: "Every Bar", desc: "Standard" },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (!uploadedAudio?.filename) return;
                          try {
                            const resp = await fetch(`http://localhost:8001/api/audio/analyze/${uploadedAudio.filename}?beats_per_cut=${opt.value}`);
                            if (resp.ok) {
                              const result = await resp.json();
                              onUploadedAudioChange(result);
                            }
                          } catch (err) {
                            console.error("Re-analyze failed:", err);
                          }
                        }}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-left transition-all",
                          (uploadedAudio.beats_per_cut ?? 2) === opt.value
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-slate-700 bg-slate-800 hover:border-slate-500"
                        )}
                      >
                        <p className="text-xs font-medium text-white">{opt.label}</p>
                        <p className="text-[10px] text-slate-400">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
                  <span>{uploadedAudio.segment_count} scenes</span>
                  <span>·</span>
                  <span>Cuts synced to beats</span>
                  {uploadedAudio.energy && uploadedAudio.energy.bass_drop_count > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-amber-400">{uploadedAudio.energy.bass_drop_count} flash transitions on drops</span>
                    </>
                  )}
                </div>
              </div>
            ) : uploadingAudio ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                <span className="text-sm text-slate-400">Uploading & analyzing...</span>
              </div>
            ) : (
              <label className="cursor-pointer space-y-2 block">
                <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm text-slate-400">Click to upload audio file</p>
                <p className="text-xs text-slate-500">MP3, WAV, M4A, OGG, FLAC</p>
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.ogg,.flac"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadAudio(f);
                  }}
                />
              </label>
            )}
          </div>
        )}

        {/* Narration info */}
        {audioMode === "narration" && characterVoice && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm text-white">Using voice: <span className="text-amber-400">{characterVoice.voice_name}</span></p>
            <p className="text-xs text-slate-500 mt-1">Scene durations will be determined by narration length</p>
          </div>
        )}
      </div>

      {/* Summary + Generate */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
        <h3 className="text-lg font-semibold text-white">Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500">Character</p>
            <p className="text-sm text-white font-medium">{character.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Source</p>
            {sourceType === "quote" && selectedItem ? (
              <p className="text-sm text-slate-200 italic truncate">&ldquo;{selectedItem.text}&rdquo;</p>
            ) : sourceType === "script" && selectedScript ? (
              <p className="text-sm text-slate-200 truncate">📜 {selectedScript.title}</p>
            ) : sourceType === "ai_generated" ? (
              <p className="text-sm text-slate-400">AI generates automatically</p>
            ) : (
              <p className="text-sm text-slate-400">AI chooses automatically</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Story Template</p>
            <p className="text-sm text-white font-medium">{arcLabel}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Style</p>
            <p className="text-sm text-white font-medium">{vibeLabel}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Audio</p>
            <p className="text-sm text-white font-medium capitalize">{audioMode}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={onGenerate}
          disabled={generating}
          className="w-full max-w-xs"
        >
          {generating ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 mr-2" />
          )}
          {generating ? "Generating Story..." : "Create Project & Generate Story"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard Page
// ---------------------------------------------------------------------------

export default function GenerateWizardPage({
  params,
}: {
  params: Promise<{ universeId: string }>;
}) {
  const { universeId } = use(params);
  const router = useRouter();

  // Step management
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set()
  );

  // Step 1 state
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);

  // Backward compat: primary selected character
  const selectedCharacter = selectedCharacters.length > 0 ? selectedCharacters[0] : null;

  // Step 2 state
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SourceItem | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [sourceType, setSourceType] = useState<"quote" | "script" | "ai_generated">("quote");

  // Step 3 state (format & create)
  const [arcTemplates, setArcTemplates] = useState<Record<string, ArcTemplate>>({});
  const [vibePresets, setVibePresets] = useState<Record<string, VibePreset>>({});
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [selectedArc, setSelectedArc] = useState("story");

  // Character images for selected character
  const [charImages, setCharImages] = useState<CharacterImageEntry[]>([]);

  // Aspect ratio state
  const [aspectRatio, setAspectRatio] = useState("9:16");

  // Theme state — defaults to universe's vibe preset
  const [selectedTheme, setSelectedTheme] = useState("mobile_game");

  // Audio state
  const [audioMode, setAudioMode] = useState("auto");
  const [characterVoice, setCharacterVoice] = useState<CharacterVoice | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<(AudioAnalysis & { filename: string; file_path: string }) | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Generate state
  const [generatingStory, setGeneratingStory] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ---- Fetch characters + options on mount ----
  useEffect(() => {
    let cancelled = false;
    setLoadingCharacters(true);
    getUniverseCharacters(universeId)
      .then((data) => {
        if (!cancelled) setCharacters(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCharacters(false);
      });
    return () => {
      cancelled = true;
    };
  }, [universeId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingOptions(true);
    Promise.all([getArcTemplates(), getVibePresets(), getUniverse(universeId)])
      .then(([arcData, vibeData, uniData]) => {
        if (!cancelled) {
          setArcTemplates(arcData.templates);
          setVibePresets(vibeData.presets);
          setUniverse(uniData);
          setSelectedTheme(uniData.video_vibe_preset || "mobile_game");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [universeId]);

  // ---- Fetch source items + character images + scripts when characters change ----
  useEffect(() => {
    if (!selectedCharacter) {
      setSourceItems([]);
      setSelectedItem(null);
      setSelectedScript(null);
      setSourceType("quote");
      setCharImages([]);
      setScripts([]);
      setCharacterVoice(null);
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    setLoadingScripts(true);
    setSelectedItem(null);
    setSelectedScript(null);
    setSourceType("quote");

    // Fetch quotes + images + voice for primary character
    Promise.all([
      getSourceItems({ character_id: selectedCharacter.id }),
      getCharacterImages(selectedCharacter.id).catch(() => ({ character_id: "", themes: [] })),
      getCharacterVoice(universeId, selectedCharacter.id).catch(() => null),
    ])
      .then(async ([itemData, charData, voiceData]) => {
        if (cancelled) return;
        setSourceItems(itemData);
        const allImages = charData.themes.flatMap((t) => t.images);
        setCharImages(allImages);
        setCharacterVoice(voiceData);

        // Auto-generate character image if none exists for the universe vibe
        const hasVibeImage = charData.themes.some(
          (t) => t.theme === selectedTheme && t.images.some((img) => img.url)
        );
        if (!hasVibeImage && selectedCharacter.character_description) {
          try {
            await generateCharacterForCharacter(selectedCharacter.id, { theme: selectedTheme });
            const refreshed = await getCharacterImages(selectedCharacter.id).catch(() => ({ character_id: "", themes: [] }));
            if (!cancelled) setCharImages(refreshed.themes.flatMap((t) => t.images));
          } catch (err) {
            console.error("Auto-generate character image failed:", err);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourceItems([]);
          setCharImages([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });

    // Fetch scripts for selected characters
    // For multi-character: filter by first character, then client-side filter for ALL
    getUniverseScripts(universeId, { character_id: selectedCharacter.id })
      .then((scriptData) => {
        if (cancelled) return;
        if (selectedCharacters.length > 1) {
          // Filter scripts that involve ALL selected characters
          const allIds = new Set(selectedCharacters.map((c) => c.id));
          const filtered = scriptData.filter((s) => {
            if (!s.character_ids_json) return false;
            try {
              const ids: string[] = JSON.parse(s.character_ids_json);
              return [...allIds].every((id) => ids.includes(id));
            } catch { return false; }
          });
          setScripts(filtered);
        } else {
          setScripts(scriptData);
        }
      })
      .catch(() => { if (!cancelled) setScripts([]); })
      .finally(() => { if (!cancelled) setLoadingScripts(false); });

    return () => { cancelled = true; };
  }, [selectedCharacter, selectedCharacters, universeId]);

  // ---- Navigation helpers ----
  function goNext() {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(currentStep);
      return next;
    });
    setCurrentStep((prev) => Math.min(prev + 1, 3) as StepIndex);
  }

  function goBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 0) as StepIndex);
  }

  // ---- Step 4: Create project & redirect ----
  const handleGenerateStory = useCallback(async () => {
    if (!selectedCharacter) return;
    setGeneratingStory(true);
    setGenerateError(null);
    try {
      const result = await generateStory({
        character_id: selectedCharacter.id,
        universe_id: universeId,
        quote_ids: sourceType === "quote" && selectedItem ? [selectedItem.id] : undefined,
        arc_template: selectedArc,
        theme: selectedTheme,
        aspect_ratio: aspectRatio,
        audio_mode: audioMode,
        uploaded_audio_path: uploadedAudio?.file_path,
        ...(sourceType !== "quote" && { source_type: sourceType }),
        ...(sourceType === "script" && selectedScript && { script_id: selectedScript.id }),
      } as Parameters<typeof generateStory>[0]);
      router.push(`/app/universe/${universeId}/projects/${result.project_id}`);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Story generation failed. Please try again."
      );
      setGeneratingStory(false);
    }
  }, [selectedCharacter, selectedItem, selectedArc, selectedTheme, universe, router, universeId]);

  // ---- Can proceed logic ----
  const canGoNext = (() => {
    switch (currentStep) {
      case 0:
        return selectedCharacters.length > 0;
      case 1:
        return true; // sources are optional
      case 2:
        return false; // handled by generate button
      default:
        return false;
    }
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Step indicator */}
      <StepIndicator
        currentStep={currentStep}
        completedSteps={completedSteps}
      />

      {/* Step content */}
      <div className="max-w-5xl mx-auto px-4 pb-32">
        {currentStep === 0 && (
          <StepChooseCharacter
            characters={characters}
            loading={loadingCharacters}
            selected={selectedCharacters}
            onSelect={setSelectedCharacters}
            vibePresets={vibePresets}
            selectedTheme={selectedTheme}
            onThemeChange={setSelectedTheme}
          />
        )}

        {currentStep === 1 && selectedCharacter && (
          <StepChooseSources
            characters={selectedCharacters}
            sourceItems={sourceItems}
            scripts={scripts}
            loadingItems={loadingItems}
            loadingScripts={loadingScripts}
            selectedItem={selectedItem}
            selectedScript={selectedScript}
            sourceType={sourceType}
            onSelectItem={(item) => {
              setSelectedItem(item);
              setSelectedScript(null);
              setSourceType("quote");
            }}
            onSelectScript={(script) => {
              setSelectedScript(script);
              setSelectedItem(null);
              setSourceType("script");
            }}
            onSelectAiGenerate={() => {
              setSelectedItem(null);
              setSelectedScript(null);
              setSourceType("ai_generated");
            }}
          />
        )}

        {currentStep === 2 && selectedCharacter && (
          <StepFormatAndCreate
            character={selectedCharacter}
            selectedItem={selectedItem}
            selectedScript={selectedScript}
            sourceType={sourceType}
            arcTemplates={arcTemplates}
            vibePresets={vibePresets}
            universe={universe}
            selectedArc={selectedArc}
            onSelectArc={setSelectedArc}
            audioMode={audioMode}
            onSelectAudioMode={setAudioMode}
            characterVoice={characterVoice}
            uploadedAudio={uploadedAudio}
            onUploadedAudioChange={setUploadedAudio}
            uploadingAudio={uploadingAudio}
            onUploadAudio={async (file: File) => {
              setUploadingAudio(true);
              try {
                const result = await uploadAudio(file);
                setUploadedAudio(result);
              } catch (err) {
                setGenerateError(err instanceof Error ? err.message : "Upload failed");
              } finally {
                setUploadingAudio(false);
              }
            }}
            aspectRatio={aspectRatio}
            onSelectAspectRatio={setAspectRatio}
            selectedTheme={selectedTheme}
            loading={loadingOptions}
            generating={generatingStory}
            error={generateError}
            onGenerate={handleGenerateStory}
            onTemplatesChange={async () => {
              const arcData = await getArcTemplates();
              setArcTemplates(arcData.templates);
            }}
          />
        )}
      </div>

      {/* Navigation bar */}
      <div className="fixed bottom-0 right-0 left-60 bg-slate-950/80 backdrop-blur-lg border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < 2 && (
            <Button onClick={goNext} disabled={!canGoNext}>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
