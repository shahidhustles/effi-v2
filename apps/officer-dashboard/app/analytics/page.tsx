import { Show } from "@clerk/nextjs";
import { AnalyticsDashboard } from "../../components/analytics-dashboard";
import { OfficerAuth } from "../../components/officer-auth";

export default function OfficerAnalyticsPage() {
  return (
    <>
      <Show when="signed-out"><OfficerAuth /></Show>
      <Show when="signed-in"><AnalyticsDashboard /></Show>
    </>
  );
}
