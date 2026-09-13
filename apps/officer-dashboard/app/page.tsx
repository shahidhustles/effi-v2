import { Show } from "@clerk/nextjs";
import { CaseInbox } from "../components/case-inbox";
import { OfficerAuth } from "../components/officer-auth";

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  const initialView = view === "assigned" ? "assigned" : "cases";

  return (
    <>
      <Show when="signed-out"><OfficerAuth /></Show>
      <Show when="signed-in"><CaseInbox initialView={initialView} /></Show>
    </>
  );
}
