import type {
  AuthenticationInput,
  ChannelAdapter,
  RegisteredReport,
  SimulatedReportStore,
} from "./simulated-report-registration.js";

export type TelegramAuthenticationResult = { report: RegisteredReport };

export class TelegramAuthenticationService {
  constructor(
    private readonly store: SimulatedReportStore,
    private readonly adapter: ChannelAdapter,
  ) {}

  async complete(input: Required<Pick<AuthenticationInput, "authenticationLink" | "citizenId" | "conversationId">>): Promise<TelegramAuthenticationResult> {
    const conversation = this.store.activeConversation("telegram", input.conversationId);
    const alreadyRegistered = conversation?.phase === "registered";
    const report = this.store.authenticate(input.authenticationLink, input.citizenId, {
      channel: "telegram",
      conversationId: input.conversationId,
    });

    if (!alreadyRegistered) {
      if (conversation) conversation.phase = "registered";
      await this.adapter.send({
        channel: "telegram",
        conversationId: input.conversationId,
        text: `Your report has been registered. Report ID: ${report.id}`,
      });
    }
    return { report };
  }
}
