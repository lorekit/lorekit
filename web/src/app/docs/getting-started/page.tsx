import { CodeBlock } from "@/components/ui/code-block";

export default function GettingStartedPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-white mb-4">Getting Started</h1>
        <p className="text-slate-300 leading-relaxed">
          There are two ways to use LoreKit: connect Claude via MCP (recommended for
          power users), or use the web app directly.
        </p>
      </div>

      {/* Claude Code */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Claude Code</h2>
        <p className="text-sm text-slate-400">
          Connect to the MCP endpoint on your running backend. No separate process needed.
        </p>
        <CodeBlock code="claude mcp add --transport http lorekit http://localhost:8001/mcp/mcp" />
        <p className="text-xs text-slate-500">
          Requires the backend running at localhost:8001.
        </p>
      </section>

      {/* Claude Desktop */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Claude Desktop</h2>
        <p className="text-sm text-slate-400">
          Add to your Claude Desktop config at{" "}
          <code className="text-cyan-400/70 text-xs">~/.claude/claude_desktop_config.json</code>:
        </p>
        <CodeBlock
          code={JSON.stringify(
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
          )}
        />
      </section>

      {/* Cloud mode */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Cloud (Hosted)</h2>
        <p className="text-sm text-slate-400">
          If using the hosted cloud version, connect via the cloud MCP endpoint.
          You{"'"}ll be prompted to log in via your browser automatically.
        </p>
        <CodeBlock
          code="claude mcp add --transport http lorekit https://api.lorekit.app/mcp/mcp"
        />
        <p className="text-xs text-slate-500">
          Claude will open your browser for login when it first connects. No manual token needed.
        </p>
      </section>

      {/* Web App */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Web App</h2>
        <p className="text-sm text-slate-400">
          Or skip MCP entirely and use the visual interface. Go to{" "}
          <a href="/app/universe" className="text-amber-400 hover:text-amber-300">
            /app/universe
          </a>{" "}
          to create universes, add characters, generate stories, and render videos from the browser.
        </p>
      </section>

      {/* Typical workflow */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Typical Workflow</h2>
        <p className="text-sm text-slate-400 mb-4">
          Whether you use MCP or the web app, the workflow is the same:
        </p>
        <ol className="space-y-3 text-sm text-slate-300">
          <li className="flex gap-3">
            <span className="text-amber-400 font-bold shrink-0">1.</span>
            <span><strong className="text-white">Create a universe</strong> — your story world with a name, description, and visual style.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-bold shrink-0">2.</span>
            <span><strong className="text-white">Add characters</strong> — with rich descriptions that guide visual generation.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-bold shrink-0">3.</span>
            <span><strong className="text-white">Add source items</strong> — quotes, hooks, and truths that become story material.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-bold shrink-0">4.</span>
            <span><strong className="text-white">Generate a story</strong> — the AI creates a scene-by-scene breakdown (creates a project).</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-bold shrink-0">5.</span>
            <span><strong className="text-white">Generate clips</strong> — video for each scene (poll job_status for progress).</span>
          </li>
          <li className="flex gap-3">
            <span className="text-amber-400 font-bold shrink-0">6.</span>
            <span><strong className="text-white">Render</strong> — assemble clips with audio, transitions, and color grading into the final video.</span>
          </li>
        </ol>
      </section>
    </div>
  );
}
