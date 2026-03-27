"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getPhilosophers,
  getQuotes,
  generateStory,
} from "@/lib/api";
import type { Philosopher, Quote } from "@/lib/api";
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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const STEPS = [
  "Choose Philosopher",
  "Pick a Quote",
  "Create Project",
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
// Step 1 – Choose Philosopher
// ---------------------------------------------------------------------------

function StepChoosePhilosopher({
  philosophers,
  loading,
  selected,
  onSelect,
}: {
  philosophers: Philosopher[];
  loading: boolean;
  selected: Philosopher | null;
  onSelect: (p: Philosopher | null) => void;
}) {
  const [randomMode, setRandomMode] = useState(false);

  function handleRandom() {
    if (philosophers.length === 0) return;
    const pick = philosophers[Math.floor(Math.random() * philosophers.length)];
    onSelect(pick);
    setRandomMode(true);
  }

  function handleSelect(p: Philosopher) {
    setRandomMode(false);
    onSelect(selected?.id === p.id ? null : p);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <span className="ml-3 text-slate-400">Loading philosophers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Choose a Philosopher
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Select the philosopher whose wisdom will drive your video.
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

        {/* Philosopher cards */}
        {philosophers.map((p) => {
          const isSelected = selected?.id === p.id && !randomMode;
          const civClass =
            CIV_COLORS[p.civilization] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                "bg-slate-900 border-slate-800 hover:border-slate-600",
                isSelected && "border-amber-500 bg-amber-500/5"
              )}
            >
              <div className="flex items-center gap-3">
                {p.character_image_url && (
                  <img
                    src={p.character_image_url}
                    alt={p.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                  />
                )}
                <div>
                  <p className="font-medium text-white">{p.name}</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <Badge className={civClass}>{p.civilization}</Badge>
                    <span className="text-xs text-slate-500">
                      {p.quote_count} quotes
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
// Step 2 – Choose Quotes
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

function StepChooseQuotes({
  philosopher,
  quotes,
  loadingQuotes,
  selectedQuote,
  onSelect,
}: {
  philosopher: Philosopher;
  quotes: Quote[];
  loadingQuotes: boolean;
  selectedQuote: Quote | null;
  onSelect: (q: Quote) => void;
}) {
  const [filter, setFilter] = useState<string>("all");

  const themes = Array.from(new Set(quotes.map((q) => q.theme))).sort();

  const filteredQuotes =
    filter === "all"
      ? quotes
      : quotes.filter((q) => q.theme === filter);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Pick a Quote
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Pick a quote that inspires the video for{" "}
          <span className="text-amber-400 font-medium">
            {philosopher.name}
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

      {/* Quote grid */}
      {loadingQuotes ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[28rem] overflow-y-auto pr-1 custom-scrollbar">
          {filteredQuotes.length === 0 && (
            <p className="text-sm text-slate-500 py-8 text-center col-span-full">
              No quotes match this filter.
            </p>
          )}
          {filteredQuotes.map((q) => {
            const isSelected = selectedQuote?.id === q.id;
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
// Step 3 – Create Project (summary + generate button)
// ---------------------------------------------------------------------------

function StepCreateProject({
  philosopher,
  selectedQuote,
  generating,
  error,
  onGenerate,
}: {
  philosopher: Philosopher;
  selectedQuote: Quote | null;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
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
          <p className="text-xs text-slate-500">Philosopher</p>
          <p className="text-sm text-white font-medium">{philosopher.name}</p>
          <Badge
            className={cn(
              "mt-1 text-[10px]",
              CIV_COLORS[philosopher.civilization] ??
                "bg-slate-500/20 text-slate-400 border-slate-500/30"
            )}
          >
            {philosopher.civilization}
          </Badge>
        </div>

        <div>
          <p className="text-xs text-slate-500">Quote</p>
          {selectedQuote ? (
            <p className="text-sm text-slate-200 italic mt-1">
              &ldquo;{selectedQuote.text}&rdquo;
            </p>
          ) : (
            <p className="text-sm text-slate-400 mt-1">
              AI will choose the best quotes automatically
            </p>
          )}
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

export default function GenerateWizardPage() {
  const router = useRouter();

  // Step management
  const [currentStep, setCurrentStep] = useState<StepIndex>(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set()
  );

  // Step 1 state
  const [philosophers, setPhilosophers] = useState<Philosopher[]>([]);
  const [loadingPhilosophers, setLoadingPhilosophers] = useState(true);
  const [selectedPhilosopher, setSelectedPhilosopher] =
    useState<Philosopher | null>(null);

  // Step 2 state
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // Step 3 state
  const [generatingStory, setGeneratingStory] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ---- Fetch philosophers on mount ----
  useEffect(() => {
    let cancelled = false;
    setLoadingPhilosophers(true);
    getPhilosophers()
      .then((data) => {
        if (!cancelled) setPhilosophers(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingPhilosophers(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Fetch quotes when philosopher changes ----
  useEffect(() => {
    if (!selectedPhilosopher) {
      setQuotes([]);
      setSelectedQuote(null);
      return;
    }
    let cancelled = false;
    setLoadingQuotes(true);
    setSelectedQuote(null);
    getQuotes({ philosopher_id: selectedPhilosopher.id })
      .then((data) => {
        if (!cancelled) setQuotes(data);
      })
      .catch(() => {
        if (!cancelled) setQuotes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuotes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPhilosopher]);

  // ---- Navigation helpers ----
  function goNext() {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(currentStep);
      return next;
    });
    setCurrentStep((prev) => Math.min(prev + 1, 2) as StepIndex);
  }

  function goBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 0) as StepIndex);
  }

  // ---- Step 3: Create project & redirect ----
  const handleGenerateStory = useCallback(async () => {
    if (!selectedPhilosopher) return;
    setGeneratingStory(true);
    setGenerateError(null);
    try {
      const result = await generateStory({
        philosopher_id: selectedPhilosopher.id,
        quote_ids: selectedQuote ? [selectedQuote.id] : undefined,
      });
      router.push(`/projects/${result.project_id}`);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Story generation failed. Please try again."
      );
      setGeneratingStory(false);
    }
  }, [selectedPhilosopher, selectedQuote, router]);

  // ---- Can proceed logic ----
  const canGoNext = (() => {
    switch (currentStep) {
      case 0:
        return selectedPhilosopher !== null;
      case 1:
        return true; // quotes are optional
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
          <StepChoosePhilosopher
            philosophers={philosophers}
            loading={loadingPhilosophers}
            selected={selectedPhilosopher}
            onSelect={setSelectedPhilosopher}
          />
        )}

        {currentStep === 1 && selectedPhilosopher && (
          <StepChooseQuotes
            philosopher={selectedPhilosopher}
            quotes={quotes}
            loadingQuotes={loadingQuotes}
            selectedQuote={selectedQuote}
            onSelect={(q) => setSelectedQuote(q)}
          />
        )}

        {currentStep === 2 && selectedPhilosopher && (
          <StepCreateProject
            philosopher={selectedPhilosopher}
            selectedQuote={selectedQuote}
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
