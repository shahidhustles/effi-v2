import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      type: "customJwt",
      // Clerk Core 2 JWT templates cannot set the `aud` claim, so use the
      // issuer + JWKS provider instead of the applicationID (audience) flow.
      issuer: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      jwks: `${process.env.CLERK_JWT_ISSUER_DOMAIN!}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
