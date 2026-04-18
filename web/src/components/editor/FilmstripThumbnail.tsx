"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/api";

const THUMB_WIDTH = 48;

export function FilmstripThumbnail({ src, clipWidth, clipHeight }: { src: string; clipWidth: number; clipHeight: number }) {
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    if (!src || (!src.startsWith(API_BASE) && !src.startsWith("/"))) return;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    video.src = src;

    const frameCount = Math.max(1, Math.ceil(clipWidth / THUMB_WIDTH));
    const frames: string[] = [];
    let currentFrame = 0;

    video.addEventListener("loadedmetadata", () => {
      const interval = video.duration / frameCount;
      video.currentTime = interval * 0.5;
    });

    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const aspect = video.videoWidth / video.videoHeight;
      canvas.height = clipHeight;
      canvas.width = Math.round(clipHeight * aspect);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.5));
      currentFrame++;

      if (currentFrame < frameCount) {
        const interval = video.duration / frameCount;
        video.currentTime = interval * (currentFrame + 0.5);
      } else {
        setThumbnails(frames);
        video.src = "";
      }
    });

    return () => { video.src = ""; };
  }, [src, clipWidth, clipHeight]);

  if (thumbnails.length === 0) return null;

  return (
    <div className="absolute inset-0 flex overflow-hidden opacity-50">
      {thumbnails.map((thumb, i) => (
        <img
          key={i}
          src={thumb}
          alt=""
          className="h-full object-cover flex-shrink-0"
          style={{ width: clipWidth / thumbnails.length }}
        />
      ))}
    </div>
  );
}
