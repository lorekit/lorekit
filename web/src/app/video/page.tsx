"use client";

import { Film } from "lucide-react";

export default function VideoPage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Video</h1>
          <p className="text-slate-400 mt-1">
            Edit and remix existing videos with AI tools
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
            <Film className="h-10 w-10 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Face Swap</h3>
            <p className="text-sm text-slate-400">
              Replace faces in existing videos using fal.ai
            </p>
            <span className="inline-block mt-4 text-xs text-slate-600 bg-slate-800 rounded-full px-3 py-1">
              Coming Soon
            </span>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
            <Film className="h-10 w-10 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Style Transfer</h3>
            <p className="text-sm text-slate-400">
              Re-theme existing footage with different visual styles
            </p>
            <span className="inline-block mt-4 text-xs text-slate-600 bg-slate-800 rounded-full px-3 py-1">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
