"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import { channelName, describeClaimFailure, type ClaimFailure, type ClaimResult } from "./claim-state";
import { requestReportAcknowledgement } from "./report-acknowledgement";

const claimAuthenticatedSubmission = makeFunctionReference<"mutation">("reporting:claimAuthenticatedSubmission");

export function ClaimCompletion({ claimToken }: { claimToken: string }) {
  const claim = useMutation(claimAuthenticatedSubmission);
  const { getToken } = useAuth();
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
        const response = await requestReportAcknowledgement(value, getToken, abortController.signal);
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
  }, [claim, claimToken, getToken, isLoading, isAuthenticated]);

  if (state.kind === "registering") {
    return (
      <div className="w-full max-w-[420px]" role="status" aria-live="polite">
        <span className="mb-7 block size-10 animate-spin rounded-full border-[3px] border-lavender border-t-action motion-reduce:animate-[spin_1.8s_linear_infinite]" aria-hidden="true" />
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Identity confirmed</p>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink">Registering your report...</h2>
        <p className="mt-4 max-w-[42ch] leading-relaxed text-graphite">We are securely linking your saved report to your account.</p>
      </div>
    );
  }

  if (state.kind === "registered" || state.kind === "already-registered" || state.kind === "notification-failed") {
    const platform = channelName(state.result.channel);
    const isAlreadyRegistered = state.kind === "already-registered";
    const notificationFailed = state.kind === "notification-failed";

    return (
      <div className="w-full max-w-[420px]" role="status" aria-live="polite">
        <span className={`mb-7 grid size-12 place-items-center rounded-full text-xl font-bold text-white ${notificationFailed ? "bg-danger" : "bg-action"}`} aria-hidden="true">
          {notificationFailed ? "!" : "✓"}
        </span>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{isAlreadyRegistered ? "Already complete" : "Registration complete"}</p>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink">{isAlreadyRegistered ? "This report is already registered" : "Your report is registered"}</h2>
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Report ID</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">{state.result.reportNumber}</p>
        <div className={`mt-6 rounded-lg border p-4 text-sm leading-relaxed ${notificationFailed ? "border-danger/20 bg-[#fdf5f5] text-danger" : "border-line bg-fog text-graphite"}`}>
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
    <div className="w-full max-w-[420px]" role="alert">
      <span className="mb-7 grid size-12 place-items-center rounded-full bg-danger text-xl font-bold text-white" aria-hidden="true">!</span>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Registration unavailable</p>
      <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink">{state.title}</h2>
      <p className="mt-4 max-w-[42ch] leading-relaxed text-graphite">{state.message}</p>
    </div>
  );
}
