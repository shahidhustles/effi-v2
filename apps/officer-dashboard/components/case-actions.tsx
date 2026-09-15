"use client";

import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useState, type FormEvent, type ReactNode } from "react";
import type { CaseDetail } from "./case-detail-types";
import { casePriorities, casePriorityLabels, caseStatusLabels, type CasePriority } from "./case-inbox-state";

type OfficerOption = { officerId: string; name: string; isMe: boolean };

const assignCase = makeFunctionReference<"mutation", { caseId: string; officerId?: string }, { status: "assigned"; officerName: string }>("cases:assignCase");
const listOfficers = makeFunctionReference<"query", Record<string, never>, OfficerOption[]>("cases:listOfficers");
const overridePriority = makeFunctionReference<"mutation", { caseId: string; priority: CasePriority }, { priority: CasePriority }>("cases:overridePriority");
const advanceCaseStatus = makeFunctionReference<
  "mutation",
  { caseId: string; action: { kind: "advance" } | { kind: "resolve"; resolutionNote: string } },
  { status: CaseDetail["case"]["status"] }
>("cases:advanceCaseStatus");

type PendingAction = "assign" | "priority" | "status" | "resolve" | null;

const nextActionLabels = {
  assigned: "Start inspection",
  under_inspection: "Start work",
  work_in_progress: "Resolve case",
} as const;

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : "The case could not be updated.";
const parsePriority = (value: string): CasePriority => {
  switch (value) {
    case "critical":
    case "high":
    case "medium":
    case "low":
      return value;
    default:
      throw new Error("Unknown case priority.");
  }
};

export const shouldShowAssignmentNotice = (detail: CaseDetail["case"]): boolean => (
  detail.status !== "resolved" && Boolean(detail.assignment) && !detail.canAct
);

export const nearbyRepostLabel = (count: number): string => {
  if (count === 0) return "No nearby reposts yet";
  return count === 1 ? "1 nearby repost" : `${count} nearby reposts`;
};

function ActionPrompt({ repostCount, children }: { repostCount: number; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      {repostCount > 0 ? <p className="text-[11px] font-semibold text-danger">{nearbyRepostLabel(repostCount)} within 3 km</p> : null}
      <div className="relative">
        {children}
        {repostCount > 0 ? (
          <span className="pointer-events-none absolute -right-1.5 -top-2 grid size-5 place-items-center rounded-full bg-danger text-[10px] font-bold tabular-nums text-white ring-2 ring-surface" aria-hidden="true">
            {repostCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CaseActions({ caseId, detail }: { caseId: string; detail: CaseDetail["case"] }) {
  const assign = useMutation(assignCase);
  const changePriority = useMutation(overridePriority);
  const advanceStatus = useMutation(advanceCaseStatus);
  const officers = useQuery(listOfficers, {});
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<CasePriority>(detail.currentPriority);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResolution, setShowResolution] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const isPending = pending !== null;
  const assigneeOptions = officers ?? [];
  const selectedAssigneeId = assigneeId
    ?? assigneeOptions.find((officer) => officer.isMe)?.officerId
    ?? assigneeOptions[0]?.officerId
    ?? null;

  const run = async (action: Exclude<PendingAction, null>, update: () => Promise<unknown>) => {
    setPending(action);
    setError(null);
    try {
      await update();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(null);
    }
  };

  const submitPriority = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await run("priority", async () => await changePriority({ caseId, priority }));
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAssigneeId) return;
    await run("assign", async () => await assign({ caseId, officerId: selectedAssigneeId }));
  };

  const submitResolution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await run("resolve", async () => await advanceStatus({ caseId, action: { kind: "resolve", resolutionNote } }));
  };

  const actionLabel = detail.status === "assigned" || detail.status === "under_inspection" || detail.status === "work_in_progress"
    ? nextActionLabels[detail.status]
    : null;

  return (
    <section className="grid gap-4 rounded-[10px] border border-line bg-surface p-4" aria-labelledby="case-actions-title">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-graphite">Officer actions</p>
        <h2 className="text-xl font-semibold tracking-[-0.015em] text-ink" id="case-actions-title">Move this case forward</h2>
      </div>

      <dl className="grid gap-2.5 [&>div]:flex [&>div]:justify-between [&>div]:gap-5 [&>div]:border-b [&>div]:border-line [&>div]:pb-2.5 [&_dd]:text-right [&_dd]:text-xs [&_dd]:font-semibold [&_dd]:text-graphite [&_dt]:text-xs [&_dt]:text-muted">
        <div>
          <dt>Assignment</dt>
          <dd>{detail.assignment?.officerName ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{caseStatusLabels[detail.status]}</dd>
        </div>
      </dl>

      {!detail.assignment && detail.status === "new" ? (
        assigneeOptions.length > 0 ? (
          <form className="grid gap-2 [&>label]:text-[11px] [&>label]:font-semibold [&>label]:uppercase [&>label]:tracking-[0.04em] [&>label]:text-muted" onSubmit={(event) => void submitAssignment(event)}>
            <label htmlFor="case-assignee">Assign to</label>
            <div className="flex gap-2">
              <select className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-xs text-ink" id="case-assignee" value={selectedAssigneeId ?? ""} onChange={(event) => setAssigneeId(event.target.value)} disabled={isPending}>
                {assigneeOptions.map((officer) => <option key={officer.officerId} value={officer.officerId}>{officer.name}{officer.isMe ? " (you)" : ""}</option>)}
              </select>
              <button className="min-h-10 rounded-md border border-action bg-action px-3.5 text-xs font-semibold text-white transition-colors hover:bg-action-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isPending || !selectedAssigneeId}>
                {pending === "assign" ? "Assigning" : "Assign"}
              </button>
            </div>
          </form>
        ) : (
          <button className="min-h-10 rounded-md border border-action bg-action px-3.5 text-xs font-semibold text-white transition-colors hover:bg-action-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={isPending} onClick={() => void run("assign", async () => await assign({ caseId }))}>
            {pending === "assign" ? "Assigning" : "Assign to me"}
          </button>
        )
      ) : null}

      {shouldShowAssignmentNotice(detail) ? <p className="text-xs leading-relaxed text-muted">Only the assigned officer or an administrator can update this case.</p> : null}

      {detail.canAct && detail.status !== "resolved" ? (
        <form className="grid gap-2 [&>label]:text-[11px] [&>label]:font-semibold [&>label]:uppercase [&>label]:tracking-[0.04em] [&>label]:text-muted" onSubmit={(event) => void submitPriority(event)}>
          <label htmlFor="case-priority">Priority</label>
          <div className="flex gap-2">
            <select className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-xs text-ink" id="case-priority" value={priority} onChange={(event) => setPriority(parsePriority(event.target.value))} disabled={isPending}>
              {casePriorities.map((value) => <option key={value} value={value}>{casePriorityLabels[value]}</option>)}
            </select>
            <button className="min-h-10 rounded-md border border-line bg-surface px-3.5 text-xs font-semibold text-graphite transition-colors hover:border-action hover:text-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isPending || priority === detail.currentPriority}>{pending === "priority" ? "Saving" : "Save priority"}</button>
          </div>
        </form>
      ) : null}

      {detail.canAct && actionLabel && detail.status !== "work_in_progress" ? (
        <ActionPrompt repostCount={detail.repostCount}>
          <button className="min-h-10 w-full rounded-md border border-action bg-action px-3.5 text-xs font-semibold text-white transition-colors hover:bg-action-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={isPending} onClick={() => void run("status", async () => await advanceStatus({ caseId, action: { kind: "advance" } }))}>
            {pending === "status" ? "Updating" : actionLabel}
          </button>
        </ActionPrompt>
      ) : null}

      {detail.canAct && detail.status === "work_in_progress" && !showResolution ? (
        <ActionPrompt repostCount={detail.repostCount}>
          <button className="min-h-10 w-full rounded-md border border-action bg-action px-3.5 text-xs font-semibold text-white transition-colors hover:bg-action-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={isPending} onClick={() => setShowResolution(true)}>Resolve case</button>
        </ActionPrompt>
      ) : null}

      {detail.canAct && detail.status === "work_in_progress" && showResolution ? (
        <form className="grid gap-2" onSubmit={(event) => void submitResolution(event)}>
          <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted" htmlFor="resolution-note">Resolution note</label>
          <textarea className="min-h-28 resize-y rounded-md border border-line bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-ink focus:border-action focus:ring-3 focus:ring-action/10" id="resolution-note" maxLength={500} required value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Describe what was completed." />
          <div className="flex justify-end gap-2">
            <button className="min-h-10 rounded-md border border-line bg-surface px-3.5 text-xs font-semibold text-graphite transition-colors hover:border-action hover:text-ink active:scale-[0.98] disabled:opacity-50" type="button" disabled={isPending} onClick={() => setShowResolution(false)}>Cancel</button>
            <button className="min-h-10 rounded-md border border-action bg-action px-3.5 text-xs font-semibold text-white transition-colors hover:bg-action-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isPending || resolutionNote.trim().length === 0}>{pending === "resolve" ? "Resolving" : "Confirm resolution"}</button>
          </div>
        </form>
      ) : null}

      {detail.status === "resolved" ? <p className="text-xs leading-relaxed text-muted">This case is resolved. Its audit history remains available below.</p> : null}
      {error ? <p className="text-xs leading-relaxed text-danger" role="alert">{error}</p> : null}
    </section>
  );
}
