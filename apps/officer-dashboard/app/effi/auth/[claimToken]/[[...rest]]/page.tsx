import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { clerkAppearance } from "../../../../clerk-appearance";
import { ClaimCompletion } from "./claim-completion";
import { ClaimShell } from "./claim-shell";

export const metadata: Metadata = {
  title: "Register your report | Effi",
  description: "Securely register your civic report and receive its report ID.",
};

export default async function ClaimPage({ params }: { params: Promise<{ claimToken: string }> }) {
  const { claimToken } = await params;
  const { isAuthenticated } = await auth();
  const returnUrl = `/effi/auth/${encodeURIComponent(claimToken)}`;
  return (
    <ClaimShell>
      {!isAuthenticated ? (
        <SignIn
          appearance={clerkAppearance}
          forceRedirectUrl={returnUrl}
          signUpForceRedirectUrl={returnUrl}
          withSignUp
        />
      ) : (
        <ClaimCompletion claimToken={claimToken} />
      )}
    </ClaimShell>
  );
}
