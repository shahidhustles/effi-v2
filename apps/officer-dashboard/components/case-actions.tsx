"use client";

import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useState, type FormEvent } from "react";
import type { CaseDetail } from "./case-detail-types";
import { casePriorities, casePriorityLabels, caseStatusLabels, type CasePriority } from "./case-inbox-state";

const assignCase = makeFunctionReference<"mutation", { caseId: string }, { status: "assigned"; officerName: string }>("cases:assignCase");
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

export function CaseActions({ caseId, detail }: { caseId: string; detail: CaseDetail["case"] }) {
  const assign = useMutation(assignCase);
  const changePriority = useMutation(overridePriority);
  const advanceStatus = useMutation(advanceCaseStatus);
  const [priority, setPriority] = useState<CasePriority>(detail.currentPriority);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResolution, setShowResolution] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const isPending = pending !== null;

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

  const submitResolution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await run("resolve", async () => await advanceStatus({ caseId, action: { kind: "resolve", resolutionNote } }));
  };

  const actionLabel = detail.status === "assigned" || detail.status === "under_inspection" || detail.status === "work_in_progress"
    ? nextActionLabels[detail.status]
    : null;

  return (
    <section className="case-actions" aria-labelledby="case-actions-title">
      <div>
        <p className="case-detail-kicker">Officer actions</p>
        <h2 id="case-actions-title">Move this case forward</h2>
      </div>

      <dl className="case-action-assignment">
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
        <button className="case-action-primary" type="button" disabled={isPending} onClick={() => void run("assign", async () => await assign({ caseId }))}>
          {pending === "assign" ? "Assigning" : "Assign to me"}
        </button>
      ) : null}

      {detail.assignment && !detail.canAct ? <p className="case-action-notice">Only the assigned officer or an administrator can update this case.</p> : null}

      {detail.canAct && detail.status !== "resolved" ? (
        <form className="case-priority-form" onSubmit={(event) => void submitPriority(event)}>
          <label htmlFor="case-priority">Priority</label>
          <div>
            <select id="case-priority" value={priority} onChange={(event) => setPriority(parsePriority(event.target.value))} disabled={isPending}>
              {casePriorities.map((value) => <option key={value} value={value}>{casePriorityLabels[value]}</option>)}
            </select>
            <button type="submit" disabled={isPending || priority === detail.currentPriority}>{pending === "priority" ? "Saving" : "Save priority"}</button>
          </div>
        </form>
      ) : null}

      {detail.canAct && actionLabel && detail.status !== "work_in_progress" ? (
        <button className="case-action-primary" type="button" disabled={isPending} onClick={() => void run("status", async () => await advanceStatus({ caseId, action: { kind: "advance" } }))}>
          {pending === "status" ? "Updating" : actionLabel}
        </button>
      ) : null}

      {detail.canAct && detail.status === "work_in_progress" && !showResolution ? (
        <button className="case-action-primary" type="button" disabled={isPending} onClick={() => setShowResolution(true)}>Resolve case</button>
      ) : null}

      {detail.canAct && detail.status === "work_in_progress" && showResolution ? (
        <form className="case-resolution-form" onSubmit={(event) => void submitResolution(event)}>
          <label htmlFor="resolution-note">Resolution note</label>
          <textarea id="resolution-note" maxLength={500} required value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Describe what was completed." />
          <div>
            <button type="button" disabled={isPending} onClick={() => setShowResolution(false)}>Cancel</button>
            <button className="case-action-primary" type="submit" disabled={isPending || resolutionNote.trim().length === 0}>{pending === "resolve" ? "Resolving" : "Confirm resolution"}</button>
          </div>
        </form>
      ) : null}

      {detail.status === "resolved" ? <p className="case-action-complete">This case is resolved. Its audit history remains available below.</p> : null}
      {error ? <p className="case-action-error" role="alert">{error}</p> : null}
    </section>
  );
}
