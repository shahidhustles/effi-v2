"use client";

import { ComposerPrimitive, MessagePrimitive, ThreadPrimitive, useAuiState, useThreadViewport } from "@assistant-ui/react";
import { ArrowDownIcon, ArrowUpIcon, SparklesIcon } from "lucide-react";
import type { FC } from "react";
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

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="grid max-w-[92%] gap-1 justify-self-start">
    <div className="text-[14px] leading-relaxed text-chat-ink">
      <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
    </div>
    <AssistantThinking />
    <div className="text-[13px] text-red-700">
      <MessagePrimitive.Error>The assistant could not answer. Try again.</MessagePrimitive.Error>
    </div>
  </MessagePrimitive.Root>
);

const Composer: FC = () => (
  <ComposerPrimitive.Root className="flex w-full items-end gap-2 rounded-2xl border border-chat-border bg-chat-surface p-1.5 pl-3 shadow-sm focus-within:border-chat-action">
    <ComposerPrimitive.Input
      rows={1}
      autoFocus
      placeholder="Ask about this case..."
      className="max-h-32 min-h-8 w-full flex-1 resize-none py-1.5 text-[14px] leading-snug text-chat-ink placeholder:text-chat-muted"
    />
    <ThreadPrimitive.If running={false}>
      <ComposerPrimitive.Send className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chat-action text-white transition-colors hover:bg-chat-action-hover disabled:opacity-30">
        <ArrowUpIcon className="size-4" />
      </ComposerPrimitive.Send>
    </ThreadPrimitive.If>
    <ThreadPrimitive.If running>
      <ComposerPrimitive.Cancel className="flex size-8 shrink-0 items-center justify-center rounded-full border border-chat-border bg-chat-surface text-chat-graphite transition-colors hover:bg-chat-fog">
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
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <SparklesIcon className="size-6 text-chat-action" aria-hidden />
              <p className="font-serif text-lg text-chat-ink">Ask about this case</p>
              <p className="max-w-[26ch] text-[13px] leading-snug text-chat-graphite">
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
