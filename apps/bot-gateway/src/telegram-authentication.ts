import type {
  AuthenticationInput,
  ChannelAdapter,
  SimulatedReportStore,
} from "./simulated-report-registration.js";
import { ReportAuthenticationService, type ReportAuthenticationResult } from "./report-authentication.js";

export type TelegramAuthenticationResult = ReportAuthenticationResult;

export class TelegramAuthenticationService {
  readonly #service: ReportAuthenticationService;

  constructor(store: SimulatedReportStore, adapter: ChannelAdapter) {
    this.#service = new ReportAuthenticationService("telegram", store, async (conversationId, text) => {
      await adapter.send({ channel: "telegram", conversationId, text });
    });
  }

  async complete(input: Required<Pick<AuthenticationInput, "authenticationLink" | "citizenId" | "conversationId">>): Promise<TelegramAuthenticationResult> {
    return this.#service.complete(input);
  }
}
