"use client";

import { AssistantModalPrimitive, AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { useConvexAuth, useQuery_experimental } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { BotIcon, ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { parseCaseChatMessageMetadata, type CaseChatMessageMetadata } from "../../lib/case-chat-message";
import { formatRelativeTime } from "../case-inbox-state";
import { Thread } from "./thread";

type ChatSummary = { chatId: string; title: string; createdAt: number; lastMessageAt: number };
type CaseChatMessage = { messageId: string; role: "user" | "assistant"; parts: unknown[]; metadata?: unknown; createdAt: number };

const listChats = makeFunctionReference<"query", { caseId: string }, ChatSummary[]>("caseChat:listChats");
const listByChat = makeFunctionReference<"query", { chatId: string }, CaseChatMessage[]>("caseChat:listByChat");

const toUIMessages = (rows: CaseChatMessage[]): UIMessage<CaseChatMessageMetadata>[] =>
  rows.map((row) => ({
    id: row.messageId,
    role: row.role,
    parts: row.parts as UIMessage["parts"],
    metadata: parseCaseChatMessageMetadata(row.metadata),
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
  const [launcherEngaged, setLauncherEngaged] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!menuOpen) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [menuOpen]);

  const activeChatTitle = thread.chatId === null
    ? "New Chat"
    : chats?.find((chat) => chat.chatId === thread.chatId)?.title ?? "Conversation";

  return (
    <AssistantModalPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setLauncherEngaged(true);
      }}
    >
      <AssistantModalPrimitive.Anchor className="group fixed right-5 bottom-5 z-40">
        {!open ? (
          <div
            className="pointer-events-none absolute bottom-full right-0 mb-3 w-max max-w-[min(260px,calc(100vw-40px))] translate-y-1 rounded-lg bg-chat-ink px-3 py-2 text-[12px] font-medium leading-snug text-white opacity-0 shadow-lg transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transition-none"
            id="case-assistant-tooltip"
            role="tooltip"
          >
            Need help with this case? I am here.
          </div>
        ) : null}
        <AssistantModalPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={open ? "Close case assistant" : "Open case assistant"}
            aria-describedby={!open ? "case-assistant-tooltip" : undefined}
            className="grid size-12 place-items-center rounded-full bg-chat-action text-white shadow-lg transition-[background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-105 hover:bg-chat-action-hover hover:shadow-xl focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-chat-action active:scale-[0.96] motion-reduce:transition-none"
          >
            <span className="col-start-1 row-start-1 grid place-items-center">
              <BotIcon
                className={`size-5 transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${open ? "scale-90 opacity-0" : `scale-100 opacity-100 ${launcherEngaged ? "" : "case-assistant-nudge"}`}`}
                aria-hidden
              />
            </span>
            <XIcon className={`col-start-1 row-start-1 size-5 transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${open ? "scale-100 opacity-100" : "scale-90 opacity-0"}`} aria-hidden />
          </button>
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>
      <AssistantModalPrimitive.Content
        sideOffset={16}
        align="end"
        className="flex h-[520px] w-[min(400px,calc(100vw-40px))] origin-(--radix-popover-content-transform-origin) flex-col overflow-hidden rounded-3xl border border-chat-border bg-chat-canvas shadow-xl transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-[state=closed]:scale-[0.97] data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100 motion-reduce:transition-none [&_input]:appearance-none [&_input]:border-0 [&_input]:bg-transparent [&_input]:text-inherit [&_input]:shadow-none [&_input]:outline-none [&_textarea]:appearance-none [&_textarea]:resize-none [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:p-0 [&_textarea]:text-inherit [&_textarea]:shadow-none [&_textarea]:outline-none"
      >
        <header className="flex min-h-12 shrink-0 items-center gap-2 border-b border-chat-border bg-chat-surface px-2.5 py-1.5">
          <div className="relative min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                setNow(Date.now());
                setMenuOpen((value) => !value);
              }}
              aria-label="Choose conversation"
              aria-expanded={menuOpen}
              className="flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-chat-ink transition-colors duration-150 hover:bg-chat-fog focus-visible:outline-2 focus-visible:outline-chat-action active:scale-[0.98] motion-reduce:transition-none"
            >
              <span className="truncate font-serif text-[15px] font-medium">{activeChatTitle}</span>
              <ChevronDownIcon className={`size-3.5 shrink-0 text-chat-muted transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {menuOpen ? (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-[min(320px,calc(100vw-64px))] overflow-y-auto rounded-xl border border-chat-border bg-chat-surface p-1.5 shadow-lg">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-chat-muted">Past conversations</p>
                  {chatsError ? <p className="px-2 py-2 text-[12px] text-red-700">Could not load past chats.</p> : null}
                  {chats === null && !chatsError ? <p className="px-2 py-2 text-[12px] text-chat-muted">Loading chats...</p> : null}
                  {chats !== null && chats.length === 0 ? <p className="px-2 py-2 text-[12px] text-chat-muted">No past chats yet.</p> : null}
                  {chats?.map((chat) => (
                    <button
                      key={chat.chatId}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onSelectChat(chat.chatId);
                      }}
                      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors duration-150 hover:bg-chat-fog focus-visible:outline-2 focus-visible:outline-chat-action active:scale-[0.99] motion-reduce:transition-none ${chat.chatId === thread.chatId ? "bg-chat-lavender" : ""}`}
                    >
                      <span className="truncate text-[13px] font-medium text-chat-ink">{chat.title}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-chat-muted">{formatRelativeTime(chat.lastMessageAt, now)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onNewChat();
              }}
              aria-label="New chat"
              className="flex size-8 items-center justify-center rounded-lg text-chat-graphite transition-colors duration-150 hover:bg-chat-fog hover:text-chat-ink focus-visible:outline-2 focus-visible:outline-chat-action active:scale-[0.96] motion-reduce:transition-none"
            >
              <PlusIcon className="size-4" aria-hidden />
            </button>
          </div>
        </header>
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
