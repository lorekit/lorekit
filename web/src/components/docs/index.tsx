import { cn } from "@/lib/utils";
import { Copy, Check, Info, AlertTriangle, Lightbulb } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  DocHeading — h1/h2/h3 with anchor links                           */
/* ------------------------------------------------------------------ */

export function DocH1({ children, id }: { children: React.ReactNode; id?: string }) {
  const slug = id || slugify(children);
  return (
    <h1 id={slug} className="text-3xl font-bold text-white mb-3 scroll-mt-20">
      {children}
    </h1>
  );
}

export function DocH2({ children, id }: { children: React.ReactNode; id?: string }) {
  const slug = id || slugify(children);
  return (
    <h2 id={slug} className="text-xl font-semibold text-white mt-12 mb-4 scroll-mt-20 group">
      <a href={`#${slug}`} className="hover:text-amber-400 transition-colors">
        {children}
        <span className="text-slate-600 opacity-0 group-hover:opacity-100 ml-2 transition-opacity">#</span>
      </a>
    </h2>
  );
}

export function DocH3({ children, id }: { children: React.ReactNode; id?: string }) {
  const slug = id || slugify(children);
  return (
    <h3 id={slug} className="text-base font-semibold text-white mt-8 mb-3 scroll-mt-20">
      {children}
    </h3>
  );
}

function slugify(children: React.ReactNode): string {
  return String(children).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ------------------------------------------------------------------ */
/*  DocP / DocLead — paragraph text                                    */
/* ------------------------------------------------------------------ */

export function DocLead({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-300 leading-relaxed text-base mb-6">{children}</p>;
}

export function DocP({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 leading-relaxed mb-4">{children}</p>;
}

/* ------------------------------------------------------------------ */
/*  DocCode — inline code                                              */
/* ------------------------------------------------------------------ */

export function DocCode({ children }: { children: React.ReactNode }) {
  return <code className="text-[13px] font-mono text-cyan-400/80 bg-slate-800/50 px-1.5 py-0.5 rounded">{children}</code>;
}

/* ------------------------------------------------------------------ */
/*  DocCodeBlock — fenced code with language label + copy              */
/* ------------------------------------------------------------------ */

export function DocCodeBlock({ children, language }: { children: string; language?: string }) {
  return (
    <div className="relative group rounded-xl border border-slate-800 bg-slate-950 mb-4 overflow-hidden">
      {language && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50 bg-slate-900/50">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{language}</span>
          <CopyButton text={children} />
        </div>
      )}
      {!language && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={children} />
        </div>
      )}
      <pre className="px-4 py-3 overflow-x-auto">
        <code className="text-sm font-mono text-slate-300 whitespace-pre">{children}</code>
      </pre>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        const btn = document.activeElement as HTMLButtonElement;
        btn?.blur();
      }}
      className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
      title="Copy"
    >
      <Copy className="w-3.5 h-3.5" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  DocTable — parameter / reference tables                            */
/* ------------------------------------------------------------------ */

interface DocTableColumn {
  key: string;
  label: string;
  mono?: boolean;
  accent?: boolean;
}

interface DocTableProps {
  columns: DocTableColumn[];
  rows: Record<string, string>[];
}

export function DocTable({ columns, rows }: DocTableProps) {
  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden mb-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-900/50 border-b border-slate-800/50">
            {columns.map((col) => (
              <th key={col.key} className="text-left px-4 py-2.5 text-slate-500 font-medium uppercase tracking-wider text-[10px]">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/30">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-2",
                    col.mono && "font-mono",
                    col.accent ? "text-cyan-400/80" : "text-slate-400",
                  )}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DocCallout — info / warning / tip boxes                            */
/* ------------------------------------------------------------------ */

const CALLOUT_STYLES = {
  info: { icon: Info, border: "border-blue-500/30", bg: "bg-blue-500/5", text: "text-blue-400", label: "Info" },
  warning: { icon: AlertTriangle, border: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-400", label: "Warning" },
  tip: { icon: Lightbulb, border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-400", label: "Tip" },
};

export function DocCallout({ type = "info", children }: { type?: "info" | "warning" | "tip"; children: React.ReactNode }) {
  const s = CALLOUT_STYLES[type];
  const Icon = s.icon;
  return (
    <div className={cn("rounded-xl border px-4 py-3 mb-4 flex gap-3", s.border, s.bg)}>
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", s.text)} />
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DocCard — link card for overview pages                             */
/* ------------------------------------------------------------------ */

export function DocCard({ href, title, description, icon: Icon }: {
  href: string;
  title: string;
  description: string;
  icon?: React.ElementType;
}) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 hover:bg-slate-900 transition-colors group"
    >
      {Icon && <Icon className="w-5 h-5 text-amber-400 mb-3" />}
      <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-amber-400 transition-colors">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  DocSection — consistent vertical spacing                           */
/* ------------------------------------------------------------------ */

export function DocSection({ children }: { children: React.ReactNode }) {
  return <section className="mb-12">{children}</section>;
}

/* ------------------------------------------------------------------ */
/*  DocBadge — small inline labels                                     */
/* ------------------------------------------------------------------ */

export function DocBadge({ children, color = "amber" }: { children: React.ReactNode; color?: "amber" | "cyan" | "emerald" | "slate" }) {
  const colors = {
    amber: "text-amber-400 bg-amber-500/10",
    cyan: "text-cyan-400 bg-cyan-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    slate: "text-slate-400 bg-slate-500/10",
  };
  return (
    <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded", colors[color])}>
      {children}
    </span>
  );
}
