import { Logo } from "@/components/Logo";

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-800/50 py-6 sm:py-8 px-4 sm:px-6 starfield">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-slate-500">
        <Logo size="xs" className="sm:hidden" />
        <Logo size="sm" className="hidden sm:inline-flex" />
        <span>Open source, MIT licensed</span>
      </div>
    </footer>
  );
}
