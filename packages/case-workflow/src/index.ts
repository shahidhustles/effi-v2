import type { CaseStatus } from "@effi/domain";

const nextStatusByStatus: Readonly<Record<CaseStatus, CaseStatus | null>> = {
  new: "assigned",
  assigned: "under_inspection",
  under_inspection: "work_in_progress",
  work_in_progress: "resolved",
  resolved: null,
};

export const nextCaseStatus = (status: CaseStatus): CaseStatus | null => nextStatusByStatus[status];

export type CaseAuditEvent = { type: "case.status_changed"; from: CaseStatus; to: CaseStatus; occurredAt: string };

export const transitionCase = (from: CaseStatus, to: CaseStatus, occurredAt: string): CaseAuditEvent => {
  if (nextCaseStatus(from) !== to) throw new Error(`Invalid case status transition: ${from} -> ${to}`);
  return { type: "case.status_changed", from, to, occurredAt };
};
