"use client";

import { ChevronDownIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState, type FC } from "react";
import { MemoryChips, type MemoryChip } from "./memory-chips";

type MemoryRow = { id: string; text: string; updatedAt: string | null };
type MemoryPayload = { memories: MemoryRow[]; all: { case: MemoryRow[]; officer: MemoryRow[] }; enabled: boolean };

const shortLabel = (text: string): string => {
  const clean = text.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  const words = clean.split(" ");
  return words.length > 4 ? `${words.slice(0, 4).join(" ")}…` : clean;
};

const toChips = (rows: MemoryRow[]): MemoryChip[] =>
  rows.slice(0, 3).map((row) => ({ id: row.id, text: shortLabel(row.text), change: "existing" as const }));

export const CaseChatMemoryBar: FC<{ caseId: string }> = ({ caseId }) => {
  const [chips, setChips] = useState<MemoryChip[]>([]);
  const [all, setAll] = useState<{ case: MemoryRow[]; officer: MemoryRow[] } | null>(null);
  const [allError, setAllError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadRelevant = useCallback(async (query: string) => {
    try {
      const response = await fetch(`/api/cases/memory?caseId=${encodeURIComponent(caseId)}&q=${encodeURIComponent(query)}`);
      if (!response.ok) return;
      const data = (await response.json()) as MemoryPayload;
      if (!data.enabled) return;
      setChips(toChips(data.memories));
    } catch {
      // keep whatever is currently rendered
    }
  }, [caseId]);

  const loadAll = useCallback(async () => {
    setAllError(false);
    try {
      const response = await fetch(`/api/cases/memory?caseId=${encodeURIComponent(caseId)}`);
      if (!response.ok) {
        setAllError(true);
        return;
      }
      const data = (await response.json()) as MemoryPayload;
      if (!data.enabled) {
        setAll({ case: [], officer: [] });
        return;
      }
      setAll(data.all);
    } catch {
      setAllError(true);
    }
  }, [caseId]);

  useEffect(() => {
    const onTurnEnd = (event: Event) => {
      const query = (event as CustomEvent<{ query?: string }>).detail?.query;
      if (query) void loadRelevant(query);
    };
    window.addEventListener("effi-case-chat-turn-end", onTurnEnd);
    return () => window.removeEventListener("effi-case-chat-turn-end", onTurnEnd);
  }, [loadRelevant]);

  const forget = useCallback((id: string) => {
    setChips((current) => current.filter((chip) => chip.id !== id));
    setAll((current) =>
      current
        ? { case: current.case.filter((row) => row.id !== id), officer: current.officer.filter((row) => row.id !== id) }
        : current,
    );
    void fetch("/api/cases/memory", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memoryId: id }),
    }).catch(() => {});
  }, []);

  const memoryRows = (rows: MemoryRow[]) =>
    rows.map((row) => (
      <div key={row.id} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-chat-fog">
        <span className="min-w-0 flex-1 text-[12px] leading-4 text-chat-ink">{row.text}</span>
        <button
          type="button"
          aria-label={`Forget "${row.text}"`}
          onClick={() => forget(row.id)}
          className="shrink-0 rounded-full p-1 text-chat-muted transition-colors hover:bg-chat-border hover:text-chat-ink"
        >
          <XIcon className="size-3" aria-hidden />
        </button>
      </div>
    ));

  return (
    <div className="relative shrink-0 border-b border-chat-border bg-chat-surface">
      <div className="flex items-center gap-1 px-2 py-1">
        <MemoryChips chips={chips} onForget={forget} className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={() => {
            if (!menuOpen) void loadAll();
            setMenuOpen((value) => !value);
          }}
          aria-label="All memories"
          aria-expanded={menuOpen}
          className="shrink-0 rounded-lg p-1 text-chat-muted transition-colors hover:bg-chat-fog hover:text-chat-graphite"
        >
          <ChevronDownIcon className="size-3.5" aria-hidden />
        </button>
      </div>
      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-full z-50 mt-1 max-h-56 w-72 overflow-y-auto rounded-xl border border-chat-border bg-chat-surface p-1 shadow-lg">
            {allError ? <p className="px-2.5 py-2 text-[12px] text-red-700">Could not load memories.</p> : null}
            {all !== null && !allError && all.case.length === 0 && all.officer.length === 0 ? (
              <p className="px-2.5 py-2 text-[12px] text-chat-muted">No memories yet.</p>
            ) : null}
            {all?.case.length ? (
              <div>
                <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wide text-chat-muted">This case</p>
                {memoryRows(all.case)}
              </div>
            ) : null}
            {all?.officer.length ? (
              <div>
                <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wide text-chat-muted">About you</p>
                {memoryRows(all.officer)}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};
