import type { ReactNode } from "react";
import type { CaseAuditEntry } from "./case-detail-types";
import { casePriorityLabels, caseStatusLabels, formatAbsoluteTime } from "./case-inbox-state";

function AuditDescription({ entry }: { entry: CaseAuditEntry }): ReactNode {
  const event = entry.event;
  switch (event.kind) {
    case "case_assigned":
      return <p>Assigned the case to {entry.actorName}</p>;
    case "priority_changed":
      return <p>Changed priority from {casePriorityLabels[event.from]} to {casePriorityLabels[event.to]}</p>;
    case "status_changed":
      return <p>Moved the case from {caseStatusLabels[event.from]} to {caseStatusLabels[event.to]}</p>;
    case "case_resolved":
      return (
        <>
          <p>Resolved the case</p>
          <blockquote>{event.resolutionNote}</blockquote>
        </>
      );
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}

export function CaseAudit({ submittedAt, entries }: { submittedAt: number; entries: readonly CaseAuditEntry[] }) {
  return (
    <section className="case-detail-section" aria-labelledby="audit-title">
      <div className="case-detail-section-heading">
        <div>
          <p className="case-detail-kicker">Audit history</p>
          <h2 id="audit-title">What changed</h2>
        </div>
        <span>{entries.length + 1} {entries.length === 0 ? "event" : "events"}</span>
      </div>
      <ol className="case-audit-list">
        <li>
          <span className="case-audit-marker" aria-hidden="true" />
          <div className="case-audit-copy">
            <p>Case registered</p>
            <span>Effi</span>
          </div>
          <time dateTime={new Date(submittedAt).toISOString()}>{formatAbsoluteTime(submittedAt)}</time>
        </li>
        {entries.map((entry) => (
          <li key={entry.eventId}>
            <span className="case-audit-marker" aria-hidden="true" />
            <div className="case-audit-copy">
              <AuditDescription entry={entry} />
              <span>{entry.actorName}</span>
            </div>
            <time dateTime={new Date(entry.occurredAt).toISOString()}>{formatAbsoluteTime(entry.occurredAt)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
