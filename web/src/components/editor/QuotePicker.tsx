"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import type { Quote } from "@/lib/api";
import { getQuotes } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface QuotePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  philosopherId: string;
  onSelectQuote: (quote: Quote) => void;
}

const FUNCTION_TABS = [
  "all",
  "hook",
  "truth",
  "conflict",
  "loop",
] as const;

const FUNCTION_BADGE_COLORS: Record<string, string> = {
  hook: "bg-red-500/20 text-red-400 border-red-500/30",
  truth: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  conflict: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  loop: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export function QuotePicker({
  open,
  onOpenChange,
  philosopherId,
  onSelectQuote,
}: QuotePickerProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !philosopherId) return;

    setIsLoading(true);
    getQuotes({ philosopher_id: philosopherId })
      .then((data) => setQuotes(data))
      .catch(() => setQuotes([]))
      .finally(() => setIsLoading(false));
  }, [open, philosopherId]);

  const filteredQuotes = useMemo(() => {
    let result = quotes;

    if (activeTab !== "all") {
      result = result.filter((q) => q.emotional_function === activeTab);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (q) =>
          q.text.toLowerCase().includes(query) ||
          q.theme.toLowerCase().includes(query)
      );
    }

    return result;
  }, [quotes, activeTab, search]);

  function handleSelect(quote: Quote) {
    onSelectQuote(quote);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose Quote</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotes..."
            className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Filter tabs */}
        <Tabs
          defaultValue="all"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="border-slate-700">
            {FUNCTION_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="capitalize text-xs">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Quote list (shared across all tabs via filtering) */}
          {FUNCTION_TABS.map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-3">
              <QuoteList
                quotes={filteredQuotes}
                isLoading={isLoading}
                onSelect={handleSelect}
              />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function QuoteList({
  quotes,
  isLoading,
  onSelect,
}: {
  quotes: Quote[];
  isLoading: boolean;
  onSelect: (quote: Quote) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        Loading quotes...
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        No quotes found
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-[45vh] pr-1">
      {quotes.map((quote) => (
        <button
          key={quote.id}
          type="button"
          onClick={() => onSelect(quote)}
          className="w-full text-left p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-amber-500/50 hover:bg-slate-800 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 group"
        >
          <p className="text-sm text-slate-200 leading-relaxed group-hover:text-white transition-colors">
            &ldquo;{quote.text}&rdquo;
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              className={
                FUNCTION_BADGE_COLORS[quote.emotional_function] ??
                "bg-slate-500/20 text-slate-400 border-slate-500/30"
              }
            >
              {quote.emotional_function}
            </Badge>
            <span className="text-xs text-slate-500 truncate">
              {quote.theme}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
