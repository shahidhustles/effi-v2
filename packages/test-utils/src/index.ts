import { caseId, citizenId, reportId, type Report } from "@effi/domain";

export const makeReport = (overrides: Partial<Report> = {}): Report => ({
  id: reportId("report_test_1"), reporterId: citizenId("citizen_test_1"), category: "roads",
  location: { latitude: 19.076, longitude: 72.8777, label: "Mumbai", precision: "approximate" }, submittedAt: "2026-08-18T00:00:00.000Z", ...overrides
});
export const testCaseId = () => caseId("case_test_1");
