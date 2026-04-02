"use client";

import { LayoutTemplate } from "lucide-react";

export default function CarouselPage() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Carousel</h1>
          <p className="text-slate-400 mt-1">
            Create multi-slide carousel content for social media
          </p>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
          <LayoutTemplate className="h-10 w-10 text-slate-600 mx-auto mb-4" />
          <p className="text-lg text-slate-400 mb-2">Carousel Creator</p>
          <p className="text-sm text-slate-500">
            Build swipeable carousel posts using your Universe characters and source material.
          </p>
          <span className="inline-block mt-4 text-xs text-slate-600 bg-slate-800 rounded-full px-3 py-1">
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
}
