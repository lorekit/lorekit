# PhilosophyWise — Ancient Wisdom Shorts Pipeline

Full spec is in the user's original request. Key architecture decisions below.

## Stack
- Python 3.12+ with asyncio
- Claude API (sonnet) for story generation + metadata
- fal.ai → Veo 3 for video clip generation (9:16 vertical)
- ffmpeg for audio mixing, text overlays, color grading, assembly
- SQLite for quote tracking, video history, costs
- YouTube Data API v3 for auto-publishing

## Pipeline Flow
1. Quote Select → pick unused philosopher + quotes
2. Story Generate → Claude → scene breakdown JSON
3. Validate → durations, scene count, arc structure
4. Video Prompt Build → character + environment + scene → Veo prompt
5. Video Generate → parallel fal.ai calls for all scenes
6. Audio Build → music bed + SFX + ambient → mixed audio
7. Assemble → ffmpeg: stitch + transitions + color grade + text + watermark
8. Metadata → Claude → title, description, hashtags
9. Publish → YouTube API upload
10. Track → SQLite log

## Key Design Rules
- Every video: 30-50 seconds, 6-8 scenes, 3-second beats
- Arc: HOOK → WORLD → CONFLICT → STILLNESS → TRUTH → LOOP
- Loop: last 2-3s visually matches first 2-3s for seamless replay
- Text: 5th grade reading level, max 2s read time for hooks
- Audio: NO voiceover, music + SFX + ambient only
- Color grading per civilization (Roman warm gold, Chinese desaturated green, etc.)
