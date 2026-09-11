"use client";

import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import { channelName, describeClaimFailure, type ClaimFailure, type ClaimResult } from "./claim-state";

const claimAuthenticatedSubmission = makeFunctionReference<"mutation">("reporting:claimAuthenticatedSubmission");

export function ClaimCompletion({ claimToken }: { claimToken: string }) {
  const claim = useMutation(claimAuthenticatedSubmission);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [state, setState] = useState<
    | { kind: "registering" }
    | { kind: "registered"; result: ClaimResult }
    | { kind: "already-registered"; result: ClaimResult }
    | { kind: "notification-failed"; result: ClaimResult }
    | ClaimFailure
  >({ kind: "registering" });

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let active = true;
    const abortController = new AbortController();

    void (async () => {
      try {
        const value = await claim({ claimToken });
        if (!active) return;
        if (value.alreadyClaimed) {
          setState({ kind: "already-registered", result: value });
          return;
        }
        const response = await fetch("/api/effi/report-acknowledgement", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reportNumber: value.reportNumber, channel: value.channel, conversationId: value.conversationId }),
          signal: abortController.signal,
        });
        if (!response.ok) {
          setState({ kind: "notification-failed", result: value });
          return;
        }
        if (active) setState({ kind: "registered", result: value });
      } catch (reason) {
        if (active && !abortController.signal.aborted) {
          setState(describeClaimFailure(reason));
        }
      }
    })();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [claim, claimToken, isLoading, isAuthenticated]);

  if (state.kind === "registering") {
    return (
      <div className="claim-status" role="status" aria-live="polite">
        <span className="claim-progress" aria-hidden="true" />
        <p className="claim-eyebrow">Identity confirmed</p>
        <h2>Registering your report...</h2>
        <p>We are securely linking your saved report to your account.</p>
      </div>
    );
  }

  if (state.kind === "registered" || state.kind === "already-registered" || state.kind === "notification-failed") {
    const platform = channelName(state.result.channel);
    const isAlreadyRegistered = state.kind === "already-registered";
    const notificationFailed = state.kind === "notification-failed";

    return (
      <div className="claim-status" role="status" aria-live="polite">
        <span className={`claim-result-mark${notificationFailed ? " is-warning" : ""}`} aria-hidden="true">
          {notificationFailed ? "!" : "✓"}
        </span>
        <p className="claim-eyebrow">{isAlreadyRegistered ? "Already complete" : "Registration complete"}</p>
        <h2>{isAlreadyRegistered ? "This report is already registered" : "Your report is registered"}</h2>
        <p className="claim-report-label">Report ID</p>
        <p className="claim-report-number">{state.result.reportNumber}</p>
        <div className={`claim-message${notificationFailed ? " is-warning" : ""}`}>
          {notificationFailed
            ? `We could not send the confirmation back to ${platform}. Save the report ID above before closing this page.`
            : isAlreadyRegistered
              ? `You can close this page and return to ${platform}.`
              : `A confirmation has also been sent to your ${platform} chat.`}
        </div>
      </div>
    );
  }

  return (
    <div className="claim-status" role="alert">
      <span className="claim-result-mark is-error" aria-hidden="true">!</span>
      <p className="claim-eyebrow">Registration unavailable</p>
      <h2>{state.title}</h2>
      <p>{state.message}</p>
    </div>
  );
}
