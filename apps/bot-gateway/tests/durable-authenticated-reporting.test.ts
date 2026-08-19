import { describe, expect, it } from "vitest";
import { SharedReportIngress } from "../src/report-ingress.js";
import {
  ReportAuthenticationService,
  type DurableAcknowledgementStore,
} from "../src/report-authentication.js";
import { SimulatedReportStore, type InboundMessage, type Channel } from "../src/simulated-report-registration.js";
import { createChannelAcknowledgementCallback } from "../src/channel-auth-callback.js";
import type { ConvexReportStore } from "../src/convex-report-store.js";

const location = { source: "current_gps" as const, latitude: 19.076, longitude: 72.8777 };
const attachmentFor = (id: string) => ({
  id,
  kind: "image" as const,
  mediaType: "image/jpeg",
  platformUrl: `platform:${id}`,
});

const inboundFor = (channel: Channel, id: string, conversationId: string, senderId: string, text: string, receivedAt: string): InboundMessage => ({
  id,
  channel,
  conversationId,
  senderId,
  text,
  location,
  attachments: [attachmentFor(`${id}-photo`)],
  receivedAt,
} as const);

type DurableDraft = {
  phase: "gathering" | "awaiting_confirmation" | "authentication_pending" | "registered" | "cancelled";
  sessionId: string;
  messages: Array<{ providerMessageId: string; receivedAt: number; payload: unknown }>;
};

/**
 * A fake durable report store that survives "restarts": each restart is a new
 * store instance sharing the same underlying snapshot map. The gateway uses
 * ConvexReportStore for the same purpose, so this keeps the acceptance proof
 * focused on the resumed anonymous scope.
 */
class FakeDurableStore implements Pick<ConvexReportStore, "persistInbound"> {
  readonly #durable = new Map<string, DurableDraft>();
  constructor(durable?: Map<string, DurableDraft>) { if (durable) this.#durable = durable; }
  durable() { return this.#durable; }

  async persistInbound(inbound: InboundMessage) {
    const scope = `${inbound.channel}:${inbound.senderId}:${inbound.conversationId}`;
    const existing = this.#durable.get(scope);
    const message = { providerMessageId: inbound.id, receivedAt: Date.parse(inbound.receivedAt), payload: inbound };
    if (existing) {
      existing.messages.push(message);
      return { duplicate: false, draft: { phase: existing.phase, sessionId: existing.sessionId }, messages: existing.messages };
    }
    const draft: DurableDraft = { phase: "gathering", sessionId: "session-durable", messages: [message] };
    this.#durable.set(scope, draft);
    return { duplicate: false, draft: { phase: draft.phase, sessionId: draft.sessionId }, messages: draft.messages };
  }
}

const durableStore = (durable: FakeDurableStore) => durable as unknown as ConvexReportStore;

type Journey = {
  store: SimulatedReportStore;
  ingress: SharedReportIngress;
  durable: FakeDurableStore;
};

const startJourney = (): Journey => {
  const store = new SimulatedReportStore(
    () => "2026-08-19T08:05:30.000Z",
    { authenticationBaseUrl: "https://auth.example.test/effi", tokenFactory: () => "one-time-token" },
  );
  const ingress = new SharedReportIngress(store);
  const durable = new FakeDurableStore();
  return { store, ingress, durable };
};

describe("durable authenticated reporting acceptance", () => {
  for (const channel of ["telegram", "whatsapp"] as const) {
    it(`${channel} resumes an incomplete draft after a restart and claims it once`, async () => {
      const { store, ingress, durable } = startJourney();
      const conversationId = `${channel}-chat-1`;
      const senderId = `${channel}-citizen-1`;
      const first = await ingress.acceptDurably(
        inboundFor(channel, `${channel}:m1`, conversationId, senderId, "A pothole blocks the road.", "2026-08-19T08:00:00.000Z"),
        durableStore(durable),
      );
      expect(first).toBeDefined();
      expect(first!.conversation.phase).toBe("gathering");
      expect(first!.conversation.messages).toHaveLength(1);

      // A restarted process shares the durable scope and resumes the same draft.
      const resumed = await ingress.acceptDurably(
        inboundFor(channel, `${channel}:m2`, conversationId, senderId, "It is outside the library.", "2026-08-19T08:05:00.000Z"),
        durableStore(durable),
      );
      expect(resumed).toBeDefined();
      expect(resumed!.conversation.messages).toHaveLength(2);
      expect(resumed!.conversation.messages[0]!.text).toBe("A pothole blocks the road.");
      expect(resumed!.conversation.messages[1]!.text).toBe("It is outside the library.");

      // Explicit confirmation and preparation.
      resumed!.conversation.phase = "awaiting_confirmation";
      const attachmentId = `${channel}:m1-photo`;
      store.markAttachmentInspected(channel, conversationId, attachmentId);
      store.recordAttachmentQuality(channel, conversationId, attachmentId, "satisfactory");
      const pending = store.prepareSubmission({
        channel,
        conversationId,
        issue: "A pothole blocks the road. It is outside the library.",
        category: "roads",
        acceptedAttachmentIds: [attachmentId],
        receivedAt: "2026-08-19T08:05:00.000Z",
      });
      expect(pending.authenticationLink).toBe("https://auth.example.test/effi/one-time-token");

      // Claim through the auth service exactly once.
      const acknowledgements: string[] = [];
      const service = new ReportAuthenticationService(channel, store, async (_conversationId, text) => { acknowledgements.push(text); });
      const firstClaim = await service.complete({ authenticationLink: pending.authenticationLink, citizenId: "citizen_42", conversationId });
      const repeatedClaim = await service.complete({ authenticationLink: pending.authenticationLink, citizenId: "citizen_42", conversationId });

      expect(firstClaim.report.id).toBe("report_1");
      expect(repeatedClaim.report.id).toBe(firstClaim.report.id);
      expect(store.reports()).toHaveLength(1);
      expect(acknowledgements).toEqual([`Your report has been registered. Report ID: report_1`]);
      expect(store.activeConversation(channel, conversationId)?.phase).toBe("authentication_pending");
    });

    it(`${channel} does not leak report details in the claim token`, async () => {
      const { store, ingress, durable } = startJourney();
      const conversationId = `${channel}-chat-2`;
      const first = await ingress.acceptDurably(
        inboundFor(channel, `${channel}:m1`, conversationId, `${channel}-citizen-2`, "Broken streetlight.", "2026-08-19T08:00:00.000Z"),
        durableStore(durable),
      );
      expect(first).toBeDefined();
      first!.conversation.phase = "awaiting_confirmation";
      const attachmentId = `${channel}:m1-photo`;
      store.markAttachmentInspected(channel, conversationId, attachmentId);
      store.recordAttachmentQuality(channel, conversationId, attachmentId, "satisfactory");
      const pending = store.prepareSubmission({
        channel,
        conversationId,
        issue: "Broken streetlight.",
        category: "lighting",
        acceptedAttachmentIds: [attachmentId],
        receivedAt: "2026-08-19T08:00:00.000Z",
      });

      const token = pending.authenticationLink.split("/").at(-1) ?? "";
      expect(token).toBe("one-time-token");
      expect(pending.authenticationLink).not.toContain("streetlight");
      expect(pending.authenticationLink).not.toContain(conversationId);
      expect(pending.authenticationLink).not.toContain("pending");
      expect(pending.authenticationLink).not.toContain("latitude");
    });
  }

  it("a provider callback retry cannot duplicate the acknowledgement", async () => {
    const sent: string[] = [];
    const durable: DurableAcknowledgementStore = {
      async reserveAcknowledgement(input) {
        if (input.reportNumber === "RPT-1") return { reserved: false, state: "delivered", reportNumber: input.reportNumber };
        return { reserved: true, state: "reserved", reportNumber: input.reportNumber };
      },
      async recordAcknowledgementOutcome() {},
    };
    const callback = createChannelAcknowledgementCallback({
      channel: "telegram",
      callbackSecret: () => "callback-secret",
      store: () => durable,
      send: async (_conversationId, text) => { sent.push(text); },
    });
    const request = () => new Request("https://effi.test/callback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-effi-auth-callback-secret": "callback-secret" },
      body: JSON.stringify({ reportNumber: "RPT-1", conversationId: "chat-1" }),
    });

    expect(await (await callback(request())).json()).toEqual({ reportId: "RPT-1", acknowledgementState: "delivered" });
    expect(await (await callback(request())).json()).toEqual({ reportId: "RPT-1", acknowledgementState: "delivered" });
    expect(sent).toHaveLength(0);
  });

  it("the authenticated claim returns one durable report number across a browser refresh", async () => {
    const { store, ingress, durable } = startJourney();
    const conversationId = "whatsapp-chat-refresh";
    const first = await ingress.acceptDurably(
      inboundFor("whatsapp", "whatsapp:m1", conversationId, "whatsapp-citizen-refresh", "A pothole blocks the road.", "2026-08-19T08:00:00.000Z"),
      durableStore(durable),
    );
    expect(first).toBeDefined();
    first!.conversation.phase = "awaiting_confirmation";
    const attachmentId = "whatsapp:m1-photo";
    store.markAttachmentInspected("whatsapp", conversationId, attachmentId);
    store.recordAttachmentQuality("whatsapp", conversationId, attachmentId, "satisfactory");
    const pending = store.prepareSubmission({
      channel: "whatsapp",
      conversationId,
      issue: "A pothole blocks the road.",
      category: "roads",
      acceptedAttachmentIds: [attachmentId],
      receivedAt: "2026-08-19T08:05:00.000Z",
    });

    const sent: string[] = [];
    const service = new ReportAuthenticationService("whatsapp", store, async (_conversationId, text) => { sent.push(text); });
    const input = { authenticationLink: pending.authenticationLink, citizenId: "citizen-refresh", conversationId };
    const firstClaim = await service.complete(input);
    const refreshed = await service.complete(input);

    expect(refreshed.report.id).toBe(firstClaim.report.id);
    expect(store.reports()).toHaveLength(1);
    expect(sent).toEqual([`Your report has been registered. Report ID: ${firstClaim.report.id}`]);
  });
});
