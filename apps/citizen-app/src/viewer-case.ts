import type { CaseCategory, CasePriority, CaseStatus } from "@/case-status";

export type ViewerCase = {
  caseId: string;
  reportId: string;
  reportNumber: string;
  summary: string;
  category: CaseCategory;
  status: CaseStatus;
  currentPriority: CasePriority;
  reportedAt: number;
  submittedAt: number;
  channel: string;
  location: {
    latitude: number;
    longitude: number;
    place?: { name: string; formattedAddress: string };
  };
};
