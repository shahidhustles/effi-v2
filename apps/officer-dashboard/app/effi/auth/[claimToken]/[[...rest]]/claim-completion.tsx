"use client";

import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";

const claimAuthenticatedSubmission = makeFunctionReference<"mutation">("reporting:claimAuthenticatedSubmission");

export function ClaimCompletion({ claimToken }: { claimToken: string }) {
  const claim = useMutation(claimAuthenticatedSubmission);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [result, setResult] = useState<{ reportNumber: string; channel: "telegram" | "whatsapp"; conversationId: string; alreadyClaimed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for the Convex auth token to be attached before claiming, otherwise
    // the mutation runs anonymously and Convex rejects it.
    if (isLoading || !isAuthenticated) return;
    let active = true;
    void claim({ claimToken }).then(
      (value) => {
        void fetch("/api/effi/report-acknowledgement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reportNumber: value.reportNumber, channel: value.channel, conversationId: value.conversationId }) });
        if (active) setResult(value);
      },
      (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "We could not register this report."); },
    );
    return () => { active = false; };
  }, [claim, claimToken, isLoading, isAuthenticated]);

  if (error) return <main><h1>Registration unavailable</h1><p>{error}</p></main>;
  if (!result) return <main><h1>Registering your report…</h1></main>;
  return <main><h1>Report registered</h1><p>Report ID: {result.reportNumber}</p></main>;
}
