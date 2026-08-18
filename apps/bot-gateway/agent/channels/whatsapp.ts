import { createWhatsAppChannel, FileMediaStorage } from "../../src/whatsapp-channel.js";

const runtime = await createWhatsAppChannel({
  authDirectory: process.env.WHATSAPP_AUTH_DIR ?? ".data/whatsapp-auth",
  mediaStorage: new FileMediaStorage(process.env.WHATSAPP_MEDIA_DIR ?? ".data/whatsapp-media"),
  ...(process.env.WHATSAPP_PHONE_NUMBER ? { phoneNumber: process.env.WHATSAPP_PHONE_NUMBER } : {}),
  onPairingCode: (code) => console.info(`WhatsApp pairing code: ${code}`),
});

export const { bot, channel, send, whatsapp, disconnect } = runtime;
export default channel;
