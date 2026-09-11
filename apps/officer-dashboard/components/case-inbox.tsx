"use client";

import Link from "next/link";
import { useConvexAuth, useQuery_experimental } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, Skeleton, Surface, type BadgeTone, type SurfaceTone } from "@effi/ui-web";
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
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: SurfaceTone }) {
  return (
    <Surface tone={tone} className="effi-stat">
      <p className="effi-stat-label">{label}</p>
      <strong className="effi-stat-value">{value}</strong>
    </Surface>
  );
}

function CaseRow({ entry, now }: { entry: CaseSummary; now: number }) {
  return (
    <li>
      <Link className="effi-case-row" href={`/cases/${entry.caseId}`}>
        <div className="effi-case-main">
          <div className="effi-case-top">
            <Badge tone={priorityTones[entry.currentPriority]}>{casePriorityLabels[entry.currentPriority]}</Badge>
            <h2 className="effi-case-summary">{entry.summary}</h2>
          </div>
          <p className="effi-case-meta">
            <span>{caseCategoryLabels[entry.category]}</span>
            <span>{entry.reportNumber}</span>
            <span>{caseChannelLabels[entry.channel]}</span>
          </p>
        </div>
        <div className="effi-case-side">
          <Badge tone={statusTones[entry.status]}>{caseStatusLabels[entry.status]}</Badge>
          <time className="effi-case-time" dateTime={new Date(entry.submittedAt).toISOString()} title={formatAbsoluteTime(entry.submittedAt)}>
            {formatRelativeTime(entry.submittedAt, now)}
          </time>
        </div>
      </Link>
    </li>
  );
}

function InboxState({
  eyebrow,
  title,
  message,
  tone,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  message: string;
  tone?: "error";
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`effi-state${tone === "error" ? " is-error" : ""}`}>
      <span className="effi-state-orb" aria-hidden="true" />
      <p className="effi-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{message}</p>
      {detail ? <p className="effi-state-detail">{detail}</p> : null}
      {action}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="effi-stats" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <Surface key={index} className="effi-stat">
          <Skeleton className="effi-skeleton-label" />
          <Skeleton className="effi-skeleton-value" />
        </Surface>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="effi-case-list" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <li key={index}>
          <div className="effi-case-row">
            <div className="effi-case-main">
              <Skeleton className="effi-skeleton-summary" />
              <Skeleton className="effi-skeleton-meta" />
            </div>
            <div className="effi-case-side">
              <Skeleton className="effi-skeleton-badge" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CaseInbox() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const result = useQuery_experimental({ query: listCases, args: isAuthenticated && !isLoading ? {} : "skip" });
  const [statuses, setStatuses] = useState<CaseStatus[]>([]);
  const [priorities, setPriorities] = useState<CasePriority[]>([]);
  const [sort, setSort] = useState<InboxSort>("newest");

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
        eyebrow="Session problem"
        title="We could not verify your officer session"
        message="Sign out and sign in again. If it keeps failing, check that Convex accepts the Clerk token."
        tone="error"
      />
    );
  } else if (result.status === "error") {
    const denied = result.error.message.toLowerCase().includes("officer");
    body = denied ? (
      <InboxState
        eyebrow="Access restricted"
        title="This account is not an officer"
        message="Ask an Effi admin to grant the officer role, then reload this page."
      />
    ) : (
      <InboxState
        eyebrow="Something went wrong"
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
        <ListSkeleton />
      </div>
    );
  } else if (cases.length === 0) {
    body = (
      <InboxState
        eyebrow="No cases yet"
        title="New reports land here"
        message="When a citizen confirms a report in Telegram or WhatsApp, Effi creates the case and it appears in this inbox in real time."
      />
    );
  } else {
    const counts = countWorkload(cases);
    body = (
      <>
        <div className="effi-stats">
          <StatTile label="Open" value={counts.open} tone="lavender" />
          <StatTile label="New" value={counts.fresh} tone="white" />
          <StatTile label="High and critical" value={counts.urgent} tone="white" />
          <StatTile label="Resolved" value={counts.resolved} tone="mint" />
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
          <button
            type="button"
            className="effi-filter-chip effi-sort-button"
            aria-pressed={sort === "oldest"}
            onClick={() => setSort(sort === "newest" ? "oldest" : "newest")}
          >
            {sort === "newest" ? "Newest first" : "Oldest first"}
          </button>
        </div>
        {visibleCases.length === 0 ? (
          <InboxState
            eyebrow="No matches"
            title="No cases match these filters"
            message="Clear the filters to see the full inbox."
            action={<Button variant="dark" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <>
            <p className="effi-results-count" aria-live="polite">
              {visibleCases.length === cases.length ? caseCountLabel(cases.length) : `${visibleCases.length} of ${caseCountLabel(cases.length)}`}
            </p>
            <ul className="effi-case-list">
              {visibleCases.map((entry) => <CaseRow key={entry.caseId} entry={entry} now={now} />)}
            </ul>
          </>
        )}
      </>
    );
  }

  return (
    <section className="effi-dashboard" aria-labelledby="case-inbox-title">
      <header className="effi-dashboard-header">
        <p className="effi-eyebrow">Case inbox</p>
        <h1 id="case-inbox-title">Cases</h1>
        <p className="effi-dashboard-lede">Every report a citizen has confirmed in Telegram or WhatsApp. Counts and rows update live from Convex.</p>
      </header>
      {body}
    </section>
  );
}
