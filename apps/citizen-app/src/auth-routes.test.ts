import { describe, expect, it } from "vitest";
import { oauthNativeCallbackPath, signedInHomeRoute } from "./auth-routes";

describe("native OAuth routes", () => {
  it("registers the native callback and uses an absolute signed-in route", () => {
    type OAuthCallbackRoute = typeof import("../app/oauth-native-callback");
    const callbackRouteExists: OAuthCallbackRoute extends { default: unknown } ? true : false = true;
    expect(oauthNativeCallbackPath).toBe("oauth-native-callback");
    expect(callbackRouteExists).toBe(true);
    expect(signedInHomeRoute).toBe("/main/home");
  });
});
