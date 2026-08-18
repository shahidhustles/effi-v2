# Effi WhatsApp transport

The `agent/channels/whatsapp.ts` channel uses the shared Eve agent through Chat SDK's staged `chat-adapter-baileys` transport. It keeps Baileys authentication and copied media under the configured durable storage directories. `createWhatsAppChannel` invokes its `onInbound` hook after normalization and media copying, so the same shared report ingress can persist the message before Eve processes it.

```sh
corepack pnpm --filter @effi/bot-setup dev
```

Set `WHATSAPP_PHONE_NUMBER` to receive a pairing code, or adapt the channel's `onQR` callback for QR login. Baileys is an unofficial hackathon transport and is not a production WhatsApp guarantee; use only staged, non-sensitive data. The channel registers reports and acknowledgements, not report or case status.
