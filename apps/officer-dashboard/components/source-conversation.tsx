import { formatAbsoluteTime } from "./case-inbox-state";
import type { CaseTranscriptMessage, TranscriptContent } from "./case-detail-types";

function MessageBody({ content }: { content: TranscriptContent }) {
  if (content.kind === "effi_message") return <p>{content.text}</p>;
  if (content.kind === "input_request") {
    return (
      <>
        <p>{content.text}</p>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Options shown to the citizen">
          {content.options.map((option) => <span className="rounded border border-line bg-surface px-2 py-1 text-[11px] text-ink" key={option.id}>{option.label}</span>)}
        </div>
      </>
    );
  }
  return (
    <>
      {content.text ? <p>{content.text}</p> : null}
      {content.voiceTranscript ? <p><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.04em] text-muted">Voice transcript</span>{content.voiceTranscript}</p> : null}
      {content.location ? <p><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.04em] text-muted">Location</span>{content.location.latitude.toFixed(6)}, {content.location.longitude.toFixed(6)}</p> : null}
      {content.attachments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {content.attachments.map((attachment) => (
            <span className="rounded border border-line bg-surface px-2 py-1 text-[11px] text-ink" key={attachment.attachmentId}>{attachment.accepted ? "Accepted image" : "Attachment"}</span>
          ))}
        </div>
      ) : null}
      {content.action ? <p className="text-xs capitalize text-muted">Action: {content.action}</p> : null}
    </>
  );
}

function ConversationMessage({ message }: { message: CaseTranscriptMessage }) {
  const speaker = message.direction === "citizen" ? "Citizen" : "Effi";
  return (
    <li id={`message-${message.sourceMessageId}`} className={`grid scroll-mt-24 grid-cols-1 gap-2.5 px-[18px] py-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-7 sm:px-[26px] sm:py-6 ${message.direction === "citizen" ? "bg-lavender/50" : "bg-surface"}`}>
      <div className="grid content-start gap-1 max-sm:grid-cols-[auto_1fr] max-sm:items-baseline max-sm:gap-3">
        <strong className="font-display text-[13px] text-ink">{speaker}</strong>
        <time className="font-display text-[11px] leading-snug text-graphite" dateTime={new Date(message.occurredAt).toISOString()}>{formatAbsoluteTime(message.occurredAt)}</time>
      </div>
      <div className="font-display text-[13px] leading-relaxed text-ink [&_p]:whitespace-pre-wrap [&_p+p]:mt-2.5"><MessageBody content={message.content} /></div>
    </li>
  );
}

export function SourceConversation({ messages }: { messages: readonly CaseTranscriptMessage[] }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-surface" aria-labelledby="conversation-title">
      <div className="flex min-h-[82px] items-end justify-between gap-6 border-b border-line p-[18px] sm:min-h-[92px] sm:px-[26px] sm:py-[22px]">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-graphite">Original conversation</p>
          <h2 className="text-xl font-semibold tracking-[-0.015em] text-ink" id="conversation-title">Citizen and Effi</h2>
        </div>
        <span className="font-display text-xs text-graphite">{messages.length} messages</span>
      </div>
      <ol className="divide-y divide-line">
        {messages.map((message) => <ConversationMessage key={message.sourceMessageId} message={message} />)}
      </ol>
    </section>
  );
}
