import type {
  AuthenticationInput,
  Channel,
  RegisteredReport,
  SimulatedReportStore,
} from "./simulated-report-registration.js";

export type ReportAuthenticationResult = { report: RegisteredReport };
export type RegistrationAcknowledgement = (conversationId: string, text: string) => Promise<void>;

/** Complete the same bound, idempotent report registration for every channel. */
export class ReportAuthenticationService {
  constructor(
    private readonly channel: Channel,
    private readonly store: SimulatedReportStore,
    private readonly acknowledge: RegistrationAcknowledgement,
  ) {}

  async complete(input: Required<Pick<AuthenticationInput, "authenticationLink" | "citizenId" | "conversationId">>): Promise<ReportAuthenticationResult> {
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
