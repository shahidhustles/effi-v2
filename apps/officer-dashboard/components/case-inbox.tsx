"use client";

import { UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery_experimental } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Button, Skeleton, type BadgeTone } from "@effi/ui-web";
import {
  caseCategoryLabels,
  caseChannelLabels,
  casePriorities,
  casePriorityLabels,
  caseStatuses,
  caseStatusLabels,
  countWorkload,
  filterCases,
  formatAbsoluteTime,
  formatRelativeTime,
  sortCases,
  type CasePriority,
  type CaseStatus,
  type CaseSummary,
  type InboxFilters,
  type InboxSort,
} from "./case-inbox-state";

const listCases = makeFunctionReference<"query", Record<string, never>, CaseSummary[]>("cases:listCases");

const priorityTones: Record<CasePriority, BadgeTone> = { critical: "ink", high: "lavender", medium: "fog", low: "outline" };
const statusTones: Record<CaseStatus, BadgeTone> = { new: "violet", assigned: "lavender", under_inspection: "orchid", work_in_progress: "fog", resolved: "mint" };

const caseCountLabel = (count: number) => `${count} ${count === 1 ? "case" : "cases"}`;

function FilterChips<Value extends string>({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: readonly { value: Value; label: string }[];
  selected: readonly Value[];
  onToggle: (value: Value) => void;
  onClear: () => void;
}) {
  return (
    <div className="effi-filter-group" role="group" aria-label={label}>
      <span className="effi-filter-label" aria-hidden="true">{label}</span>
      <div className="effi-filter-options">
        <button type="button" className="effi-filter-chip" aria-pressed={selected.length === 0} onClick={onClear}>All</button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="effi-filter-chip"
            aria-pressed={selected.includes(option.value)}
            onClick={() => onToggle(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="effi-stat">
      <strong className="effi-stat-value">{value}</strong>
      <p className="effi-stat-label">{label}</p>
    </div>
  );
}

function CaseRow({ entry, now, onOpen }: { entry: CaseSummary; now: number; onOpen: (entry: CaseSummary) => void }) {
  return (
    <li>
      <button type="button" className="effi-case-row" onClick={() => onOpen(entry)} aria-label={`Open ${entry.reportNumber}: ${entry.summary}`}>
        <div className="effi-case-priority">
          <span className="effi-cell-label">Priority</span>
          <Badge tone={priorityTones[entry.currentPriority]}>{casePriorityLabels[entry.currentPriority]}</Badge>
        </div>
        <div className="effi-case-main">
          <span className="effi-cell-label">Case</span>
          <h2 className="effi-case-summary">{entry.summary}</h2>
          <p className="effi-case-meta">
            <span>{caseCategoryLabels[entry.category]}</span>
            <span>{entry.reportNumber}</span>
            <span>{caseChannelLabels[entry.channel]}</span>
          </p>
        </div>
        <div className="effi-case-side">
          <span className="effi-cell-label">Status</span>
          <Badge tone={statusTones[entry.status]}>{caseStatusLabels[entry.status]}</Badge>
          <time className="effi-case-time" dateTime={new Date(entry.submittedAt).toISOString()} title={formatAbsoluteTime(entry.submittedAt)}>
            {formatRelativeTime(entry.submittedAt, now)}
          </time>
        </div>
        <span className="effi-open-case" aria-hidden="true">Open</span>
      </button>
    </li>
  );
}

function CasePreview({ entry, onClose }: { entry: CaseSummary; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="effi-case-preview"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        dialogRef.current?.close();
      }}
      aria-labelledby="case-preview-title"
    >
      <div className="effi-case-preview-header">
        <div>
          <p>{entry.reportNumber}</p>
          <h2 id="case-preview-title">{entry.summary}</h2>
        </div>
        <button type="button" className="effi-case-preview-close" onClick={() => dialogRef.current?.close()} autoFocus>
          Close
        </button>
      </div>
      <dl className="effi-case-preview-details">
        <div><dt>Priority</dt><dd><Badge tone={priorityTones[entry.currentPriority]}>{casePriorityLabels[entry.currentPriority]}</Badge></dd></div>
        <div><dt>Status</dt><dd><Badge tone={statusTones[entry.status]}>{caseStatusLabels[entry.status]}</Badge></dd></div>
        <div><dt>Category</dt><dd>{caseCategoryLabels[entry.category]}</dd></div>
        <div><dt>Source</dt><dd>{caseChannelLabels[entry.channel]}</dd></div>
        <div><dt>Reported</dt><dd><time dateTime={new Date(entry.reportedAt).toISOString()}>{formatAbsoluteTime(entry.reportedAt)}</time></dd></div>
        <div><dt>Submitted</dt><dd><time dateTime={new Date(entry.submittedAt).toISOString()}>{formatAbsoluteTime(entry.submittedAt)}</time></dd></div>
      </dl>
      <p className="effi-case-preview-note">Evidence, location, and the original conversation will appear in the full case detail view.</p>
    </dialog>
  );
}

function InboxState({
  title,
  message,
  tone,
  detail,
  action,
}: {
  title: string;
  message: string;
  tone?: "error";
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`effi-state${tone === "error" ? " is-error" : ""}`}>
      <h2>{title}</h2>
      <p>{message}</p>
      {detail ? <p className="effi-state-detail">{detail}</p> : null}
      {action}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="effi-overview" aria-hidden="true">
      <div className="effi-stats">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="effi-stat">
            <Skeleton className="effi-skeleton-value" />
            <Skeleton className="effi-skeleton-label" />
          </div>
        ))}
      </div>
      <div className="effi-filters effi-filters-skeleton">
        {[4, 3].map((count) => (
          <div key={count} className="effi-filter-group">
            <Skeleton className="effi-skeleton-filter-label" />
            <div className="effi-filter-options">
              {Array.from({ length: count }, (_, index) => (
                <Skeleton key={index} className="effi-skeleton-filter-chip" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="effi-case-toolbar">
        <Skeleton className="effi-skeleton-result" />
        <Skeleton className="effi-skeleton-sort" />
      </div>
      <div className="effi-case-columns">
        <span>Priority</span>
        <span>Case</span>
        <span>Status</span>
        <span>Action</span>
      </div>
      <ul className="effi-case-list">
        {[0, 1, 2].map((index) => (
          <li key={index}>
            <div className="effi-case-row">
              <div className="effi-case-priority"><Skeleton className="effi-skeleton-badge" /></div>
              <div className="effi-case-main">
                <Skeleton className="effi-skeleton-summary" />
                <Skeleton className="effi-skeleton-meta" />
              </div>
              <div className="effi-case-side">
                <Skeleton className="effi-skeleton-badge" />
              </div>
              <Skeleton className="effi-skeleton-open" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CaseInbox() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const result = useQuery_experimental({ query: listCases, args: isAuthenticated && !isLoading ? {} : "skip" });
  const [statuses, setStatuses] = useState<CaseStatus[]>([]);
  const [priorities, setPriorities] = useState<CasePriority[]>([]);
  const [sort, setSort] = useState<InboxSort>("newest");
  const [selectedCase, setSelectedCase] = useState<CaseSummary | null>(null);

  const cases = result.status === "success" ? result.data : null;
  const filters = useMemo<InboxFilters>(() => ({ statuses, priorities }), [statuses, priorities]);
  const visibleCases = useMemo(() => (cases ? sortCases(filterCases(cases, filters), sort) : []), [cases, filters, sort]);

  const toggleStatus = (status: CaseStatus) => {
    setStatuses((current) => current.includes(status) ? current.filter((value) => value !== status) : [...current, status]);
  };

  const togglePriority = (priority: CasePriority) => {
    setPriorities((current) => current.includes(priority) ? current.filter((value) => value !== priority) : [...current, priority]);
  };

  const clearFilters = () => {
    setStatuses([]);
    setPriorities([]);
  };

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  let body: ReactNode;

  if (!isLoading && !isAuthenticated) {
    body = (
      <InboxState
        title="We could not verify your officer session"
        message="Sign out and sign in again. If it keeps failing, check that Convex accepts the Clerk token."
        tone="error"
      />
    );
  } else if (result.status === "error") {
    const denied = result.error.message.toLowerCase().includes("officer");
    body = denied ? (
      <InboxState
        title="This account is not an officer"
        message="Ask an Effi admin to grant the officer role, then reload this page."
      />
    ) : (
      <InboxState
        title="We could not load the case inbox"
        message="The connection to Convex dropped or the query failed. Retry the page, and check the Convex deployment if it keeps failing."
        tone="error"
        detail={result.error.message}
      />
    );
  } else if (cases === null) {
    body = (
      <div role="status" aria-live="polite">
        <span className="effi-visually-hidden">Loading cases</span>
        <StatsSkeleton />
        <div className="effi-case-column"><ListSkeleton /></div>
      </div>
    );
  } else if (cases.length === 0) {
    body = (
      <InboxState
        title="New reports land here"
        message="When a citizen confirms a report in Telegram or WhatsApp, Effi creates the case and it appears in this inbox in real time."
      />
    );
  } else {
    const counts = countWorkload(cases);
    body = (
      <>
        <section className="effi-overview" aria-labelledby="workload-title">
          <h2 id="workload-title" className="effi-visually-hidden">Workload and filters</h2>
          <div className="effi-stats">
            <StatTile label="Open cases" value={counts.open} />
            <StatTile label="New" value={counts.fresh} />
            <StatTile label="Needs attention" value={counts.urgent} />
            <StatTile label="Resolved" value={counts.resolved} />
          </div>
          <div className="effi-filters">
            <FilterChips
              label="Status"
              options={caseStatuses.map((status) => ({ value: status, label: caseStatusLabels[status] }))}
              selected={statuses}
              onToggle={toggleStatus}
              onClear={() => setStatuses([])}
            />
            <FilterChips
              label="Priority"
              options={casePriorities.map((priority) => ({ value: priority, label: casePriorityLabels[priority] }))}
              selected={priorities}
              onToggle={togglePriority}
              onClear={() => setPriorities([])}
            />
          </div>
        </section>
        <div className="effi-case-column">
          <div className="effi-case-toolbar">
            <p className="effi-results-count" aria-live="polite">
              {visibleCases.length === cases.length ? caseCountLabel(cases.length) : `${visibleCases.length} of ${caseCountLabel(cases.length)}`}
            </p>
            <select
              className="effi-sort-button"
              aria-label="Sort cases"
              value={sort}
              onChange={() => setSort((current) => current === "newest" ? "oldest" : "newest")}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          {visibleCases.length === 0 ? (
            <InboxState
              title="No cases match these filters"
              message="Clear the filters to see the full inbox."
              action={<Button variant="dark" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <>
              <div className="effi-case-columns" aria-hidden="true">
                <span>Priority</span>
                <span>Case</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              <ul className="effi-case-list">
                {visibleCases.map((entry) => <CaseRow key={entry.caseId} entry={entry} now={now} onOpen={setSelectedCase} />)}
              </ul>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <section className="effi-dashboard" aria-labelledby="case-inbox-title">
      <header className="effi-dashboard-header">
        <div className="effi-dashboard-masthead">
          <p className="effi-dashboard-brand">Effi</p>
          <UserButton />
        </div>
        <div className="effi-dashboard-intro">
          <h1 id="case-inbox-title">Good work starts with a clear inbox.</h1>
          <div>
            <p className="effi-dashboard-lede">Review confirmed Telegram and WhatsApp reports, then open the cases that need action.</p>
            <p className="effi-live-note">Case inbox updates live</p>
          </div>
        </div>
      </header>
      {body}
      {selectedCase ? <CasePreview entry={selectedCase} onClose={() => setSelectedCase(null)} /> : null}
    </section>
  );
}
