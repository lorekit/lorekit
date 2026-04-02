"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface EditorLayoutProps {
  header: React.ReactNode;
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  timeline: React.ReactNode;
}

export function EditorLayout({
  header,
  leftPanel,
  centerPanel,
  rightPanel,
  timeline,
}: EditorLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(25); // percentage
  const [rightWidth, setRightWidth] = useState(25); // percentage
  const draggingLeft = useRef(false);
  const draggingRight = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onLeftMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingLeft.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRight.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;

      if (draggingLeft.current) {
        setLeftWidth(Math.min(50, Math.max(20, pct)));
      } else if (draggingRight.current) {
        // Right handle: pct is where the handle is, rightWidth = 100 - pct
        setRightWidth(Math.min(50, Math.max(20, 100 - pct)));
      }
    };
    const onMouseUp = () => {
      draggingLeft.current = false;
      draggingRight.current = false;
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
    <div className="flex flex-col h-screen bg-black text-white">
      {header}

      {/* Main panels area with gaps */}
      <div ref={containerRef} className="flex-1 min-h-0 flex gap-1.5 px-1.5 pt-1.5">
        {/* Left panel */}
        <div
          className="h-full overflow-y-auto bg-slate-900/80 rounded-lg relative"
          style={{ width: `${leftWidth}%` }}
        >
          {leftPanel}
          {/* Drag handle — overlaid on right edge */}
          <div
            onMouseDown={onLeftMouseDown}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500/50 transition-colors z-10"
          />
        </div>

        {/* Center panel */}
        <div className="flex-1 h-full overflow-hidden bg-slate-900/80 rounded-lg">
          {centerPanel}
        </div>

        {/* Right panel */}
        <div
          className="h-full overflow-y-auto bg-slate-900/80 rounded-lg relative"
          style={{ width: `${rightWidth}%` }}
        >
          {rightPanel}
          {/* Drag handle — overlaid on left edge */}
          <div
            onMouseDown={onRightMouseDown}
            className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500/50 transition-colors z-10"
          />
        </div>
      </div>

      {/* Timeline with gap */}
      <div className="px-1.5 pb-1.5 pt-1.5">
        <div className="bg-slate-900/80 rounded-lg">
          {timeline}
        </div>
      </div>
    </div>
  );
}
