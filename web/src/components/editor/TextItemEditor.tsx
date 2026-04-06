"use client";

import React from "react";
import type { TextItem } from "@/lib/api";

interface TextItemEditorProps {
  item: TextItem;
  onUpdate: (updates: Partial<TextItem>) => void;
}

const FONT_OPTIONS = [
  "Cinzel", "Inter", "Playfair Display", "Bebas Neue", "Oswald",
  "Roboto", "Lora", "Montserrat",
];

export default function TextItemEditor({ item, onUpdate }: TextItemEditorProps) {
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Text Properties</h3>

      {/* Text content */}
      <div>
        <label className="text-[11px] text-slate-400 block mb-1">Content</label>
        <textarea
          value={item.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:border-amber-500/50 focus:outline-none"
          rows={3}
          placeholder="Enter text..."
        />
      </div>

      {/* Font family */}
      <div>
        <label className="text-[11px] text-slate-400 block mb-1">Font</label>
        <select
          value={item.font_family}
          onChange={(e) => onUpdate({ font_family: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Font size */}
      <div>
        <label className="text-[11px] text-slate-400 block mb-1">Size: {item.font_size}px</label>
        <input
          type="range"
          min={16}
          max={120}
          value={item.font_size}
          onChange={(e) => onUpdate({ font_size: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
      </div>

      {/* Color */}
      <div>
        <label className="text-[11px] text-slate-400 block mb-1">Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={item.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="w-8 h-8 rounded border border-slate-700 cursor-pointer"
          />
          <input
            type="text"
            value={item.color}
            onChange={(e) => onUpdate({ color: e.target.value })}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
          />
        </div>
      </div>

      {/* Style: weight, italic, underline */}
      <div>
        <label className="text-[11px] text-slate-400 block mb-1">Style</label>
        <div className="flex items-center gap-2">
          <select
            value={item.font_weight ?? 400}
            onChange={(e) => onUpdate({ font_weight: Number(e.target.value) })}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:border-amber-500/50 focus:outline-none"
          >
            <option value={300}>Light</option>
            <option value={400}>Regular</option>
            <option value={500}>Medium</option>
            <option value={600}>Semi-Bold</option>
            <option value={700}>Bold</option>
            <option value={900}>Black</option>
          </select>
          <button
            onClick={() => onUpdate({ font_style: item.font_style === "italic" ? "normal" : "italic" })}
            className={`w-8 h-8 rounded border text-sm font-serif italic flex items-center justify-center transition-colors ${
              item.font_style === "italic"
                ? "bg-amber-500/20 border-amber-500 text-amber-400"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
            title="Italic"
          >
            I
          </button>
          <button
            onClick={() => onUpdate({ text_decoration: item.text_decoration === "underline" ? "none" : "underline" })}
            className={`w-8 h-8 rounded border text-sm underline flex items-center justify-center transition-colors ${
              item.text_decoration === "underline"
                ? "bg-amber-500/20 border-amber-500 text-amber-400"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
            title="Underline"
          >
            U
          </button>
        </div>
      </div>

      {/* Container width */}
      <div>
        <label className="text-[11px] text-slate-400 block mb-1">Width: {Math.round((item.width ?? 0.8) * 100)}%</label>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.01}
          value={item.width ?? 0.8}
          onChange={(e) => onUpdate({ width: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-[9px] text-slate-600">
          <span>10%</span><span>50%</span><span>100%</span>
        </div>
      </div>

      {/* Timing */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Start (s)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={(item.from_frame / 30).toFixed(1)}
            onChange={(e) => onUpdate({ from_frame: Math.round(Number(e.target.value) * 30) })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Duration (s)</label>
          <input
            type="number"
            min={0.5}
            step={0.1}
            value={(item.duration_frames / 30).toFixed(1)}
            onChange={(e) => onUpdate({ duration_frames: Math.max(15, Math.round(Number(e.target.value) * 30)) })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white"
          />
        </div>
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <span className="text-sm text-slate-300">Enabled</span>
        <button
          onClick={() => onUpdate({ enabled: !item.enabled })}
          className={`w-10 h-5 rounded-full transition-colors ${item.enabled ? "bg-amber-500" : "bg-slate-700"}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${item.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
    </div>
  );
}
