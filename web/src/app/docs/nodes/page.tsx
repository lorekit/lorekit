const NODES = [
  {
    category: "Image Generation",
    nodes: [
      {
        type: "kontext_keyframe",
        label: "Kontext Keyframe",
        cost: "$0.04",
        api: "fal.ai Flux Pro Kontext Max Multi",
        description: "Generates a high-quality image from a text prompt and up to 4 reference photos. The primary way to create character-consistent keyframes that serve as the starting frame for video generation.",
        params: [
          { name: "prompt", type: "string", default: "required", desc: "Detailed scene description: character pose, expression, setting, lighting" },
          { name: "reference_images", type: "string[]", default: "[]", desc: "Up to 4 image URLs that anchor the character's appearance" },
          { name: "aspect_ratio", type: "string", default: '"9:16"', desc: '"9:16" (portrait/mobile) or "16:9" (landscape)' },
          { name: "scene_id", type: "int", default: "—", desc: "Links this node to a timeline scene" },
        ],
        inputs: "ref_1 through ref_4 — upstream image URLs as references",
        output: "url — generated image",
        tips: "Be specific about the shot. Reference images matter more than prompt for face consistency — use 2-4 photos from different angles.",
      },
      {
        type: "kontext_edit",
        label: "Kontext Edit",
        cost: "$0.04",
        api: "fal.ai Flux Pro Kontext Max",
        description: "Edits an existing image while preserving the person's identity. Change the background, swap clothing, add objects, adjust lighting — the face stays the same.",
        params: [
          { name: "prompt", type: "string", default: "required", desc: "Edit instruction (NOT a full scene description)" },
          { name: "aspect_ratio", type: "string", default: '"9:16"', desc: "Output aspect ratio" },
        ],
        inputs: "image — source image to edit",
        output: "url — edited image",
        tips: 'Write edit instructions like "Change background to a coffee shop" not full descriptions. Great for product placement and character views.',
      },
      {
        type: "nano_banana",
        label: "Nano Banana 2",
        cost: "$0.04",
        api: "fal.ai Nano Banana 2",
        description: "Fast image generation supporting up to 14 reference images. Trades some quality for speed and broader reference support.",
        params: [
          { name: "prompt", type: "string", default: "required", desc: "Scene description" },
          { name: "image_urls", type: "string[]", default: "[]", desc: "Up to 14 reference image URLs" },
          { name: "aspect_ratio", type: "string", default: '"9:16"', desc: "Output aspect ratio" },
        ],
        inputs: "—",
        output: "url — generated image",
        tips: "Use when you need more than 4 references or want faster generation than Kontext.",
      },
    ],
  },
  {
    category: "Video Generation",
    nodes: [
      {
        type: "kling_v3_pro",
        label: "Kling V3 Pro",
        cost: "$0.14/sec",
        api: "fal.ai Kling Video V3 Pro",
        description: "Generates 3-15 second video from a keyframe image. The best model for character-focused scenes — maintains face identity throughout the clip using the elements system.",
        params: [
          { name: "prompt", type: "string", default: "required", desc: "Motion/action description (max 2500 chars)" },
          { name: "duration", type: "int", default: "5", desc: "Clip length in seconds (3-15)" },
          { name: "scene_id", type: "int", default: "—", desc: "Links to timeline scene" },
          { name: "cfg_scale", type: "float", default: "0.5", desc: "Guidance strength: lower = more creative, higher = more literal" },
          { name: "negative_prompt", type: "string", default: "(auto)", desc: "What to avoid in generation" },
          { name: "elements", type: "object[]", default: "[]", desc: "Character identity anchors (see below)" },
        ],
        inputs: "start_image (required keyframe), end_image (optional — for seamless loops)",
        output: "url — generated video",
        tips: 'Describe MOTION, not appearance — the keyframe establishes the look. "Slowly turns to camera, raises eyebrow" not "handsome man in suit." Use elements for face consistency. 5 seconds is the sweet spot.',
      },
      {
        type: "kling_o3",
        label: "Kling O3",
        cost: "$0.10/sec",
        api: "fal.ai Kling Video O3 Standard",
        description: "Generates 3-15 second cinematic video. Optimized for environments, landscapes, and wide shots where character face consistency isn't the priority.",
        params: [
          { name: "prompt", type: "string", default: "required", desc: "Scene/motion description" },
          { name: "duration", type: "int", default: "5", desc: "Clip length in seconds (3-15)" },
        ],
        inputs: "image_url or start_image (keyframe), end_image (optional)",
        output: "url — generated video",
        tips: "Use for establishing shots, b-roll, nature footage, architecture. 30% cheaper than V3 Pro.",
      },
      {
        type: "transition",
        label: "Transition",
        cost: "$0.14/sec",
        api: "fal.ai Kling Video V3 Pro",
        description: "Generates a smooth morph video between two clips. Can auto-extract the last frame of clip A and first frame of clip B.",
        params: [
          { name: "prompt", type: "string", default: '"Smooth cinematic transition"', desc: "Transition style description" },
          { name: "duration", type: "int", default: "3", desc: "Transition length (3-15s)" },
        ],
        inputs: "start_image + end_image (preferred), OR from_clip + to_clip (frames auto-extracted)",
        output: "url — transition video",
        tips: '3-5 seconds works best. Prompt controls the style: "Camera sweeps right", "Dissolve through smoke".',
      },
    ],
  },
  {
    category: "Transform",
    nodes: [
      {
        type: "face_swap",
        label: "Face Swap",
        cost: "$0.05",
        api: "fal.ai Face Swap",
        description: "Replaces the face in a target image with a face from a source photo. The body, pose, lighting, and background of the target are preserved.",
        params: [],
        inputs: "source_face (the face to paste in), target_image (the image to modify)",
        output: "url — face-swapped image",
        tips: "Chain: kontext_keyframe \u2192 face_swap \u2192 kling_v3_pro. Great for making yourself appear in AI-generated scenes.",
      },
      {
        type: "upscale",
        label: "Upscale (Real-ESRGAN)",
        cost: "$0.02",
        api: "fal.ai Real-ESRGAN",
        description: "Enlarges an image 2x or 4x with AI-powered detail enhancement.",
        params: [
          { name: "scale", type: "int", default: "2", desc: "Upscale factor (2 or 4)" },
        ],
        inputs: "image — image to upscale",
        output: "url — upscaled image",
        tips: "4x on a 512px image gives 2048px. Use before final render for higher quality.",
      },
      {
        type: "bg_remove",
        label: "Background Removal",
        cost: "$0.02",
        api: "fal.ai Bria Background Removal",
        description: "Removes the background from an image, producing a transparent PNG.",
        params: [],
        inputs: "image — image to process",
        output: "url — transparent PNG",
        tips: "Use for compositing, stickers, or preparing assets for kontext_edit product placement.",
      },
    ],
  },
  {
    category: "Audio",
    nodes: [
      {
        type: "tts_minimax",
        label: "MiniMax TTS",
        cost: "$0.06",
        api: "fal.ai MiniMax Speech 2.6 Turbo",
        description: "Fast text-to-speech. Good default choice for narration.",
        params: [
          { name: "text", type: "string", default: "required", desc: "Speech content" },
          { name: "voice_id", type: "string", default: "—", desc: "Voice identifier" },
        ],
        inputs: "—",
        output: "url — audio file",
        tips: "",
      },
      {
        type: "tts_orpheus",
        label: "Orpheus TTS",
        cost: "$0.06",
        api: "fal.ai Orpheus TTS",
        description: "Voice cloning TTS. Provide a reference audio sample and it generates speech in that voice.",
        params: [
          { name: "text", type: "string", default: "required", desc: "Speech content" },
          { name: "voice_id", type: "string", default: "—", desc: "Voice identifier" },
          { name: "reference_audio", type: "string", default: "—", desc: "URL to voice sample for cloning" },
        ],
        inputs: "—",
        output: "url — audio file",
        tips: "Use when you need a specific voice — clone a client's voice or match a character's persona.",
      },
      {
        type: "tts_elevenlabs",
        label: "ElevenLabs TTS",
        cost: "$0.06",
        api: "fal.ai ElevenLabs Multilingual v2",
        description: "High-quality multilingual text-to-speech.",
        params: [
          { name: "text", type: "string", default: "required", desc: "Speech content" },
          { name: "voice_id", type: "string", default: "—", desc: "Voice identifier" },
        ],
        inputs: "—",
        output: "url — audio file",
        tips: "",
      },
    ],
  },
  {
    category: "Local Operations (Free)",
    nodes: [
      {
        type: "download",
        label: "Download",
        cost: "Free",
        api: "—",
        description: "Fetches any URL to local storage. Import videos, images, or audio from the internet.",
        params: [
          { name: "dest_path", type: "string", default: "(auto)", desc: "Storage location" },
        ],
        inputs: "url — any HTTP URL",
        output: "path (local file), url (original)",
        tips: "Use to import content from YouTube, social media, or any URL for remixing.",
      },
      {
        type: "extract_frames",
        label: "Extract Frames",
        cost: "Free",
        api: "ffmpeg",
        description: "Pulls PNG frames from a video at specific timestamps.",
        params: [
          { name: "timestamps", type: "float[]", default: "[0]", desc: "List of seconds to extract, e.g. [0, 2.5, 5, 10]" },
        ],
        inputs: "video_path — local video file",
        output: "frames — list of PNG paths",
        tips: "Pull frames for face swap, create thumbnails, or extract key moments for re-animation.",
      },
      {
        type: "video_stitch",
        label: "Video Stitch",
        cost: "Free",
        api: "ffmpeg concat",
        description: "Concatenates multiple video clips into one continuous video.",
        params: [],
        inputs: "clip_1, clip_2, clip_3, ... — video URLs or paths. Can include transition_1_2 between clips.",
        output: "path — stitched video",
        tips: "Final assembly step. Clips are ordered by input key name.",
      },
      {
        type: "ffmpeg_grade",
        label: "Color Grade",
        cost: "Free",
        api: "ffmpeg",
        description: "Applies color grading to a video using a named grading profile.",
        params: [
          { name: "environment_key", type: "string", default: '""', desc: "Grading profile name" },
        ],
        inputs: "video — video path",
        output: "path — graded video",
        tips: "",
      },
      {
        type: "ffmpeg_overlay",
        label: "Text Overlay",
        cost: "Free",
        api: "ffmpeg drawtext",
        description: "Burns text directly onto a video.",
        params: [
          { name: "text", type: "string", default: '""', desc: "Text content to display" },
          { name: "font_size", type: "int", default: "48", desc: "Font size in pixels" },
          { name: "color", type: "string", default: '"white"', desc: "Font color (any ffmpeg color name)" },
          { name: "position", type: "string", default: '"center"', desc: '"center", "top", or "bottom"' },
        ],
        inputs: "video — video path",
        output: "path — video with text",
        tips: "Use for CTAs, watermarks, captions, branded text.",
      },
      {
        type: "character_ref",
        label: "Character Reference",
        cost: "Free",
        api: "—",
        description: "Pass-through node that holds a character image URL. Other nodes connect to it to reference the character's portrait.",
        params: [
          { name: "image_url", type: "string", default: "required", desc: "Character portrait path or URL" },
        ],
        inputs: "—",
        output: "url — same image",
        tips: "Drag images from the media gallery onto the canvas to create these automatically.",
      },
    ],
  },
];

const PIPELINES = [
  { name: "UGC Ad (single clip)", flow: "character_ref \u2192 kontext_keyframe \u2192 kling_v3_pro" },
  { name: "Multi-Scene Video", flow: "character_ref \u2192 keyframe \u00d7 N \u2192 clip \u00d7 N \u2192 video_stitch" },
  { name: "Clone Yourself", flow: "kontext_keyframe \u2192 face_swap (your photo) \u2192 kling_v3_pro" },
  { name: "Product Placement", flow: 'kontext_keyframe \u2192 kontext_edit ("Add product") \u2192 kling_v3_pro \u2192 ffmpeg_overlay' },
  { name: "Import & Remix", flow: "download \u2192 extract_frames \u2192 face_swap \u2192 kling_v3_pro \u2192 video_stitch" },
  { name: "Upscale + BG Swap", flow: "kontext_keyframe \u2192 bg_remove \u2192 kontext_edit \u2192 upscale" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Image Generation": "text-blue-400",
  "Video Generation": "text-purple-400",
  "Transform": "text-amber-400",
  "Audio": "text-emerald-400",
  "Local Operations (Free)": "text-orange-400",
};

export default function NodesDocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-white mb-4">Workflow Nodes</h1>
        <p className="text-slate-300 leading-relaxed">
          LoreKit&apos;s node-based workflow system lets you build AI video pipelines by connecting nodes.
          Each node is a single operation — generating an image, creating a video, swapping a face,
          stitching clips together. Connect outputs to inputs to build any pipeline.
        </p>
      </div>

      {/* Pipeline Examples */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-amber-400 font-semibold mb-4">
          Pipeline Examples
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PIPELINES.map((p) => (
            <div key={p.name} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <p className="text-sm font-medium text-white mb-1">{p.name}</p>
              <p className="text-xs text-slate-400 font-mono">{p.flow}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Node Reference */}
      {NODES.map((category) => (
        <section key={category.category}>
          <h2 className={`text-xs uppercase tracking-wide font-semibold mb-6 ${CATEGORY_COLORS[category.category] || "text-slate-400"}`}>
            {category.category}
            <span className="text-slate-500 ml-2 normal-case tracking-normal font-normal">
              ({category.nodes.length} nodes)
            </span>
          </h2>

          <div className="space-y-6">
            {category.nodes.map((node) => (
              <div key={node.type} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                {/* Header */}
                <div className="flex items-baseline justify-between px-5 py-4 border-b border-slate-800/50">
                  <div>
                    <code className="text-sm font-mono text-cyan-400">{node.type}</code>
                    <span className="text-sm text-slate-400 ml-3">{node.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{node.api}</span>
                    <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{node.cost}</span>
                  </div>
                </div>

                <div className="px-5 py-4 space-y-4">
                  <p className="text-sm text-slate-300">{node.description}</p>

                  {/* Params */}
                  {node.params.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Parameters</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th className="pb-1 pr-4 font-medium">Name</th>
                            <th className="pb-1 pr-4 font-medium">Type</th>
                            <th className="pb-1 pr-4 font-medium">Default</th>
                            <th className="pb-1 font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-400">
                          {node.params.map((p) => (
                            <tr key={p.name} className="border-t border-slate-800/30">
                              <td className="py-1.5 pr-4 font-mono text-cyan-400/70">{p.name}</td>
                              <td className="py-1.5 pr-4 text-slate-500">{p.type}</td>
                              <td className="py-1.5 pr-4 font-mono text-slate-500">{p.default}</td>
                              <td className="py-1.5">{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Inputs / Output */}
                  <div className="flex gap-8 text-xs">
                    {node.inputs !== "—" && (
                      <div>
                        <span className="text-slate-500 uppercase tracking-wide">Inputs: </span>
                        <span className="text-slate-400">{node.inputs}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 uppercase tracking-wide">Output: </span>
                      <span className="text-slate-400">{node.output}</span>
                    </div>
                  </div>

                  {/* Tips */}
                  {node.tips && (
                    <p className="text-xs text-slate-500 italic border-l-2 border-slate-700 pl-3">
                      {node.tips}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
