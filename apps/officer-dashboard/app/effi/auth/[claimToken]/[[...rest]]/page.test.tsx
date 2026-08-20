import { beforeEach, describe, expect, it, vi } from "vitest";

const claimToken = "opaque-single-use-token";

const { authMock, signInMock, claimCompletionMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<{ isAuthenticated: boolean }>>(),
  signInMock: vi.fn(() => null),
  claimCompletionMock: vi.fn(() => null),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@clerk/nextjs", () => ({ SignIn: signInMock }));
vi.mock("./claim-completion", () => ({ ClaimCompletion: claimCompletionMock }));

import ClaimPage from "./page";

describe("report claim route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the opaque token as the only claim value in its return path", () => {
    expect(`/effi/auth/${encodeURIComponent(claimToken)}`).toBe("/effi/auth/opaque-single-use-token");
  });

  it("redirects an unauthenticated citizen back to the same opaque claim route after Clerk sign-in", async () => {
    authMock.mockResolvedValue({ isAuthenticated: false });
    const rendered = (await ClaimPage({ params: Promise.resolve({ claimToken }) })) as {
      type: unknown;
      props: Record<string, unknown>;
    };

    expect(authMock).toHaveBeenCalledOnce();
    expect(rendered.type).toBe(signInMock);
    expect(rendered.props).toEqual({
      forceRedirectUrl: "/effi/auth/opaque-single-use-token",
      signUpForceRedirectUrl: "/effi/auth/opaque-single-use-token",
    });
    expect(claimCompletionMock).not.toHaveBeenCalled();
  });

  it("hands an authenticated citizen the opaque token only", async () => {
    authMock.mockResolvedValue({ isAuthenticated: true });
    const rendered = (await ClaimPage({ params: Promise.resolve({ claimToken }) })) as {
      type: unknown;
      props: Record<string, unknown>;
    };

    expect(authMock).toHaveBeenCalledOnce();
    expect(rendered.type).toBe(claimCompletionMock);
    expect(rendered.props).toEqual({ claimToken });
    expect(signInMock).not.toHaveBeenCalled();
  });
});
