"use client";

import Link from "next/link";
import { useConvexAuth, useQuery_experimental } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, Skeleton, type BadgeTone } from "@effi/ui-web";
import { OfficerShell } from "./officer-shell";
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

function FilterSelect<Value extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly { value: Value; label: string }[];
  selected: readonly Value[];
  onChange: (value: Value | null) => void;
}) {
  return (
    <label className="effi-filter-select">
      <span className="effi-visually-hidden">{label}</span>
      <select
        value={selected[0] ?? ""}
        onChange={(event) => onChange(options.find((option) => option.value === event.target.value)?.value ?? null)}
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
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

function CaseRow({ entry, now }: { entry: CaseSummary; now: number }) {
  return (
    <li>
      <Link className="effi-case-row" href={`/cases/${entry.caseId}`} aria-label={`Open ${entry.reportNumber}: ${entry.summary}`}>
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
        <span className="effi-open-case" aria-hidden="true">→</span>
      </Link>
    </li>
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

export function CaseInbox({ initialView }: { initialView: "cases" | "assigned" }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const result = useQuery_experimental({ query: listCases, args: isAuthenticated && !isLoading ? {} : "skip" });
  const [statuses, setStatuses] = useState<CaseStatus[]>([]);
  const [priorities, setPriorities] = useState<CasePriority[]>([]);
  const [sort, setSort] = useState<InboxSort>("newest");
  const [search, setSearch] = useState("");

  const cases = result.status === "success" ? result.data : null;
  const filters = useMemo<InboxFilters>(() => ({ statuses, priorities }), [statuses, priorities]);
  const visibleCases = useMemo(() => {
    if (!cases) return [];
    const normalizedSearch = search.trim().toLowerCase();
    const scopedCases = initialView === "assigned" ? cases.filter((entry) => entry.isAssignedToMe) : cases;
    const matchingCases = normalizedSearch
      ? scopedCases.filter((entry) => [entry.summary, entry.reportNumber, caseCategoryLabels[entry.category], caseChannelLabels[entry.channel]].some((value) => value.toLowerCase().includes(normalizedSearch)))
      : scopedCases;
    return sortCases(filterCases(matchingCases, filters), sort);
  }, [cases, filters, initialView, search, sort]);

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
            <StatTile label="Total cases" value={cases.length} />
            <StatTile label="Open" value={counts.open} />
            <StatTile label="New" value={counts.fresh} />
            <StatTile label="Resolved" value={counts.resolved} />
          </div>
          <div className="effi-filters">
            <FilterSelect
              label="Status"
              options={caseStatuses.map((status) => ({ value: status, label: caseStatusLabels[status] }))}
              selected={statuses}
              onChange={(status) => setStatuses(status ? [status] : [])}
            />
            <FilterSelect
              label="Priority"
              options={casePriorities.map((priority) => ({ value: priority, label: casePriorityLabels[priority] }))}
              selected={priorities}
              onChange={(priority) => setPriorities(priority ? [priority] : [])}
            />
          </div>
        </section>
        <div className="effi-case-column">
          <div className="effi-case-toolbar">
            <p className="effi-results-count" aria-live="polite">
              {visibleCases.length === cases.length && initialView === "cases" ? caseCountLabel(cases.length) : `${visibleCases.length} of ${caseCountLabel(cases.length)}`}
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
                {visibleCases.map((entry) => <CaseRow key={entry.caseId} entry={entry} now={now} />)}
              </ul>
            </>
          )}
        </div>
      </>
    );
  }

  const assignedCount = cases?.filter((entry) => entry.isAssignedToMe).length;
  const searchControl = (
    <label className="officer-search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
      <span className="effi-visually-hidden">Search cases</span>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by case ID or keywords" />
    </label>
  );

  return (
    <OfficerShell activeNav={initialView} assignedCount={assignedCount} caseCount={cases?.length} search={searchControl}>
    <section className="effi-dashboard" aria-labelledby="case-inbox-title">
      <header className="effi-dashboard-header">
        <div className="effi-dashboard-intro">
          <h1 id="case-inbox-title">{initialView === "assigned" ? "My assigned" : "Cases"}</h1>
          <div>
            <p className="effi-dashboard-lede">{initialView === "assigned" ? "Cases currently assigned to your officer account." : "Review and manage confirmed civic issues."}</p>
          </div>
        </div>
      </header>
      {body}
    </section>
    </OfficerShell>
  );
}
