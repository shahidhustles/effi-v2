import type {
  AuthenticationInput,
  ChannelAdapter,
  SimulatedReportStore,
} from "./simulated-report-registration.js";
import { ReportAuthenticationService, type ReportAuthenticationResult } from "./report-authentication.js";

export type TelegramAuthenticationResult = ReportAuthenticationResult;
type TelegramAuthenticationInput = Required<Pick<AuthenticationInput, "authenticationLink" | "citizenId" | "conversationId">>
  & Partial<Pick<AuthenticationInput, "idempotencyKey">>;

export class TelegramAuthenticationService {
  readonly #service: ReportAuthenticationService;

  constructor(store: SimulatedReportStore, adapter: ChannelAdapter) {
    this.#service = new ReportAuthenticationService("telegram", store, async (conversationId, text) => {
      await adapter.send({ channel: "telegram", conversationId, text });
    });
  }

  async complete(input: TelegramAuthenticationInput): Promise<TelegramAuthenticationResult> {
    return this.#service.complete(input);
  }
}
