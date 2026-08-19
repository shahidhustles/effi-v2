export type ReportChannel = "telegram" | "whatsapp";
export type RegistrationAcknowledgement = (conversationId: string, text: string) => Promise<void>;
export type AuthenticationCompletionInput = { reportNumber: string; conversationId: string } | (Required<Pick<AuthenticationInput, "authenticationLink" | "citizenId" | "conversationId">> & Partial<Pick<AuthenticationInput, "idempotencyKey">>);
export type ReportAuthenticationResult = { reportNumber: string; acknowledgementState: "reserved" | "delivered" | "failed"; report: RegisteredReport };
export type DurableAcknowledgementStore = {
  reserveAcknowledgement(input: { reportNumber: string; channel: ReportChannel; conversationId: string }): Promise<{ reserved: boolean; state: "reserved" | "delivered" | "failed"; reportNumber: string }>;
  recordAcknowledgementOutcome(reportNumber: string, delivered: boolean): Promise<void>;
};

/**
 * Convex reserves the acknowledgement before a provider call. This is
 * deliberately at-most-once: a crash after the provider accepts a post can
 * leave it reserved, but a retry must never duplicate the citizen message.
 */
export class ReportAuthenticationService {
  readonly #legacyInFlight = new Map<string, Promise<ReportAuthenticationResult>>();
  readonly #legacyDelivered = new Map<string, ReportAuthenticationResult>();
  constructor(
    private readonly channel: ReportChannel,
    private readonly store: DurableAcknowledgementStore | SimulatedReportStore,
    private readonly acknowledge: RegistrationAcknowledgement,
  ) {}

  async complete(input: AuthenticationCompletionInput): Promise<ReportAuthenticationResult> {
    if (!("reserveAcknowledgement" in this.store)) {
      const legacyStore = this.store as SimulatedReportStore;
      if (!("authenticationLink" in input)) throw new Error("Legacy acknowledgement requires an authentication link.");
      const key = input.idempotencyKey ?? `${this.channel}:${input.conversationId}:${input.authenticationLink}:${input.citizenId}`;
      const delivered = this.#legacyDelivered.get(key);
      if (delivered) return delivered;
      const existing = this.#legacyInFlight.get(key);
      if (existing) return await existing;
      const completion = (async () => {
        const report = legacyStore.authenticate(input.authenticationLink, input.citizenId, { channel: this.channel, conversationId: input.conversationId });
        await this.acknowledge(input.conversationId, `Your report has been registered. Report ID: ${report.id}`);
        const result = { reportNumber: report.id, acknowledgementState: "delivered" as const, report };
        this.#legacyDelivered.set(key, result);
        return result;
      })();
      this.#legacyInFlight.set(key, completion);
      try { return await completion; } finally { if (this.#legacyInFlight.get(key) === completion) this.#legacyInFlight.delete(key); }
    }
    if (!("reportNumber" in input)) throw new Error("Durable acknowledgement requires a report number.");
    const reservation = await this.store.reserveAcknowledgement({ ...input, channel: this.channel });
    if (!reservation.reserved) return { reportNumber: reservation.reportNumber, acknowledgementState: reservation.state, report: { id: reservation.reportNumber } as RegisteredReport };
    try {
      await this.acknowledge(input.conversationId, `Your report has been registered. Report ID: ${reservation.reportNumber}`);
      await this.store.recordAcknowledgementOutcome(reservation.reportNumber, true);
      return { reportNumber: reservation.reportNumber, acknowledgementState: "delivered", report: { id: reservation.reportNumber } as RegisteredReport };
    } catch (error) {
      await this.store.recordAcknowledgementOutcome(reservation.reportNumber, false);
      throw error;
    }
  }
}
import type { AuthenticationInput, RegisteredReport, SimulatedReportStore } from "./simulated-report-registration.js";
