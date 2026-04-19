import { DocH1, DocH2, DocLead, DocP, DocSection, DocCodeBlock, DocCallout } from "@/components/docs";

export default function GettingStartedPage() {
  return (
    <>
      <DocH1>Getting Started</DocH1>
      <DocLead>
        There are two ways to use LoreKit: connect Claude via MCP (recommended for
        power users), or use the web app directly.
      </DocLead>

      <DocSection>
        <DocH2>Claude Code</DocH2>
        <DocP>
          Connect to the MCP endpoint on your running backend. No separate process needed.
        </DocP>
        <DocCodeBlock language="bash">{`claude mcp add --transport http lorekit http://localhost:8001/mcp/mcp`}</DocCodeBlock>
        <DocP>Requires the backend running at localhost:8001.</DocP>
      </DocSection>

      <DocSection>
        <DocH2>Claude Desktop</DocH2>
        <DocP>
          Add to your Claude Desktop config at{" "}
          <code className="text-cyan-400/70 text-xs bg-slate-800/50 px-1.5 py-0.5 rounded">~/.claude/claude_desktop_config.json</code>:
        </DocP>
        <DocCodeBlock language="json">{JSON.stringify(
          {
            mcpServers: {
              lorekit: {
                type: "streamable-http",
                url: "http://localhost:8001/mcp/mcp",
              },
            },
          },
          null,
          2
        )}</DocCodeBlock>
      </DocSection>

      <DocSection>
        <DocH2>Cloud (Hosted)</DocH2>
        <DocP>
          If using the hosted cloud version, connect via the cloud MCP endpoint.
          You&apos;ll be prompted to log in via your browser automatically.
        </DocP>
        <DocCodeBlock language="bash">{`claude mcp add --transport http lorekit https://api.lorekit.app/mcp/mcp`}</DocCodeBlock>
        <DocCallout type="info">
          Claude will open your browser for login when it first connects. No manual token needed.
        </DocCallout>
      </DocSection>

      <DocSection>
        <DocH2>Web App</DocH2>
        <DocP>
          Or skip MCP entirely and use the visual interface. Go to{" "}
          <a href="/app/universe" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
            /app/universe
          </a>{" "}
          to create universes, add characters, generate stories, and render videos from the browser.
        </DocP>
      </DocSection>

      <DocSection>
        <DocH2>Typical Workflow</DocH2>
        <DocP>Whether you use MCP or the web app, the workflow is the same:</DocP>
        <div className="space-y-4 mt-4">
          {[
            { step: "1", title: "Create a universe", desc: "Your story world with a name, description, and visual style." },
            { step: "2", title: "Add characters", desc: "With rich descriptions that guide visual generation." },
            { step: "3", title: "Add source items", desc: "Quotes, hooks, and truths that become story material." },
            { step: "4", title: "Generate a story", desc: "The AI creates a scene-by-scene breakdown (creates a project)." },
            { step: "5", title: "Build workflow", desc: "Add keyframe and clip nodes to the canvas. Connect them. Execute the pipeline." },
            { step: "6", title: "Render", desc: "Assemble clips with audio, transitions, and color grading into the final video." },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-amber-400">{item.step}</span>
              </div>
              <div>
                <p className="text-sm text-white font-medium">{item.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </DocSection>
    </>
  );
}
