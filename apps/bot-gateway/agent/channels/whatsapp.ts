import { ReportAuthenticationService } from "../../src/report-authentication.js";
import { createWhatsAppChannel } from "../../src/whatsapp-channel.js";
import { reportStore } from "../lib/reporting.js";
import { whatsappMediaStorage, whatsappReportIngress } from "../lib/whatsapp-reporting.js";

const authDirectory = process.env.WHATSAPP_AUTH_DIR ?? ".data/whatsapp-auth";
const runtime = await createWhatsAppChannel({
  authDirectory,
  mediaStorage: whatsappMediaStorage,
  ...(process.env.WHATSAPP_PHONE_NUMBER ? { phoneNumber: process.env.WHATSAPP_PHONE_NUMBER } : {}),
  onPairingCode: (code) => console.info(`WhatsApp pairing code: ${code}`),
  onInbound: (message) => {
    const record = whatsappReportIngress.accept(message);
    return record ? whatsappReportIngress.contextFor(record) : null;
  },
});

export const { bot, channel, send, whatsapp, disconnect } = runtime;
export const whatsappAuthenticationService = new ReportAuthenticationService(
  "whatsapp",
  reportStore,
  async (conversationId, text) => {
    await whatsapp.postMessage(conversationId, text);
  },
);
export default channel;
