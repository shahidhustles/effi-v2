import type { CaseStatus } from "@effi/domain";

const allowedTransitions: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
  new: ["assigned"], assigned: ["under_inspection"], under_inspection: ["work_in_progress"], work_in_progress: ["resolved"], resolved: []
};

export type CaseAuditEvent = { type: "case.status_changed"; from: CaseStatus; to: CaseStatus; occurredAt: string };

export const transitionCase = (from: CaseStatus, to: CaseStatus, occurredAt: string): CaseAuditEvent => {
  if (!allowedTransitions[from].includes(to)) throw new Error(`Invalid case status transition: ${from} -> ${to}`);
  return { type: "case.status_changed", from, to, occurredAt };
};
