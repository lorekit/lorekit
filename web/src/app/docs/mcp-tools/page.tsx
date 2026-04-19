import { MCP_TOOL_CATEGORIES, TOTAL_TOOLS } from "@/lib/mcp-tools";
import { DocH1, DocH2, DocLead, DocSection, DocCode } from "@/components/docs";

export default function McpToolsPage() {
  return (
    <>
      <DocH1>MCP Tools Reference</DocH1>
      <DocLead>
        LoreKit exposes {TOTAL_TOOLS} tools via MCP, organized across{" "}
        {MCP_TOOL_CATEGORIES.length} categories. All tool names are prefixed
        with <DocCode>lorekit_</DocCode>.
      </DocLead>

      {MCP_TOOL_CATEGORIES.map((category) => (
        <DocSection key={category.name}>
          <DocH2 id={category.name.toLowerCase().replace(/\s+/g, "-")}>
            {category.name}
            <span className="text-slate-500 ml-2 text-sm normal-case tracking-normal font-normal">
              ({category.tools.length} tools)
            </span>
          </DocH2>
          <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/30">
            {category.tools.map((tool) => (
              <div key={tool.name} className="flex items-baseline gap-4 px-4 py-3">
                <code className="text-sm font-mono text-cyan-400 shrink-0">
                  {tool.name}
                </code>
                <span className="text-sm text-slate-400">{tool.description}</span>
              </div>
            ))}
          </div>
        </DocSection>
      ))}
    </>
  );
}
