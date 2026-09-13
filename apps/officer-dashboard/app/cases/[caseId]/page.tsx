import { Show } from "@clerk/nextjs";
import { CaseBrief } from "../../../components/case-brief";
import { OfficerAuth } from "../../../components/officer-auth";

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <>
      <Show when="signed-out"><OfficerAuth /></Show>
      <Show when="signed-in"><CaseBrief caseId={caseId} /></Show>
    </>
  );
}
