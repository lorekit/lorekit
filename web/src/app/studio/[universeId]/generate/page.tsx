"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getUniverseCharacters,
  getSourceItems,
  getVibePresets,
  getArcTemplates,
  getCharacterImages,
  generateStory,
} from "@/lib/api";
import type { Character, SourceItem, VibePreset, ArcTemplate, CharacterImage } from "@/lib/api";
import {
  cn,
  CIV_COLORS,
} from "@/lib/utils";
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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const STEPS = [
  "Choose Character",
  "Pick a Source",
  "Format & Style",
  "Create Project",
] as const;

type StepIndex = 0 | 1 | 2 | 3;

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
}: {
  characters: Character[];
  loading: boolean;
  selected: Character | null;
  onSelect: (c: Character | null) => void;
}) {
  const [randomMode, setRandomMode] = useState(false);

  function handleRandom() {
    if (characters.length === 0) return;
    const pick = characters[Math.floor(Math.random() * characters.length)];
    onSelect(pick);
    setRandomMode(true);
  }

  function handleSelect(c: Character) {
    setRandomMode(false);
    onSelect(selected?.id === c.id ? null : c);
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
      <div>
        <h2 className="text-xl font-semibold text-white">
          Choose a Character
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Select the character who will drive your video.
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
            randomMode && selected
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
          const isSelected = selected?.id === c.id && !randomMode;
          const groupClass =
            CIV_COLORS[c.group] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                "bg-slate-900 border-slate-800 hover:border-slate-600",
                isSelected && "border-amber-500 bg-amber-500/5"
              )}
            >
              <div className="flex items-center gap-3">
                {c.character_image_url && (
                  <img
                    src={c.character_image_url}
                    alt={c.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                  />
                )}
                <div>
                  <p className="font-medium text-white">{c.name}</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <Badge className={groupClass}>{c.group}</Badge>
                    <span className="text-xs text-slate-500">
                      {c.quote_count} sources
                    </span>
                  </div>
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

function StepChooseSources({
  character,
  sourceItems,
  loadingItems,
  selectedItem,
  onSelect,
}: {
  character: Character;
  sourceItems: SourceItem[];
  loadingItems: boolean;
  selectedItem: SourceItem | null;
  onSelect: (item: SourceItem) => void;
}) {
  const [filter, setFilter] = useState<string>("all");

  const themes = Array.from(new Set(sourceItems.map((q) => q.theme))).sort();

  const filteredItems =
    filter === "all"
      ? sourceItems
      : sourceItems.filter((q) => q.theme === filter);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Pick a Source
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Pick a source that inspires the video for{" "}
          <span className="text-amber-400 font-medium">
            {character.name}
          </span>
          , or skip and let the AI choose.
        </p>
      </div>

      {/* Theme filter pills */}
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
          const colors =
            THEME_COLORS[theme] ??
            "bg-slate-500/20 text-slate-400 border-slate-500/30";
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

      {/* Source item grid */}
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
            const isSelected = selectedItem?.id === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelect(q)}
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
                  <Badge
                    className={cn(
                      "text-[10px]",
                      THEME_COLORS[q.theme] ??
                        "bg-slate-500/20 text-slate-400 border-slate-500/30"
                    )}
                  >
                    {q.theme}
                  </Badge>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-amber-400 ml-auto" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 – Format & Style
// ---------------------------------------------------------------------------

const ARC_ICONS: Record<string, typeof Film> = {
  story: Film,
  rapid_montage: Zap,
};

const VIBE_STYLE_CLASSES: Record<string, string> = {
  mobile_game: "border-emerald-500 bg-emerald-500/10",
  cinematic: "border-amber-500 bg-amber-500/10",
  stylized_cinematic: "border-purple-500 bg-purple-500/10",
  dark_masculine: "border-slate-400 bg-slate-400/10",
  custom: "border-slate-600 bg-slate-800",
};

function StepFormatStyle({
  arcTemplates,
  vibePresets,
  selectedArc,
  selectedVibe,
  onSelectArc,
  onSelectVibe,
  loading,
  charImages,
}: {
  arcTemplates: Record<string, ArcTemplate>;
  vibePresets: Record<string, VibePreset>;
  selectedArc: string;
  selectedVibe: string;
  onSelectArc: (id: string) => void;
  onSelectVibe: (id: string) => void;
  loading: boolean;
  charImages: CharacterImage[];
}) {
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
          <h2 className="text-xl font-semibold text-white">Video Format</h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose the structure for your video.
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
        </div>
      </div>

      {/* Visual Style */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-slate-400" />
            Visual Style
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose the art style and vibe. This overrides the global setting for this project.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(vibePresets)
            .filter(([id]) => id !== "custom")
            .map(([id, preset]) => {
              const isSelected = selectedVibe === id;
              const themeImage = charImages.find((ci) => ci.theme === id && ci.url);

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectVibe(id)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    "hover:border-slate-600",
                    isSelected
                      ? VIBE_STYLE_CLASSES[id] ?? "border-amber-500 bg-amber-500/10"
                      : "bg-slate-900 border-slate-800"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {themeImage?.url && (
                      <img
                        src={themeImage.url}
                        alt={preset.name}
                        className="w-10 h-14 object-cover rounded-md border border-slate-700 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p
                          className={cn(
                            "font-medium text-sm",
                            isSelected ? "text-white" : "text-slate-300"
                          )}
                        >
                          {preset.name}
                        </p>
                        {isSelected && (
                          <Check className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                        {preset.description}
                      </p>
                      {themeImage ? (
                        <p className="mt-1 text-[10px] text-emerald-400">Character ready</p>
                      ) : (
                        <p className="mt-1 text-[10px] text-slate-500">No character image yet</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 – Create Project (summary + generate button)
// ---------------------------------------------------------------------------

function StepCreateProject({
  character,
  selectedItem,
  selectedArc,
  selectedVibe,
  arcTemplates,
  vibePresets,
  generating,
  error,
  onGenerate,
}: {
  character: Character;
  selectedItem: SourceItem | null;
  selectedArc: string;
  selectedVibe: string;
  arcTemplates: Record<string, ArcTemplate>;
  vibePresets: Record<string, VibePreset>;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  const arcLabel = arcTemplates[selectedArc]?.name ?? selectedArc;
  const vibeLabel = vibePresets[selectedVibe]?.name ?? selectedVibe;

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8 max-w-lg mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white">Create Project</h2>
        <p className="text-sm text-slate-400">
          The AI will generate a cinematic story breakdown and create your project.
        </p>
      </div>

      {/* Summary card */}
      <div className="w-full bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
        <div>
          <p className="text-xs text-slate-500">Character</p>
          <p className="text-sm text-white font-medium">{character.name}</p>
          <Badge
            className={cn(
              "mt-1 text-[10px]",
              CIV_COLORS[character.group] ??
                "bg-slate-500/20 text-slate-400 border-slate-500/30"
            )}
          >
            {character.group}
          </Badge>
        </div>

        <div>
          <p className="text-xs text-slate-500">Source</p>
          {selectedItem ? (
            <p className="text-sm text-slate-200 italic mt-1">
              &ldquo;{selectedItem.text}&rdquo;
            </p>
          ) : (
            <p className="text-sm text-slate-400 mt-1">
              AI will choose the best sources automatically
            </p>
          )}
        </div>

        <div className="flex gap-6">
          <div>
            <p className="text-xs text-slate-500">Format</p>
            <p className="text-sm text-white font-medium mt-0.5">{arcLabel}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Style / Theme</p>
            <p className="text-sm text-white font-medium mt-0.5">{vibeLabel}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Character images + clips will use this theme
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-400">
          {error}
        </div>
      )}

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
  const [selectedCharacter, setSelectedCharacter] =
    useState<Character | null>(null);

  // Step 2 state
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SourceItem | null>(null);

  // Step 3 state (format & style)
  const [arcTemplates, setArcTemplates] = useState<Record<string, ArcTemplate>>({});
  const [vibePresets, setVibePresets] = useState<Record<string, VibePreset>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [selectedArc, setSelectedArc] = useState("story");
  const [selectedVibe, setSelectedVibe] = useState("mobile_game");

  // Character images for selected character
  const [charImages, setCharImages] = useState<CharacterImage[]>([]);

  // Step 4 state
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
    Promise.all([getArcTemplates(), getVibePresets()])
      .then(([arcData, vibeData]) => {
        if (!cancelled) {
          setArcTemplates(arcData.templates);
          setVibePresets(vibeData.presets);
          // Default to the global vibe preset if it exists
          const keys = Object.keys(vibeData.presets);
          if (keys.length > 0 && !vibeData.presets[selectedVibe]) {
            setSelectedVibe(keys[0]);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Fetch source items + character images when character changes ----
  useEffect(() => {
    if (!selectedCharacter) {
      setSourceItems([]);
      setSelectedItem(null);
      setCharImages([]);
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    setSelectedItem(null);
    Promise.all([
      getSourceItems({ character_id: selectedCharacter.id }),
      getCharacterImages(selectedCharacter.id).catch(() => ({ images: [] as CharacterImage[] })),
    ])
      .then(([itemData, charData]) => {
        if (!cancelled) {
          setSourceItems(itemData);
          setCharImages(charData.images);
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
    return () => {
      cancelled = true;
    };
  }, [selectedCharacter]);

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
        quote_ids: selectedItem ? [selectedItem.id] : undefined,
        arc_template: selectedArc,
        theme: selectedVibe,
      });
      router.push(`/studio/${universeId}/projects/${result.project_id}`);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Story generation failed. Please try again."
      );
      setGeneratingStory(false);
    }
  }, [selectedCharacter, selectedItem, selectedArc, selectedVibe, router, universeId]);

  // ---- Can proceed logic ----
  const canGoNext = (() => {
    switch (currentStep) {
      case 0:
        return selectedCharacter !== null;
      case 1:
        return true; // sources are optional
      case 2:
        return true; // format/style always has a default selection
      case 3:
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
            selected={selectedCharacter}
            onSelect={setSelectedCharacter}
          />
        )}

        {currentStep === 1 && selectedCharacter && (
          <StepChooseSources
            character={selectedCharacter}
            sourceItems={sourceItems}
            loadingItems={loadingItems}
            selectedItem={selectedItem}
            onSelect={(item) => setSelectedItem(item)}
          />
        )}

        {currentStep === 2 && (
          <StepFormatStyle
            arcTemplates={arcTemplates}
            vibePresets={vibePresets}
            selectedArc={selectedArc}
            selectedVibe={selectedVibe}
            onSelectArc={setSelectedArc}
            onSelectVibe={setSelectedVibe}
            loading={loadingOptions}
            charImages={charImages}
          />
        )}

        {currentStep === 3 && selectedCharacter && (
          <StepCreateProject
            character={selectedCharacter}
            selectedItem={selectedItem}
            selectedArc={selectedArc}
            selectedVibe={selectedVibe}
            arcTemplates={arcTemplates}
            vibePresets={vibePresets}
            generating={generatingStory}
            error={generateError}
            onGenerate={handleGenerateStory}
          />
        )}
      </div>

      {/* Navigation bar */}
      <div className="fixed bottom-0 inset-x-0 bg-slate-950/80 backdrop-blur-lg border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < 3 && (
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
