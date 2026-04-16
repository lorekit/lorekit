"use client";

import { useState } from "react";
import { Terminal, Monitor } from "lucide-react";
import { CodeBlock } from "@/components/ui/code-block";
import { isCloudMode, getMcpHttpUrl } from "@/lib/mode";

type Tab = "claude-code" | "claude-desktop";

export function McpInstructions() {
  const [tab, setTab] = useState<Tab>("claude-code");
  const cloud = isCloudMode();
  const mcpUrl = getMcpHttpUrl();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">MCP Connection Setup</h3>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("claude-code")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "claude-code"
              ? "bg-slate-800 text-white border border-slate-700"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Terminal className="h-4 w-4" />
          Claude Code
        </button>
        <button
          onClick={() => setTab("claude-desktop")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "claude-desktop"
              ? "bg-slate-800 text-white border border-slate-700"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Monitor className="h-4 w-4" />
          Claude Desktop
        </button>
      </div>

      {/* Claude Code */}
      {tab === "claude-code" && (
        <div className="space-y-4">
          {!cloud ? (
            <div>
              <p className="text-sm text-slate-400 mb-2">
                Connect to the MCP endpoint on your running backend:
              </p>
              <CodeBlock code={`claude mcp add --transport http lorekit ${mcpUrl}`} />
              <p className="text-xs text-slate-500 mt-1.5">
                Requires the backend to be running at localhost:8001.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-400 mb-2">
                Connect to the LoreKit cloud MCP endpoint:
              </p>
              <CodeBlock
                code={`claude mcp add --transport http lorekit ${mcpUrl}`}
              />
              <p className="text-xs text-slate-500 mt-1.5">
                You'll be prompted to log in via your browser when Claude first connects.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Claude Desktop */}
      {tab === "claude-desktop" && (
        <div className="space-y-4">
          {!cloud ? (
            <div>
              <p className="text-sm text-slate-400 mb-2">
                Add to your Claude Desktop config (<code className="text-cyan-400/70">~/.claude/claude_desktop_config.json</code>):
              </p>
              <CodeBlock
                code={JSON.stringify(
                  {
                    mcpServers: {
                      lorekit: {
                        type: "streamable-http",
                        url: mcpUrl,
                      },
                    },
                  },
                  null,
                  2
                )}
              />
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-400 mb-2">
                Add to your Claude Desktop config (<code className="text-cyan-400/70">~/.claude/claude_desktop_config.json</code>):
              </p>
              <CodeBlock
                code={JSON.stringify(
                  {
                    mcpServers: {
                      lorekit: {
                        type: "streamable-http",
                        url: mcpUrl,
                      },
                    },
                  },
                  null,
                  2
                )}
              />
              <p className="text-xs text-slate-500 mt-1.5">
                You'll be prompted to log in via your browser when Claude first connects.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
