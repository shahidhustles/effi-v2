export type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type ReportId = Brand<string, "ReportId">;
export type CaseId = Brand<string, "CaseId">;
export type CitizenId = Brand<string, "CitizenId">;
export type OfficerId = Brand<string, "OfficerId">;
export type EvidenceId = Brand<string, "EvidenceId">;

export const reportId = (value: string): ReportId => value as ReportId;
export const caseId = (value: string): CaseId => value as CaseId;
export const citizenId = (value: string): CitizenId => value as CitizenId;
export const officerId = (value: string): OfficerId => value as OfficerId;
export const evidenceId = (value: string): EvidenceId => value as EvidenceId;

export const issueCategories = ["roads", "sanitation", "water", "lighting", "drainage", "other"] as const;
export type IssueCategory = (typeof issueCategories)[number];

export const priorities = ["critical", "high", "medium", "low"] as const;
export type Priority = (typeof priorities)[number];

export const caseStatuses = ["new", "assigned", "under_inspection", "work_in_progress", "resolved"] as const;
export type CaseStatus = (typeof caseStatuses)[number];

export type GeoLocation = { latitude: number; longitude: number; label: string; precision: "exact" | "approximate" };
export type ActorRole = "citizen" | "officer" | "admin";

export type Report = {
  id: ReportId;
  reporterId: CitizenId;
  category: IssueCategory;
  location: GeoLocation;
  submittedAt: string;
};

export type CivicCase = {
  id: CaseId;
  status: CaseStatus;
  priority: Priority;
  reportIds: readonly ReportId[];
  assignedOfficerId?: OfficerId;
};
