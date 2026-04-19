"use client";

import React, { useState } from "react";
import { Check, ChevronDown, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoiceOption {
  id: string;
  name: string;
  sample?: string;
}

interface VoicePickerProps {
  voices: VoiceOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  label?: string;
  placeholder?: string;
}

export function VoicePicker({
  voices,
  selectedId,
  onSelect,
  label = "Voice",
  placeholder = "Auto (character voice)",
}: VoicePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const selected = voices.find((v) => v.id === selectedId);
  const displayName = selected?.name ?? placeholder;
  const sampleUrl = selected?.sample;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sampleUrl) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playing) {
      setPlaying(false);
      return;
    }

    const audio = new Audio(sampleUrl);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    audio.play().catch(() => setPlaying(false));
    audioRef.current = audio;
    setPlaying(true);
  };

  // Stop on unmount or voice change
  React.useEffect(() => {
    setPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, [selectedId]);

  return (
    <div className="relative">
      {label && (
        <label className="text-xs font-medium text-slate-400 block mb-1.5">{label}</label>
      )}

      {/* Selected voice row with play button */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center justify-between bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 outline-none"
        >
          <span>{displayName}</span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-slate-500 transition-transform", isOpen && "rotate-180")} />
        </button>

        {/* Play button for selected voice */}
        {sampleUrl && (
          <button
            onClick={handlePlay}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg border transition-colors flex-shrink-0",
              playing
                ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                : "bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-400"
            )}
          >
            {playing ? (
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            ) : (
              <Play className="w-3 h-3 ml-0.5" />
            )}
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {/* Auto option */}
          <button
            onClick={() => { onSelect(""); setIsOpen(false); }}
            className={cn(
              "w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex items-center justify-between",
              !selectedId ? "text-amber-400" : "text-slate-400"
            )}
          >
            <span>{placeholder}</span>
            {!selectedId && <Check className="w-3 h-3 text-amber-400" />}
          </button>

          <div className="border-t border-slate-800" />

          {voices.map((v) => (
            <button
              key={v.id}
              onClick={() => { onSelect(v.id); setIsOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex items-center justify-between",
                selectedId === v.id ? "text-amber-400" : "text-slate-300"
              )}
            >
              <span>{v.name}</span>
              {selectedId === v.id && <Check className="w-3 h-3 text-amber-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
