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
    <label>
      <span className="sr-only">{label}</span>
      <select
        className="min-h-9 min-w-[158px] rounded-md border border-line bg-surface px-3 pr-8 text-xs text-graphite transition-colors hover:border-action hover:text-ink focus-visible:outline-2 active:scale-[0.99] motion-reduce:transition-none"
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
    <div className="min-w-0 border-b border-line px-5 py-6 first:pl-0 sm:border-b-0 sm:border-l sm:first:border-l-0 sm:first:pl-6">
      <strong className="block font-display text-[40px] font-medium leading-none tracking-[-0.04em] tabular-nums text-ink">{value}</strong>
      <p className="mt-2 text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}

function CaseRow({ entry, now }: { entry: CaseSummary; now: number }) {
  return (
    <li>
      <Link className="group grid min-h-[92px] grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-[18px] py-[17px] transition-colors hover:bg-[#fafaf8] focus-visible:outline-2 focus-visible:outline-offset-[-3px] active:bg-lavender/40 motion-reduce:transition-none md:grid-cols-[96px_minmax(0,1fr)_150px_48px] md:items-center md:gap-[22px] md:px-6" href={`/cases/${entry.caseId}`} aria-label={`Open ${entry.reportNumber}: ${entry.summary}`}>
        <div className="col-start-1 row-start-2 md:col-auto md:row-auto">
          <span className="sr-only">Priority</span>
          <Badge tone={priorityTones[entry.currentPriority]}>{casePriorityLabels[entry.currentPriority]}</Badge>
        </div>
        <div className="col-start-1 row-start-1 min-w-0 md:col-auto md:row-auto">
          <span className="sr-only">Case</span>
          <h2 className="text-pretty font-display text-[16px] font-semibold leading-tight tracking-[-0.01em] text-ink">{entry.summary}</h2>
          <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted [&>span+span]:before:mr-3 [&>span+span]:before:content-['/']">
            <span>{caseCategoryLabels[entry.category]}</span>
            <span className="font-mono tabular-nums">{entry.reportNumber}</span>
            <span>{caseChannelLabels[entry.channel]}</span>
          </p>
        </div>
        <div className="col-start-2 row-start-2 flex min-w-0 flex-col items-end gap-2 md:col-auto md:row-auto md:items-start">
          <span className="sr-only">Status</span>
          <Badge tone={statusTones[entry.status]}>{caseStatusLabels[entry.status]}</Badge>
          <time className="text-xs text-muted" dateTime={new Date(entry.submittedAt).toISOString()} title={formatAbsoluteTime(entry.submittedAt)}>
            {formatRelativeTime(entry.submittedAt, now)}
          </time>
        </div>
        <span className="col-start-2 row-start-1 self-start text-sm text-ink transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none md:col-auto md:row-auto md:self-auto" aria-hidden="true">→</span>
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
    <div className={`mt-[22px] grid min-h-80 content-center justify-items-start rounded-[10px] border border-line p-[clamp(2rem,6vw,4.5rem)] ${tone === "error" ? "bg-[#fdf5f5]" : "bg-surface"}`}>
      <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-none tracking-tight text-ink">{title}</h2>
      <p className="mt-4 max-w-[52ch] leading-relaxed text-graphite">{message}</p>
      {detail ? <p className="mt-3 max-w-[72ch] font-mono text-xs leading-relaxed text-danger">{detail}</p> : null}
      {action}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface" aria-hidden="true">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="px-5 py-6 sm:px-7">
            <Skeleton className="h-[38px] w-[54px]" />
            <Skeleton className="mt-3 h-2.5 w-[74px]" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2 sm:px-7">
        {[4, 3].map((count) => (
          <div key={count} className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-2.5 w-12" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: count }, (_, index) => (
                <Skeleton key={index} className="h-[31px] w-[54px]" />
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
      <div className="flex min-h-[62px] items-center justify-between border-b border-line px-6 py-3">
        <Skeleton className="h-[11px] w-[78px]" />
        <Skeleton className="h-9 w-[116px]" />
      </div>
      <div className="hidden grid-cols-[96px_minmax(0,1fr)_150px_48px] gap-[22px] bg-fog px-6 py-3 text-[10px] font-bold uppercase tracking-[0.04em] text-muted md:grid">
        <span>Priority</span>
        <span>Case</span>
        <span>Status</span>
        <span>Action</span>
      </div>
      <ul className="divide-y divide-line bg-surface">
        {[0, 1, 2].map((index) => (
          <li key={index}>
            <div className="grid min-h-[92px] grid-cols-[minmax(0,1fr)_auto] gap-4 px-[18px] py-[17px] md:grid-cols-[96px_minmax(0,1fr)_150px_48px] md:items-center md:gap-[22px] md:px-6">
              <div className="col-start-1 row-start-2 md:col-auto md:row-auto"><Skeleton className="h-[22px] w-[84px]" /></div>
              <div className="col-start-1 row-start-1 min-w-0 md:col-auto md:row-auto">
                <Skeleton className="h-[15px] w-[min(70%,420px)]" />
                <Skeleton className="mt-3 h-[11px] w-[min(45%,260px)]" />
              </div>
              <div className="col-start-2 row-start-2 md:col-auto md:row-auto">
                <Skeleton className="h-[22px] w-[84px]" />
              </div>
              <Skeleton className="col-start-2 row-start-1 h-3 w-[38px] md:col-auto md:row-auto" />
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
        <span className="sr-only">Loading cases</span>
        <StatsSkeleton />
        <div className="mt-[22px] overflow-hidden rounded-[10px] border border-line bg-surface"><ListSkeleton /></div>
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
        <section className="overflow-hidden rounded-[10px] border border-line bg-surface" aria-labelledby="workload-title">
          <h2 id="workload-title" className="sr-only">Workload and filters</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <StatTile label="Total cases" value={cases.length} />
            <StatTile label="Open" value={counts.open} />
            <StatTile label="New" value={counts.fresh} />
            <StatTile label="Resolved" value={counts.resolved} />
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line px-5 py-5 sm:px-7">
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
        <div className="mt-[22px] overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="flex min-h-[62px] items-center justify-between gap-4 border-b border-line px-[18px] py-3 sm:px-6">
            <p className="text-xs text-graphite" aria-live="polite">
              {visibleCases.length === cases.length && initialView === "cases" ? caseCountLabel(cases.length) : `${visibleCases.length} of ${caseCountLabel(cases.length)}`}
            </p>
            <select
              className="min-h-9 rounded-md border border-line bg-surface px-3 pr-8 text-xs text-graphite transition-colors hover:border-action hover:text-ink focus-visible:outline-2 active:scale-[0.99] motion-reduce:transition-none"
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
              <div className="hidden grid-cols-[96px_minmax(0,1fr)_150px_48px] gap-[22px] bg-fog px-6 py-3 text-[10px] font-bold uppercase tracking-[0.04em] text-muted md:grid" aria-hidden="true">
                <span>Priority</span>
                <span>Case</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              <ul className="divide-y divide-line bg-surface">
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
    <label className="flex h-[42px] w-full max-w-[520px] items-center gap-3 rounded-lg border border-[#d9dde2] bg-surface px-3.5 text-muted transition-shadow focus-within:border-action focus-within:ring-3 focus-within:ring-action/10 motion-reduce:transition-none">
      <svg className="size-[19px] shrink-0 fill-none stroke-current stroke-[1.7]" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
      <span className="sr-only">Search cases</span>
      <input className="w-full border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by case ID or keywords" />
    </label>
  );

  return (
    <OfficerShell activeNav={initialView} assignedCount={assignedCount} caseCount={cases?.length} search={searchControl}>
    <section className="w-full" aria-labelledby="case-inbox-title">
      <header className="pb-7 pt-10 sm:pb-9 sm:pt-12">
        <div>
          <h1 className="font-display text-[clamp(2.75rem,5vw,4.5rem)] font-medium leading-none tracking-[-0.05em] text-ink" id="case-inbox-title">{initialView === "assigned" ? "My assigned" : "Cases"}</h1>
          <div>
            <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-graphite">{initialView === "assigned" ? "Cases currently assigned to your officer account." : "Review and manage confirmed civic issues."}</p>
          </div>
        </div>
      </header>
      {body}
    </section>
    </OfficerShell>
  );
}
