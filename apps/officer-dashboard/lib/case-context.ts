import type { CaseDetail, TranscriptContent } from "../components/case-detail-types";

const formatTime = (epochMs: number) => new Date(epochMs).toISOString().replace("T", " ").slice(0, 16) + " UTC";

const transcriptLine = (content: TranscriptContent): string => {
  if (content.kind === "effi_message") return content.text;
  if (content.kind === "input_request") {
    const options = content.options.map((option) => option.label).join(" | ");
    return `${content.text} (asked: "${content.prompt}"${options ? `; options: ${options}` : ""}${content.allowFreeform ? "; free text allowed" : ""})`;
  }
  const text = content.text ?? content.voiceTranscript ?? "(no text)";
  const extras: string[] = [];
  if (content.action) extras.push(`action: ${content.action}`);
  if (content.location) extras.push(`location: ${content.location.latitude},${content.location.longitude}`);
  if (content.attachments.length) {
    extras.push(
      `attachments: ${content.attachments.map((attachment) => `${attachment.attachmentId} (${attachment.mediaType}${attachment.accepted ? ", accepted" : ", not accepted"})`).join(", ")}`,
    );
  }
  return extras.length ? `${text} [${extras.join("; ")}]` : text;
};

export const buildCaseContext = (detail: CaseDetail): string => {
  const { case: c, transcript, audit } = detail;
  const facts = [
    `Report number: ${c.reportNumber}`,
    `Summary: ${c.summary}`,
    `Category: ${c.category}`,
    `Channel: ${c.channel}`,
    `Status: ${c.status}`,
    `Assignment: ${c.assignment ? c.assignment.officerName : "unassigned"}`,
    `Location: ${c.location.source === "current_gps" ? "reported GPS" : "selected pin"} at ${c.location.latitude}, ${c.location.longitude}`,
    `Reported at: ${formatTime(c.reportedAt)}`,
    `Submitted at: ${formatTime(c.submittedAt)}`,
    `Recommended priority: ${c.recommendedPriority}`,
    `Current priority: ${c.currentPriority}`,
    `Priority reasons: ${c.priorityReasons.join("; ") || "none"}`,
  ].join("\n");

  const transcriptBlock = transcript.length
    ? transcript
        .map((message) => {
          const who = message.direction === "citizen" ? "citizen" : "Effi (assistant)";
          return `[message-${message.sourceMessageId}] ${who} at ${formatTime(message.occurredAt)}: ${transcriptLine(message.content)}`;
        })
        .join("\n")
    : "(no transcript messages)";

  const evidenceBlock = c.acceptedEvidence.length
    ? c.acceptedEvidence
        .map((evidence) => `[evidence-${evidence.attachmentId}] ${evidence.mediaType} attached to [message-${evidence.sourceMessageId}]${evidence.url ? " (viewable image on page)" : ""}`)
        .join("\n")
    : "(no accepted evidence)";

  const auditBlock = audit.length
    ? audit
        .map((entry) => `- ${formatTime(entry.occurredAt)} ${entry.actorName}: ${entry.event.kind}`)
        .join("\n")
    : "(no audit events)";

  const citationBlock = c.citations.length
    ? c.citations
        .map((citation) =>
          citation.kind === "transcript_message"
            ? `- ${citation.explanation} -> [message-${citation.sourceMessageId}]`
            : `- ${citation.explanation} -> [evidence-${citation.attachmentId}]`,
        )
        .join("\n")
    : "(none)";

  return [
    "CASE DATA (the only source of truth for your answers):",
    "",
    "## Facts",
    facts,
    "",
    "## Citizen conversation transcript",
    transcriptBlock,
    "",
    "## Accepted evidence",
    evidenceBlock,
    "",
    "## Case audit trail",
    auditBlock,
    "",
    "## Triage citations",
    citationBlock,
  ].join("\n");
};

export const buildSystemInstructions = (detail: CaseDetail): string =>
  [
    "You are Effi's case assistant embedded in a municipal officer dashboard. You help the officer understand and act on the case currently open on their screen.",
    "",
    "Strict rules:",
    "1. Answer ONLY from the case data below. If something is not in the case data, say you do not have that information in this case. Never speculate, never use outside knowledge about the location or incident.",
    "2. Always cite your sources. Use markdown links pointing at the on-page anchors: [transcript](#message-ID) for transcript messages and [evidence](#evidence-ID) for attachments. Only use IDs that appear in the case data.",
    "3. Never fabricate IDs, quotes, or details. Quote the transcript sparingly and exactly.",
    "4. You cannot change the case. If the officer asks to assign, prioritize, advance status, or resolve, tell them to use the case controls on the page.",
    "5. Keep answers concise and factual.",
    "",
    buildCaseContext(detail),
  ].join("\n");
