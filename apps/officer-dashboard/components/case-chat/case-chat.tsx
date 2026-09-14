"use client";

import { AssistantModalPrimitive, AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { useConvexAuth, useQuery_experimental } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { ChevronDownIcon, HistoryIcon, PlusIcon, SparklesIcon } from "lucide-react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { formatRelativeTime } from "../case-inbox-state";
import { Thread } from "./thread";
import { CaseChatMemoryBar } from "./memory-bar";

type ChatSummary = { chatId: string; title: string; createdAt: number; lastMessageAt: number };
type CaseChatMessage = { messageId: string; role: "user" | "assistant"; parts: unknown[]; createdAt: number };

const listChats = makeFunctionReference<"query", { caseId: string }, ChatSummary[]>("caseChat:listChats");
const listByChat = makeFunctionReference<"query", { chatId: string }, CaseChatMessage[]>("caseChat:listByChat");

const toUIMessages = (rows: CaseChatMessage[]): UIMessage[] =>
  rows.map((row) => ({
    id: row.messageId,
    role: row.role,
    parts: row.parts as UIMessage["parts"],
    metadata: {},
  }));

const extractQueryFromChatBody = (body: string): string | undefined => {
  try {
    const parsed = JSON.parse(body) as { messages?: Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }> };
    const messages = parsed.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role !== "user") continue;
      const text = (message.parts ?? [])
        .filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text ?? "")
        .join(" ")
        .trim();
      if (text) return text;
    }
  } catch {
    // no query extractable
  }
  return undefined;
};

const createChatFetch = (initialChatId: string | null, onChatResolved: (chatId: string) => void) => {
  let currentChatId = initialChatId;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    let requestInit = init;
    const body = requestInit?.body;
    let query: string | undefined;
    if (typeof body === "string") {
      query = extractQueryFromChatBody(body);
      if (currentChatId) {
        try {
          const parsed = JSON.parse(body) as Record<string, unknown>;
          parsed.chatId = currentChatId;
          requestInit = { ...requestInit, body: JSON.stringify(parsed) };
        } catch {
          // keep the original body
        }
      }
    }
    const response = await fetch(input, requestInit);
    const created = response.headers.get("x-effi-chat-id");
    if (created && !currentChatId) {
      currentChatId = created;
      onChatResolved(created);
    }
    if ((response.headers.get("content-type") ?? "").includes("text/event-stream") && response.body) {
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      void response.body
        .pipeTo(writable)
        .then(() => window.dispatchEvent(new CustomEvent("effi-case-chat-turn-end", { detail: { query } })))
        .catch(() => {});
      return new Response(readable, response);
    }
    return response;
  };
};

type ThreadState = { key: number; chatId: string | null; live: boolean };

const CaseChatThread: FC<{
  caseId: string;
  chatId: string | null;
  initialMessages: UIMessage[];
  onChatResolved: (chatId: string) => void;
}> = ({ caseId, chatId, initialMessages, onChatResolved }) => {
  const [initial] = useState(initialMessages);
  const [initialChatId] = useState(chatId);
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/cases/chat",
        body: { caseId },
        fetch: createChatFetch(initialChatId, onChatResolved),
      }),
    [caseId, initialChatId, onChatResolved],
  );
  const runtime = useChatRuntime({ transport, messages: initial });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
};

const CaseChatModal: FC<{
  caseId: string;
  chats: ChatSummary[] | null;
  chatsError: boolean;
  thread: ThreadState;
  threadReady: boolean;
  threadMessagesError: boolean;
  threadMessages: UIMessage[];
  onChatResolved: (chatId: string) => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}> = ({ caseId, chats, chatsError, thread, threadReady, threadMessagesError, threadMessages, onChatResolved, onSelectChat, onNewChat }) => {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("effi-close-case-chat", close);
    return () => window.removeEventListener("effi-close-case-chat", close);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [menuOpen]);

  return (
    <AssistantModalPrimitive.Root open={open} onOpenChange={setOpen}>
      <AssistantModalPrimitive.Anchor className="fixed right-5 bottom-5 z-40">
        <AssistantModalPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={open ? "Close case assistant" : "Open case assistant"}
            className="flex size-12 items-center justify-center rounded-full bg-chat-action text-white shadow-lg transition-transform duration-150 ease-out hover:scale-105 hover:bg-chat-action-hover active:scale-95"
          >
            <SparklesIcon className="size-5" aria-hidden />
          </button>
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>
      <AssistantModalPrimitive.Content
        sideOffset={16}
        align="end"
        className="flex h-[520px] w-[min(400px,calc(100vw-40px))] flex-col origin-(--radix-popover-content-transform-origin) overflow-hidden rounded-3xl border border-chat-border bg-chat-canvas shadow-xl [&_input]:appearance-none [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-inherit [&_input]:shadow-none [&_input]:outline-none [&_textarea]:appearance-none [&_textarea]:resize-none [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:p-0 [&_textarea]:text-inherit [&_textarea]:shadow-none [&_textarea]:outline-none"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-chat-border bg-chat-surface px-3 py-1.5">
          <SparklesIcon className="size-3.5 text-chat-action" aria-hidden />
          <p className="font-serif text-[14px] text-chat-ink">Case assistant</p>
          <div className="relative ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                setNow(Date.now());
                setMenuOpen((value) => !value);
              }}
              aria-label="Past chats"
              aria-expanded={menuOpen}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-chat-graphite transition-colors hover:bg-chat-fog"
            >
              <HistoryIcon className="size-3.5" aria-hidden />
              <ChevronDownIcon className="size-3" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onNewChat();
              }}
              aria-label="New chat"
              className="flex items-center justify-center rounded-lg p-1.5 text-chat-graphite transition-colors hover:bg-chat-fog"
            >
              <PlusIcon className="size-4" aria-hidden />
            </button>
            {menuOpen ? (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 max-h-60 w-64 overflow-y-auto rounded-xl border border-chat-border bg-chat-surface p-1 shadow-lg">
                  {chatsError ? <p className="px-2.5 py-2 text-[12px] text-red-700">Could not load past chats.</p> : null}
                  {chats !== null && chats.length === 0 ? (
                    <p className="px-2.5 py-2 text-[12px] text-chat-muted">No past chats yet.</p>
                  ) : null}
                  {chats?.map((chat) => (
                    <button
                      key={chat.chatId}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onSelectChat(chat.chatId);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-chat-fog ${chat.chatId === thread.chatId ? "bg-chat-lavender" : ""}`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] text-chat-ink">{chat.title}</span>
                      <span className="shrink-0 text-[11px] text-chat-muted">{formatRelativeTime(chat.lastMessageAt, now)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </header>
        <CaseChatMemoryBar key={`mem-${thread.key}`} caseId={caseId} />
        <div className="min-h-0 flex-1">
          {!threadReady ? (
            threadMessagesError ? (
              <p className="p-4 text-[13px] text-red-700" role="alert">Chat history could not be loaded. Refresh the page.</p>
            ) : (
              <p className="p-4 text-[13px] text-chat-muted" role="status">Loading conversation…</p>
            )
          ) : (
            <CaseChatThread
              key={thread.key}
              caseId={caseId}
              chatId={thread.chatId}
              initialMessages={threadMessages}
              onChatResolved={onChatResolved}
            />
          )}
        </div>
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
};

export function CaseChat({ caseId }: { caseId: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const chatsResult = useQuery_experimental({ query: listChats, args: isAuthenticated && !isLoading ? { caseId } : "skip" });
  const [thread, setThread] = useState<ThreadState>({ key: 0, chatId: null, live: true });

  const messagesResult = useQuery_experimental({
    query: listByChat,
    args: thread.chatId && !thread.live ? { chatId: thread.chatId } : "skip",
  });

  const handleChatResolved = useCallback((chatId: string) => {
    setThread((current) => (current.live && current.chatId === null ? { ...current, chatId } : current));
  }, []);

  const selectChat = useCallback((chatId: string) => {
    setThread((current) => ({ key: current.key + 1, chatId, live: false }));
  }, []);

  const newChat = useCallback(() => {
    setThread((current) => ({ key: current.key + 1, chatId: null, live: true }));
  }, []);

  const messagesForThread =
    thread.chatId !== null && messagesResult.status === "success" ? toUIMessages(messagesResult.data) : null;
  const threadReady = thread.chatId === null || thread.live || messagesForThread !== null;

  return (
    <CaseChatModal
      caseId={caseId}
      chats={chatsResult.status === "success" ? chatsResult.data : null}
      chatsError={chatsResult.status === "error"}
      thread={thread}
      threadReady={threadReady}
      threadMessagesError={messagesResult.status === "error"}
      threadMessages={messagesForThread ?? []}
      onChatResolved={handleChatResolved}
      onSelectChat={selectChat}
      onNewChat={newChat}
    />
  );
}
