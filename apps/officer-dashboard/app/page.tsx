import { Show } from "@clerk/nextjs";
import { CaseInbox } from "../components/case-inbox";
import { OfficerAuth } from "../components/officer-auth";

export default function DashboardHome() {
  return (
    <>
      <Show when="signed-out"><OfficerAuth /></Show>
      <Show when="signed-in"><main className="dashboard-shell"><CaseInbox /></main></Show>
    </>
  );
}
