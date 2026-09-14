"use client";

import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import type { ComponentPropsWithoutRef } from "react";

const isCitationHref = (href: string | undefined): boolean =>
  Boolean(href && (href.startsWith("#message-") || href.startsWith("#evidence-")));

function CitationAnchor({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  if (!isCitationHref(href)) return <a href={href} {...props}>{children}</a>;
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("effi-close-case-chat"));
        document.getElementById(href!.slice(1))?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      {...props}
    >
      {children}
    </a>
  );
}

export function MarkdownText() {
  return <MarkdownTextPrimitive className="grid gap-2 [&_a]:text-chat-action [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-chat-action-hover [&_blockquote]:rounded-lg [&_blockquote]:bg-chat-fog [&_blockquote]:px-3 [&_blockquote]:py-2.5 [&_blockquote]:text-chat-graphite [&_code]:rounded [&_code]:bg-chat-fog [&_code]:px-1 [&_code]:py-px [&_code]:text-[0.9em] [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-1 [&_ol]:pl-[18px] [&_p]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-chat-border [&_pre]:bg-chat-surface [&_pre]:px-3 [&_pre]:py-2.5 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1 [&_ul]:pl-[18px]" components={{ a: CitationAnchor }} />;
}
