import { describe, expect, it } from "vitest";
import { botGatewayConfig } from "./bot-gateway-config";

describe("botGatewayConfig", () => {
  it("reports a missing gateway URL", () => {
    expect(botGatewayConfig(undefined)).toEqual({ kind: "missing" });
    expect(botGatewayConfig("   ")).toEqual({ kind: "missing" });
  });

  it("normalizes an HTTP gateway URL", () => {
    expect(botGatewayConfig(" http://192.168.1.20:2000/ ")).toEqual({
      kind: "ready",
      host: "http://192.168.1.20:2000",
    });
  });

  it("rejects malformed and unsupported URLs", () => {
    expect(botGatewayConfig("gateway.local")).toEqual({
      kind: "invalid",
      value: "gateway.local",
    });
    expect(botGatewayConfig("file:///tmp/gateway")).toEqual({
      kind: "invalid",
      value: "file:///tmp/gateway",
    });
  });
});
