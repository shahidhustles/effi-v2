"use client";

import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useEffect, useState } from "react";

const claimAuthenticatedSubmission = makeFunctionReference<"mutation">("reporting:claimAuthenticatedSubmission");

export function ClaimCompletion({ claimToken }: { claimToken: string }) {
  const claim = useMutation(claimAuthenticatedSubmission);
  const [result, setResult] = useState<{ reportNumber: string; channel: "telegram" | "whatsapp"; conversationId: string; alreadyClaimed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void claim({ claimToken }).then(
      (value) => {
        void fetch("/api/effi/report-acknowledgement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reportNumber: value.reportNumber, channel: value.channel, conversationId: value.conversationId }) });
        if (active) setResult(value);
      },
      (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "We could not register this report."); },
    );
    return () => { active = false; };
  }, [claim, claimToken]);

  if (error) return <main><h1>Registration unavailable</h1><p>{error}</p></main>;
  if (!result) return <main><h1>Registering your report…</h1></main>;
  return <main><h1>Report registered</h1><p>Report ID: {result.reportNumber}</p></main>;
}
