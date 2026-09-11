import { formatAbsoluteTime } from "./case-inbox-state";
import type { CaseTranscriptMessage, TranscriptContent } from "./case-detail-types";

function MessageBody({ content }: { content: TranscriptContent }) {
  if (content.kind === "effi_message") return <p>{content.text}</p>;
  if (content.kind === "input_request") {
    return (
      <>
        <p>{content.text}</p>
        <div className="case-transcript-options" aria-label="Options shown to the citizen">
          {content.options.map((option) => <span key={option.id}>{option.label}</span>)}
        </div>
      </>
    );
  }
  return (
    <>
      {content.text ? <p>{content.text}</p> : null}
      {content.voiceTranscript ? <p><span className="case-transcript-label">Voice transcript</span>{content.voiceTranscript}</p> : null}
      {content.location ? <p><span className="case-transcript-label">Location</span>{content.location.latitude.toFixed(6)}, {content.location.longitude.toFixed(6)}</p> : null}
      {content.attachments.length > 0 ? (
        <div className="case-transcript-attachments">
          {content.attachments.map((attachment) => (
            <span key={attachment.attachmentId}>{attachment.accepted ? "Accepted image" : "Attachment"}</span>
          ))}
        </div>
      ) : null}
      {content.action ? <p className="case-transcript-action">Action: {content.action}</p> : null}
    </>
  );
}

function ConversationMessage({ message }: { message: CaseTranscriptMessage }) {
  const speaker = message.direction === "citizen" ? "Citizen" : "Effi";
  return (
    <li id={`message-${message.sourceMessageId}`} className={`case-transcript-message is-${message.direction}`}>
      <div className="case-transcript-meta">
        <strong>{speaker}</strong>
        <time dateTime={new Date(message.occurredAt).toISOString()}>{formatAbsoluteTime(message.occurredAt)}</time>
      </div>
      <div className="case-transcript-body"><MessageBody content={message.content} /></div>
    </li>
  );
}

export function SourceConversation({ messages }: { messages: readonly CaseTranscriptMessage[] }) {
  return (
    <section className="case-detail-section" aria-labelledby="conversation-title">
      <div className="case-detail-section-heading">
        <div>
          <p className="case-detail-kicker">Original conversation</p>
          <h2 id="conversation-title">Citizen and Effi</h2>
        </div>
        <span>{messages.length} messages</span>
      </div>
      <ol className="case-transcript">
        {messages.map((message) => <ConversationMessage key={message.sourceMessageId} message={message} />)}
      </ol>
    </section>
  );
}
