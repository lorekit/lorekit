import { DocH1, DocH2, DocH3, DocLead, DocP, DocTable, DocCallout, DocBadge, DocSection, DocCodeBlock } from "@/components/docs";

const PARAM_COLS = [
  { key: "name", label: "Name", mono: true, accent: true },
  { key: "type", label: "Type", mono: true },
  { key: "default", label: "Default", mono: true },
  { key: "desc", label: "Description" },
];

export default function NodesDocsPage() {
  return (
    <>
      <DocH1>Workflow Nodes</DocH1>
      <DocLead>
        LoreKit uses a node-based workflow system where each node is a single operation — generating an image,
        creating a video, swapping a face, stitching clips together. Connect outputs to inputs to build any pipeline.
      </DocLead>

      <DocCallout type="tip">
        Nodes can be added via the canvas UI (<strong>+ Add Node</strong>) or programmatically via MCP tools
        (<code className="text-cyan-400/70">lorekit_workflow_add_node</code>). Claude can compose entire pipelines from natural language.
      </DocCallout>

      {/* Pipeline examples */}
      <DocSection>
        <DocH2>Pipeline Examples</DocH2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { name: "UGC Ad", flow: "character_ref → kontext_keyframe → kling_v3_pro" },
            { name: "Multi-Scene Video", flow: "character_ref → keyframe × N → clip × N → video_stitch" },
            { name: "Clone Yourself", flow: "kontext_keyframe → face_swap → kling_v3_pro" },
            { name: "Product Placement", flow: "kontext_keyframe → kontext_edit → kling_v3_pro → ffmpeg_overlay" },
            { name: "Import & Remix", flow: "download → extract_frames → face_swap → kling_v3_pro → video_stitch" },
            { name: "Upscale + BG Swap", flow: "kontext_keyframe → bg_remove → kontext_edit → upscale" },
          ].map((p) => (
            <div key={p.name} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-sm font-medium text-white mb-1">{p.name}</p>
              <p className="text-xs text-slate-400 font-mono">{p.flow}</p>
            </div>
          ))}
        </div>
      </DocSection>

      {/* ── Image Generation ── */}
      <DocSection>
        <DocH2 id="image-generation">Image Generation</DocH2>

        <DocH3 id="kontext-keyframe">Kontext Keyframe</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">kontext_keyframe</code>
          <DocBadge>$0.04</DocBadge>
          <DocBadge color="slate">fal.ai Flux Pro Kontext Max Multi</DocBadge>
        </div>
        <DocP>
          Generates a high-quality image from a text prompt and up to 4 reference photos.
          The primary way to create character-consistent keyframes that serve as the starting frame for video generation.
        </DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "prompt", type: "string", default: "required", desc: "Detailed scene description: character pose, expression, setting, lighting" },
          { name: "reference_images", type: "string[]", default: "[]", desc: "Up to 4 image URLs that anchor the character's appearance" },
          { name: "aspect_ratio", type: "string", default: '"9:16"', desc: '"9:16" (portrait) or "16:9" (landscape)' },
          { name: "scene_id", type: "int", default: "—", desc: "Links this node to a timeline scene" },
        ]} />
        <DocP><strong>Inputs:</strong> ref_1 through ref_4 — upstream image URLs as references</DocP>
        <DocP><strong>Output:</strong> url — generated image</DocP>
        <DocCallout type="tip">
          Be specific about the shot. Reference images matter more than prompt for face consistency — use 2-4 photos from different angles.
        </DocCallout>

        <DocH3 id="kontext-edit">Kontext Edit</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">kontext_edit</code>
          <DocBadge>$0.04</DocBadge>
          <DocBadge color="slate">fal.ai Flux Pro Kontext Max</DocBadge>
        </div>
        <DocP>
          Edits an existing image while preserving the person&apos;s identity. Change the background, swap clothing,
          add objects, adjust lighting — the face stays the same.
        </DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "prompt", type: "string", default: "required", desc: "Edit instruction (NOT a full scene description)" },
          { name: "aspect_ratio", type: "string", default: '"9:16"', desc: "Output aspect ratio" },
        ]} />
        <DocP><strong>Inputs:</strong> image — source image to edit</DocP>
        <DocP><strong>Output:</strong> url — edited image</DocP>
        <DocCallout type="tip">
          Write edit instructions like &quot;Change background to a coffee shop&quot; not full descriptions. Great for product placement and character views.
        </DocCallout>

        <DocH3 id="nano-banana">Nano Banana 2</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">nano_banana</code>
          <DocBadge>$0.04</DocBadge>
          <DocBadge color="slate">fal.ai Nano Banana 2</DocBadge>
        </div>
        <DocP>
          Fast image generation supporting up to 14 reference images. Trades some quality for speed and broader reference support.
        </DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "prompt", type: "string", default: "required", desc: "Scene description" },
          { name: "image_urls", type: "string[]", default: "[]", desc: "Up to 14 reference image URLs" },
          { name: "aspect_ratio", type: "string", default: '"9:16"', desc: "Output aspect ratio" },
        ]} />
      </DocSection>

      {/* ── Video Generation ── */}
      <DocSection>
        <DocH2 id="video-generation">Video Generation</DocH2>

        <DocH3 id="kling-v3-pro">Kling V3 Pro</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">kling_v3_pro</code>
          <DocBadge>$0.14/sec</DocBadge>
          <DocBadge color="slate">fal.ai Kling Video V3 Pro</DocBadge>
        </div>
        <DocP>
          Generates 3-15 second video from a keyframe image. Best for character-focused scenes —
          maintains face identity throughout the clip using the elements system.
        </DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "prompt", type: "string", default: "required", desc: "Motion/action description (max 2500 chars)" },
          { name: "duration", type: "int", default: "5", desc: "Clip length in seconds (3-15)" },
          { name: "scene_id", type: "int", default: "—", desc: "Links to timeline scene" },
          { name: "cfg_scale", type: "float", default: "0.5", desc: "Guidance strength: lower = more creative, higher = more literal" },
          { name: "negative_prompt", type: "string", default: "(auto)", desc: "What to avoid in generation" },
          { name: "elements", type: "object[]", default: "[]", desc: "Character identity anchors (see below)" },
        ]} />
        <DocP><strong>Inputs:</strong> start_image (required keyframe), end_image (optional — for seamless loops)</DocP>
        <DocP><strong>Output:</strong> url — generated video</DocP>
        <DocP>Character consistency via elements:</DocP>
        <DocCodeBlock language="json">{`{
  "elements": [{
    "frontal_image_url": "character_portrait.png",
    "reference_image_urls": ["side.png", "three_quarter.png"]
  }]
}`}</DocCodeBlock>
        <DocCallout type="tip">
          Describe MOTION, not appearance — the keyframe establishes the look. &quot;Slowly turns to camera, raises eyebrow&quot;
          not &quot;handsome man in suit.&quot; 5 seconds is the sweet spot.
        </DocCallout>

        <DocH3 id="kling-o3">Kling O3</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">kling_o3</code>
          <DocBadge>$0.10/sec</DocBadge>
          <DocBadge color="slate">fal.ai Kling Video O3 Standard</DocBadge>
        </div>
        <DocP>
          Generates 3-15 second cinematic video. Optimized for environments, landscapes, and wide shots
          where character face consistency isn&apos;t the priority. 30% cheaper than V3 Pro.
        </DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "prompt", type: "string", default: "required", desc: "Scene/motion description" },
          { name: "duration", type: "int", default: "5", desc: "Clip length in seconds (3-15)" },
        ]} />

        <DocH3 id="transition">Transition</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">transition</code>
          <DocBadge>$0.14/sec</DocBadge>
        </div>
        <DocP>
          Generates a smooth morph video between two clips. Can auto-extract the last frame of clip A
          and first frame of clip B, or accept explicit frame images.
        </DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "prompt", type: "string", default: '"Smooth cinematic transition"', desc: "Transition style description" },
          { name: "duration", type: "int", default: "3", desc: "Transition length (3-15s)" },
        ]} />
        <DocP><strong>Inputs (option A):</strong> start_image + end_image — explicit frame URLs</DocP>
        <DocP><strong>Inputs (option B):</strong> from_clip + to_clip — video paths (frames auto-extracted)</DocP>
      </DocSection>

      {/* ── Transform ── */}
      <DocSection>
        <DocH2 id="transform">Transform</DocH2>

        <DocH3 id="face-swap">Face Swap</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">face_swap</code>
          <DocBadge>$0.05</DocBadge>
          <DocBadge color="slate">fal.ai Face Swap</DocBadge>
        </div>
        <DocP>
          Replaces the face in a target image with a face from a source photo. Body, pose, lighting, and background are preserved.
        </DocP>
        <DocP><strong>Inputs:</strong> source_face (the face to paste in), target_image (the image to modify)</DocP>
        <DocP><strong>Output:</strong> url — face-swapped image</DocP>
        <DocCallout type="tip">
          Chain: kontext_keyframe → face_swap → kling_v3_pro. Great for making yourself appear in AI-generated scenes.
        </DocCallout>

        <DocH3 id="upscale">Upscale</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">upscale</code>
          <DocBadge>$0.02</DocBadge>
          <DocBadge color="slate">fal.ai Real-ESRGAN</DocBadge>
        </div>
        <DocP>Enlarges an image 2x or 4x with AI-powered detail enhancement.</DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "scale", type: "int", default: "2", desc: "Upscale factor (2 or 4)" },
        ]} />

        <DocH3 id="bg-remove">Background Removal</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">bg_remove</code>
          <DocBadge>$0.02</DocBadge>
          <DocBadge color="slate">fal.ai Bria Background Removal</DocBadge>
        </div>
        <DocP>Removes the background from an image, producing a transparent PNG. Use for compositing, stickers, or preparing assets for product placement.</DocP>
      </DocSection>

      {/* ── Audio ── */}
      <DocSection>
        <DocH2 id="audio">Audio</DocH2>

        <DocH3 id="tts-minimax">MiniMax TTS</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">tts_minimax</code>
          <DocBadge>$0.06</DocBadge>
        </div>
        <DocP>Fast text-to-speech. Good default choice for narration.</DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "text", type: "string", default: "required", desc: "Speech content" },
          { name: "voice_id", type: "string", default: "—", desc: "Voice identifier" },
        ]} />

        <DocH3 id="tts-orpheus">Orpheus TTS</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">tts_orpheus</code>
          <DocBadge>$0.06</DocBadge>
        </div>
        <DocP>Voice cloning TTS. Provide a reference audio sample and it generates speech in that voice.</DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "text", type: "string", default: "required", desc: "Speech content" },
          { name: "voice_id", type: "string", default: "—", desc: "Voice identifier" },
          { name: "reference_audio", type: "string", default: "—", desc: "URL to voice sample for cloning" },
        ]} />

        <DocH3 id="tts-elevenlabs">ElevenLabs TTS</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">tts_elevenlabs</code>
          <DocBadge>$0.06</DocBadge>
        </div>
        <DocP>High-quality multilingual text-to-speech.</DocP>
      </DocSection>

      {/* ── Local Operations ── */}
      <DocSection>
        <DocH2 id="local-operations">Local Operations (Free)</DocH2>
        <DocP>These nodes run locally using ffmpeg — no API calls, no cost.</DocP>

        <DocH3 id="download">Download</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">download</code>
          <DocBadge color="emerald">Free</DocBadge>
        </div>
        <DocP>Fetches any URL to local storage. Import videos, images, or audio from the internet for remixing.</DocP>

        <DocH3 id="extract-frames">Extract Frames</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">extract_frames</code>
          <DocBadge color="emerald">Free</DocBadge>
        </div>
        <DocP>Pulls PNG frames from a video at specific timestamps. Use for face swap, thumbnails, or re-animation.</DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "timestamps", type: "float[]", default: "[0]", desc: "Seconds to extract, e.g. [0, 2.5, 5, 10]" },
        ]} />

        <DocH3 id="video-stitch">Video Stitch</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">video_stitch</code>
          <DocBadge color="emerald">Free</DocBadge>
        </div>
        <DocP>Concatenates multiple video clips into one continuous video. Inputs named clip_1, clip_2, etc.</DocP>

        <DocH3 id="ffmpeg-grade">Color Grade</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">ffmpeg_grade</code>
          <DocBadge color="emerald">Free</DocBadge>
        </div>
        <DocP>Applies color grading to a video using a named grading profile.</DocP>

        <DocH3 id="ffmpeg-overlay">Text Overlay</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">ffmpeg_overlay</code>
          <DocBadge color="emerald">Free</DocBadge>
        </div>
        <DocP>Burns text directly onto a video using ffmpeg drawtext.</DocP>
        <DocTable columns={PARAM_COLS} rows={[
          { name: "text", type: "string", default: '""', desc: "Text content to display" },
          { name: "font_size", type: "int", default: "48", desc: "Font size in pixels" },
          { name: "color", type: "string", default: '"white"', desc: "Any ffmpeg color name" },
          { name: "position", type: "string", default: '"center"', desc: '"center", "top", or "bottom"' },
        ]} />

        <DocH3 id="character-ref">Character Reference</DocH3>
        <div className="flex items-center gap-2 mb-3">
          <code className="text-sm font-mono text-cyan-400">character_ref</code>
          <DocBadge color="emerald">Free</DocBadge>
        </div>
        <DocP>
          Pass-through node that holds a character image URL. Drag images from the media gallery onto the canvas to create these automatically.
        </DocP>
      </DocSection>
    </>
  );
}
