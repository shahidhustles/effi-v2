import type {
  AuthenticationInput,
  Channel,
  RegisteredReport,
  SimulatedReportStore,
} from "./simulated-report-registration.js";

export type ReportAuthenticationResult = { report: RegisteredReport };
export type RegistrationAcknowledgement = (conversationId: string, text: string) => Promise<void>;
type AuthenticationCompletionInput = Required<Pick<AuthenticationInput, "authenticationLink" | "citizenId" | "conversationId">>
  & Partial<Pick<AuthenticationInput, "idempotencyKey">>;

/** Complete the same bound, idempotent report registration for every channel. */
export class ReportAuthenticationService {
  readonly #inFlight = new Map<string, Promise<ReportAuthenticationResult>>();

  constructor(
    private readonly channel: Channel,
    private readonly store: SimulatedReportStore,
    private readonly acknowledge: RegistrationAcknowledgement,
  ) {}

  async complete(input: AuthenticationCompletionInput): Promise<ReportAuthenticationResult> {
    const callbackKey = input.idempotencyKey ?? [this.channel, input.conversationId, input.authenticationLink, input.citizenId].join(":");
    const existing = this.#inFlight.get(callbackKey);
    if (existing) return existing;

    const completion = this.#complete(input);
    this.#inFlight.set(callbackKey, completion);
    try {
      return await completion;
    } finally {
      if (this.#inFlight.get(callbackKey) === completion) this.#inFlight.delete(callbackKey);
    }
  }

  async #complete(input: AuthenticationCompletionInput): Promise<ReportAuthenticationResult> {
    const conversation = this.store.activeConversation(this.channel, input.conversationId);
    const alreadyRegistered = conversation?.phase === "registered";
    const report = this.store.authenticate(input.authenticationLink, input.citizenId, {
      channel: this.channel,
      conversationId: input.conversationId,
    });

    if (!alreadyRegistered) {
      await this.acknowledge(input.conversationId, `Your report has been registered. Report ID: ${report.id}`);
      if (conversation) conversation.phase = "registered";
    }
    return { report };
  }
}
