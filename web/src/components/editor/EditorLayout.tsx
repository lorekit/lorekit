"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface EditorLayoutProps {
  header: React.ReactNode;
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  timeline: React.ReactNode;
}

export function EditorLayout({
  header,
  leftPanel,
  centerPanel,
  timeline,
}: EditorLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(33); // percentage
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(75, Math.max(20, pct)));
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      {header}

      <div ref={containerRef} className="flex-1 min-h-0 flex">
        {/* Left panel */}
        <div
          className="h-full overflow-y-auto border-r border-slate-800 bg-slate-950"
          style={{ width: `${leftWidth}%` }}
        >
          {leftPanel}
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="w-2 flex-shrink-0 bg-slate-800 hover:bg-amber-500/30 active:bg-amber-500/50 transition-colors cursor-col-resize flex items-center justify-center"
        >
          <div className="w-0.5 h-8 bg-slate-600 rounded-full" />
        </div>

        {/* Center panel */}
        <div className="flex-1 h-full overflow-hidden bg-slate-950">
          {centerPanel}
        </div>
      </div>

      {timeline}
    </div>
  );
}
