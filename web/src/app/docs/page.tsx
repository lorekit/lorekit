import { Terminal, Globe, BookOpen, Server, Boxes } from "lucide-react";
import { TOTAL_TOOLS } from "@/lib/mcp-tools";
import { DocH1, DocH2, DocLead, DocP, DocCard, DocSection } from "@/components/docs";

export default function DocsOverviewPage() {
  return (
    <>
      <DocH1>LoreKit Documentation</DocH1>
      <DocLead>
        LoreKit is an open-source AI video generation platform. Create story worlds
        with characters, source material, and visual environments — then generate
        scene-by-scene video content using AI.
      </DocLead>

      <DocSection>
        <DocH2>How it works</DocH2>
        <div className="space-y-5">
          {[
            { step: "1", title: "Build your universe", desc: "A universe is a story world. Add characters with rich descriptions, upload source material (quotes, texts, documents), and define visual environments (color grades, fonts, styling)." },
            { step: "2", title: "Generate a story", desc: "Pick a character and source items, then generate a story. The AI creates a scene-by-scene breakdown with visual descriptions, camera angles, text overlays, and timing." },
            { step: "3", title: "Produce the video", desc: "Build a workflow pipeline on the canvas — connect keyframe generators to video generators to stitching nodes. Execute the workflow and the AI produces each clip. Reorder clips on the timeline and render the final video." },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <span className="text-sm font-bold text-amber-400">{item.step}</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">{item.title}</h3>
                <DocP>{item.desc}</DocP>
              </div>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection>
        <DocH2>Documentation</DocH2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DocCard
            href="/docs/getting-started"
            icon={Terminal}
            title="Getting Started"
            description="Connect Claude via MCP or use the web app. Setup instructions for Claude Code, Claude Desktop, and the HTTP endpoint."
          />
          <DocCard
            href="/docs/mcp-tools"
            icon={BookOpen}
            title="MCP Tools Reference"
            description={`${TOTAL_TOOLS} tools across 12 categories — universes, characters, generation, scenes, and more.`}
          />
          <DocCard
            href="/docs/nodes"
            icon={Boxes}
            title="Workflow Nodes"
            description="19 node types for image generation, video creation, face swap, audio, and local ffmpeg operations."
          />
          <DocCard
            href="/docs/self-hosting"
            icon={Server}
            title="Self-Hosting Guide"
            description="Run LoreKit locally with your own API keys. Prerequisites, setup, and database configuration."
          />
          <DocCard
            href="/app"
            icon={Globe}
            title="Open the App"
            description="Jump straight into creating universes, characters, and videos."
          />
        </div>
      </DocSection>
    </>
  );
}
