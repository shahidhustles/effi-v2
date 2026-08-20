import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ClaimCompletion } from "./claim-completion";

export default async function ClaimPage({ params }: { params: Promise<{ claimToken: string }> }) {
  const { claimToken } = await params;
  const { isAuthenticated } = await auth();
  const returnUrl = `/effi/auth/${encodeURIComponent(claimToken)}`;
  if (!isAuthenticated) return <SignIn forceRedirectUrl={returnUrl} signUpForceRedirectUrl={returnUrl} />;
  return <ClaimCompletion claimToken={claimToken} />;
}
