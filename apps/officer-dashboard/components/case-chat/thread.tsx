"use client";

import { ComposerPrimitive, MessagePrimitive, ThreadPrimitive, useAuiState, useThreadViewport } from "@assistant-ui/react";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon } from "lucide-react";
import { useMemo, type FC } from "react";
import { parseMemoryContext } from "../../lib/case-chat-message";
import { MarkdownText } from "./markdown-text";
import { ThinkingIndicator } from "./thinking-indicator";

const UserMessage: FC = () => (
  <MessagePrimitive.Root className="flex justify-end">
    <div className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-chat-action px-3.5 py-2 text-[14px] leading-snug text-white">
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

const AssistantThinking: FC = () => {
  const label = useAuiState((s) => {
    if (s.message.status?.type !== "running") return undefined;
    return s.message.parts.length === 0 ? "Effi is reading the case…" : undefined;
  });
  if (label === undefined) return null;
  return <ThinkingIndicator label={label} className="mt-1" />;
};

const MemoryDisclosure: FC = () => {
  const rawMemoryContext = useAuiState((s) => s.message.metadata.custom?.memoryContext);
  const memories = useMemo(() => parseMemoryContext(rawMemoryContext), [rawMemoryContext]);
  if (memories.length === 0) return null;

  return (
    <details className="group/memory mt-1 w-fit max-w-full text-[11px] text-chat-muted">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-chat-fog hover:text-chat-graphite focus-visible:outline-2 focus-visible:outline-chat-action [&::-webkit-details-marker]:hidden">
        <span>Used {memories.length} {memories.length === 1 ? "memory" : "memories"}</span>
        <ChevronDownIcon className="size-3 transition-transform duration-150 group-open/memory:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <ul className="mt-1.5 grid max-w-[32ch] gap-1.5 rounded-lg border border-chat-border bg-chat-surface p-2.5 shadow-sm">
        {memories.map((memory) => (
          <li className="grid gap-0.5" key={`${memory.scope}-${memory.id}`}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-chat-muted">{memory.scope === "case" ? "This case" : "About you"}</span>
            <span className="leading-relaxed text-chat-graphite">{memory.text}</span>
          </li>
        ))}
      </ul>
    </details>
  );
};

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="grid max-w-[92%] gap-1 justify-self-start">
    <div className="text-[14px] leading-relaxed text-chat-ink">
      <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
    </div>
    <AssistantThinking />
    <MemoryDisclosure />
    <div className="text-[13px] text-red-700">
      <MessagePrimitive.Error>The assistant could not answer. Try again.</MessagePrimitive.Error>
    </div>
  </MessagePrimitive.Root>
);

const Composer: FC = () => (
  <ComposerPrimitive.Root className="flex w-full items-end gap-2 rounded-2xl border border-chat-border bg-chat-surface p-1.5 pl-3 shadow-sm transition-[border-color,box-shadow] duration-150 focus-within:border-chat-action focus-within:shadow-[0_0_0_3px_rgb(23_79_136/0.1)] motion-reduce:transition-none">
    <ComposerPrimitive.Input
      rows={1}
      autoFocus
      placeholder="Ask about this case..."
      className="max-h-32 min-h-8 w-full flex-1 resize-none py-1.5 text-[14px] leading-snug text-chat-ink placeholder:text-chat-muted"
    />
    <ThreadPrimitive.If running={false}>
      <ComposerPrimitive.Send aria-label="Send message" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chat-action text-white transition-[background-color,transform] duration-150 hover:bg-chat-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chat-action active:scale-[0.94] disabled:opacity-30 motion-reduce:transition-none">
        <ArrowUpIcon className="size-4" />
      </ComposerPrimitive.Send>
    </ThreadPrimitive.If>
    <ThreadPrimitive.If running>
      <ComposerPrimitive.Cancel aria-label="Stop response" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-chat-border bg-chat-surface text-chat-graphite transition-[background-color,transform] duration-150 hover:bg-chat-fog focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chat-action active:scale-[0.94] motion-reduce:transition-none">
        <span className="block size-2.5 rounded-[2px] bg-current" aria-hidden />
      </ComposerPrimitive.Cancel>
    </ThreadPrimitive.If>
  </ComposerPrimitive.Root>
);

export function Thread() {
  const isAtBottom = useThreadViewport((s) => s.isAtBottom);
  return (
    <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col overflow-hidden bg-chat-canvas">
      <div className="relative min-h-0 flex-1">
        <ThreadPrimitive.Viewport className="absolute inset-0 overflow-y-auto">
          <ThreadPrimitive.If empty>
            <div className="flex h-full flex-col justify-end px-5 pb-5">
              <p className="max-w-[14ch] font-serif text-[26px] font-medium leading-[1.05] tracking-[-0.025em] text-chat-ink">What do you need to know?</p>
              <p className="mt-2 max-w-[34ch] text-[13px] leading-relaxed text-chat-graphite">
                Answers come only from the facts, transcript, and evidence already on this page.
              </p>
            </div>
          </ThreadPrimitive.If>
          <div className="flex flex-col gap-3 px-4 pb-2 pt-4">
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
          </div>
        </ThreadPrimitive.Viewport>
        {!isAtBottom ? (
          <ThreadPrimitive.ScrollToBottom asChild>
            <button
              type="button"
              aria-label="Scroll to latest message"
              className="absolute bottom-3 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-chat-border bg-chat-surface text-chat-graphite shadow-md transition-colors hover:bg-chat-fog"
            >
              <ArrowDownIcon className="size-4" />
            </button>
          </ThreadPrimitive.ScrollToBottom>
        ) : null}
      </div>
      <div className="border-t border-chat-border bg-chat-surface px-3 py-2.5">
        <Composer />
      </div>
    </ThreadPrimitive.Root>
  );
}
