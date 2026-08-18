import { FileInboundMessageStore } from "../../src/file-inbound-message-store.js";
import { createWhatsAppChannel, FileMediaStorage } from "../../src/whatsapp-channel.js";
import { join } from "node:path";

const authDirectory = process.env.WHATSAPP_AUTH_DIR ?? ".data/whatsapp-auth";
const inboundStore = new FileInboundMessageStore(join(authDirectory, "inbound-messages.json"));
const runtime = await createWhatsAppChannel({
  authDirectory,
  mediaStorage: new FileMediaStorage(process.env.WHATSAPP_MEDIA_DIR ?? ".data/whatsapp-media"),
  ...(process.env.WHATSAPP_PHONE_NUMBER ? { phoneNumber: process.env.WHATSAPP_PHONE_NUMBER } : {}),
  onPairingCode: (code) => console.info(`WhatsApp pairing code: ${code}`),
  onInbound: (message) => inboundStore.persist(message),
});

export const { bot, channel, send, whatsapp, disconnect } = runtime;
export default channel;
