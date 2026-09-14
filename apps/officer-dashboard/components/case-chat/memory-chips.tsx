"use client";

import { BrainIcon, XIcon } from "lucide-react";
import type { FC } from "react";

export type MemoryChip = {
  id: string;
  text: string;
  change: "added" | "updated" | "existing";
};

export const MemoryChips: FC<{
  chips: readonly MemoryChip[];
  onForget: (id: string) => void;
  className?: string;
}> = ({ chips, onForget, className }) => {
  const freshCount = chips.filter((chip) => chip.change !== "existing").length;

  return (
    <div data-slot="memory-chips" className={`flex items-center gap-2 px-3 py-1.5 ${className ?? ""}`}>
      <div className="flex shrink-0 items-center gap-1.5 text-chat-muted">
        <BrainIcon className="size-3.5" aria-hidden />
        <span className="font-mono text-[10px] uppercase tracking-wide">{freshCount > 0 ? `remembered ${freshCount}` : "memory"}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
        {chips.map((chip) => (
          <span
            key={chip.id}
            className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 transition-[opacity,transform] duration-300 ${
              chip.change === "existing"
                ? "border-chat-border bg-chat-fog text-chat-graphite"
                : "border-chat-action/25 bg-chat-lavender text-chat-action"
            }`}
          >
            <span className="truncate">{chip.text}</span>
            <button
              type="button"
              aria-label={`Forget "${chip.text}"`}
              onClick={() => onForget(chip.id)}
              className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-chat-border"
            >
              <XIcon className="size-2.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};
