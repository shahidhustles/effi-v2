"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

function ConvexProvider({ children }: { children: ReactNode }) {
  if (!convex) return children;
  return <ConvexProviderWithClerk client={convex} useAuth={useAuth}>{children}</ConvexProviderWithClerk>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  if (!clerkKey) return <>{children}</>;
  return <ClerkProvider><ConvexProvider>{children}</ConvexProvider></ClerkProvider>;
}
