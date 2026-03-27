"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// --- Dialog Root ---

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  if (!open) return null;

  return <>{children}</>;
}

// --- DialogContent ---

export interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

function DialogContent({ children, className }: DialogContentProps) {
  // Walk up to find the Dialog's onOpenChange via a nested context
  return (
    <DialogContentInner className={className}>{children}</DialogContentInner>
  );
}

// We use a context to pass onOpenChange down without requiring it as a prop on DialogContent
interface DialogContextValue {
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

// Re-export Dialog with context provider
function DialogWithContext({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ onOpenChange }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </DialogContext.Provider>
  );
}

function DialogContentInner({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(DialogContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Focus trap: focus the content on mount
  React.useEffect(() => {
    contentRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => context?.onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "relative z-50 w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 focus-visible:outline-none",
          className
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => context?.onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {children}
      </div>
    </div>
  );
}

// --- DialogHeader ---

export interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-1.5 mb-4", className)}>
      {children}
    </div>
  );
}

// --- DialogTitle ---

export interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-white",
        className
      )}
    >
      {children}
    </h2>
  );
}

// --- DialogDescription ---

export interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

function DialogDescription({ children, className }: DialogDescriptionProps) {
  return (
    <p className={cn("text-sm text-slate-400", className)}>{children}</p>
  );
}

export {
  DialogWithContext as Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
};
