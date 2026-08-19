import { describe, expect, it } from "vitest";
import { ReportAuthenticationService, type DurableAcknowledgementStore, type ReportChannel } from "../src/report-authentication.js";
import { createChannelAcknowledgementCallback } from "../src/channel-auth-callback.js";

type State = "reserved" | "delivered" | "failed";
class FakeDurableAcknowledgements implements DurableAcknowledgementStore {
  readonly records: Map<string, State>;
  readonly outcomes: Array<{ reportNumber: string; delivered: boolean }>;
  constructor(saved?: { records: Map<string, State>; outcomes: Array<{ reportNumber: string; delivered: boolean }> }) {
    this.records = saved?.records ?? new Map(); this.outcomes = saved?.outcomes ?? [];
  }
  async reserveAcknowledgement(input: { reportNumber: string; channel: ReportChannel; conversationId: string }) {
    const state = this.records.get(input.reportNumber);
    if (state) return { reserved: false, state, reportNumber: input.reportNumber };
    this.records.set(input.reportNumber, "reserved");
    return { reserved: true, state: "reserved" as const, reportNumber: input.reportNumber };
  }
  async recordAcknowledgementOutcome(reportNumber: string, delivered: boolean) {
    this.records.set(reportNumber, delivered ? "delivered" : "failed"); this.outcomes.push({ reportNumber, delivered });
  }
  restart() { return new FakeDurableAcknowledgements({ records: this.records, outcomes: this.outcomes }); }
}

describe("durable channel acknowledgement", () => {
  for (const channel of ["telegram", "whatsapp"] as const) {
    it(`${channel} sends the durable report number only once`, async () => {
      const store = new FakeDurableAcknowledgements(); const sent: string[] = [];
      const service = new ReportAuthenticationService(channel, store, async (_conversation, text) => { sent.push(text); });
      const input = { reportNumber: "RPT-real-convex-report", conversationId: `${channel}-conversation` };
      await service.complete(input); await new ReportAuthenticationService(channel, store.restart(), async (_c, text) => { sent.push(text); }).complete(input);
      expect(sent).toEqual(["Your report has been registered. Report ID: RPT-real-convex-report"]);
      expect(store.records.get(input.reportNumber)).toBe("delivered");
    });
  }

  it("reserves before delivery and never retries a failed acknowledgement", async () => {
    const store = new FakeDurableAcknowledgements(); let sends = 0;
    const service = new ReportAuthenticationService("telegram", store, async () => { sends += 1; throw new Error("provider unavailable"); });
    const input = { reportNumber: "RPT-provider-failure", conversationId: "chat-1" };
    await expect(service.complete(input)).rejects.toThrow("provider unavailable");
    await new ReportAuthenticationService("telegram", store.restart(), async () => { sends += 1; }).complete(input);
    expect(sends).toBe(1); expect(store.records.get(input.reportNumber)).toBe("failed");
    expect(store.outcomes).toEqual([{ reportNumber: input.reportNumber, delivered: false }]);
  });

  it("suppresses concurrent callbacks after one durable reservation", async () => {
    const store = new FakeDurableAcknowledgements(); let sends = 0;
    const service = new ReportAuthenticationService("whatsapp", store, async () => { sends += 1; await Promise.resolve(); });
    const input = { reportNumber: "RPT-race", conversationId: "whatsapp-1" };
    await Promise.all([service.complete(input), service.complete(input)]);
    expect(sends).toBe(1);
  });

  for (const channel of ["telegram", "whatsapp"] as const) {
    it(`${channel} callback returns and sends the durable report number once`, async () => {
      const store = new FakeDurableAcknowledgements(); const sent: string[] = [];
      const callback = createChannelAcknowledgementCallback({ channel, callbackSecret: () => "callback-secret", store: () => store, send: async (_conversation, text) => { sent.push(text); } });
      const request = () => new Request("https://effi.test/callback", { method: "POST", headers: { "content-type": "application/json", "x-effi-auth-callback-secret": "callback-secret" }, body: JSON.stringify({ reportNumber: "RPT-callback", conversationId: `${channel}-chat` }) });
      expect(await (await callback(request())).json()).toEqual({ reportId: "RPT-callback", acknowledgementState: "delivered" });
      expect((await callback(request())).status).toBe(200);
      expect(sent).toEqual(["Your report has been registered. Report ID: RPT-callback"]);
    });
  }
});
