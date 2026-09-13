"use client";

import { useConvexAuth, useQuery_experimental } from "convex/react";
import { makeFunctionReference } from "convex/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Skeleton, type BadgeTone } from "@effi/ui-web";
import { CaseActions } from "./case-actions";
import { CaseAudit } from "./case-audit";
import { EvidenceViewer } from "./evidence-viewer";
import { OfficerShell } from "./officer-shell";
import { SourceConversation } from "./source-conversation";
import type { CaseDetail } from "./case-detail-types";
import {
  caseCategoryLabels,
  caseChannelLabels,
  casePriorityLabels,
  caseStatusLabels,
  formatAbsoluteTime,
  type CasePriority,
  type CaseStatus,
} from "./case-inbox-state";

const getCase = makeFunctionReference<"query", { caseId: string }, CaseDetail>("cases:getCase");
const priorityTones: Record<CasePriority, BadgeTone> = { critical: "ink", high: "lavender", medium: "fog", low: "outline" };
const statusTones: Record<CaseStatus, BadgeTone> = { new: "violet", assigned: "lavender", under_inspection: "orchid", work_in_progress: "fog", resolved: "mint" };

function DetailSkeleton() {
  return (
    <div className="case-detail-loading" role="status" aria-live="polite">
      <span className="effi-visually-hidden">Loading case</span>
      <Skeleton className="case-detail-skeleton-title" />
      <Skeleton className="case-detail-skeleton-image" />
    </div>
  );
}

function DetailError({ message }: { message: string }) {
  const unknownCase = message.toLowerCase().includes("unknown case");
  return (
    <div className="case-detail-error">
      <p className="case-detail-kicker">Case unavailable</p>
      <h1>{unknownCase ? "This case does not exist." : "We could not load this case."}</h1>
      <p>{unknownCase ? "The case may have been removed or the link is incorrect." : message}</p>
      <Link href="/">Return to case inbox</Link>
    </div>
  );
}

function CitationList({ detail }: { detail: CaseDetail }) {
  return (
    <ol className="case-citations">
      {detail.case.citations.map((citation, index) => {
        const href = citation.kind === "transcript_message"
          ? `#message-${citation.sourceMessageId}`
          : `#evidence-${citation.attachmentId}`;
        return (
          <li key={`${citation.kind}-${index}`}>
            <a href={href}>{citation.explanation}</a>
          </li>
        );
      })}
    </ol>
  );
}

function CaseFacts({ detail }: { detail: CaseDetail }) {
  const location = detail.case.location;
  const mapQuery = encodeURIComponent(`${location.latitude},${location.longitude}`);
  const mapEmbedUrl = `https://www.google.com/maps?q=${mapQuery}&z=16&output=embed`;
  return (
    <aside className="case-brief-panel" aria-label="Confirmed case facts">
      <section>
        <p className="case-detail-kicker">Confirmed facts</p>
        <dl className="case-facts">
          <div><dt>Category</dt><dd>{caseCategoryLabels[detail.case.category]}</dd></div>
          <div><dt>Source</dt><dd>{caseChannelLabels[detail.case.channel]}</dd></div>
          <div><dt>Reported</dt><dd>{formatAbsoluteTime(detail.case.reportedAt)}</dd></div>
          <div><dt>Submitted</dt><dd>{formatAbsoluteTime(detail.case.submittedAt)}</dd></div>
        </dl>
      </section>
      <section>
        <p className="case-detail-kicker">Location</p>
        <p className="case-location-name">{location.source === "current_gps" ? "Reported GPS location" : "Selected map location"}</p>
        <p className="case-location-source">Pin captured with the citizen report</p>
        <div className="case-map-embed">
          <iframe
            src={mapEmbedUrl}
            title="Reported location on Google Maps"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
      <section>
        <p className="case-detail-kicker">Priority recommendation</p>
        <div className="case-priority-heading">
          <Badge tone={priorityTones[detail.case.recommendedPriority]}>{casePriorityLabels[detail.case.recommendedPriority]}</Badge>
          {detail.case.currentPriority !== detail.case.recommendedPriority ? <span>Current: {casePriorityLabels[detail.case.currentPriority]}</span> : null}
        </div>
        <ul className="case-priority-reasons">
          {detail.case.priorityReasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        <p className="case-detail-kicker case-citations-title">Sources</p>
        <CitationList detail={detail} />
      </section>
    </aside>
  );
}

export function CaseBrief({ caseId }: { caseId: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const result = useQuery_experimental({ query: getCase, args: isAuthenticated && !isLoading ? { caseId } : "skip" });

  let body: ReactNode;
  if (!isLoading && !isAuthenticated) body = <DetailError message="Your officer session could not be verified." />;
  else if (result.status === "error") body = <DetailError message={result.error.message} />;
  else if (result.status !== "success") body = <DetailSkeleton />;
  else {
    const detail = result.data;
    body = (
      <>
        <header className="case-detail-header">
          <div className="case-detail-title-row">
            <div>
              <p className="case-detail-report-number">{detail.case.reportNumber}</p>
              <h1>{detail.case.summary}</h1>
            </div>
            <Badge tone={statusTones[detail.case.status]}>{caseStatusLabels[detail.case.status]}</Badge>
          </div>
        </header>
        <div className="case-detail-layout">
          <div className="case-detail-main">
            <EvidenceViewer evidence={detail.case.acceptedEvidence} />
            <SourceConversation messages={detail.transcript} />
            <CaseAudit submittedAt={detail.case.submittedAt} entries={detail.audit} />
          </div>
          <div className="case-detail-side">
            <CaseActions key={`${detail.case.status}-${detail.case.currentPriority}-${detail.case.assignment?.officerName ?? "unassigned"}`} caseId={caseId} detail={detail.case} />
            <CaseFacts detail={detail} />
          </div>
        </div>
      </>
    );
  }

  return (
    <OfficerShell activeNav="cases">
    <section className="case-detail-page">
      <div className="case-detail-masthead">
        <Link className="case-detail-back" href="/">Case inbox</Link>
      </div>
      {body}
    </section>
    </OfficerShell>
  );
}
