# Effi WhatsApp transport

The `agent/channels/whatsapp.ts` channel uses the shared Eve agent through Chat SDK's staged `chat-adapter-baileys` transport. It keeps Baileys authentication, provider-ID dedupe state, Chat SDK subscriptions/cache, copied media, and normalized inbound messages under the configured durable storage directories. Provider IDs use a recoverable claim/complete lease, so media and inbound persistence failures can be retried instead of permanently dropping an event. `createWhatsAppChannel` invokes its `onInbound` hook after normalization and media copying, before Eve processes the message.

The default `FileChatState` is durable across restarts for this single-process service. Replace it with a shared Redis/Postgres Chat SDK state adapter before running multiple bot instances. The current checkout's report persistence/authentication integration remains the shared staged seam from ticket 01; a future Convex ingress can be supplied through `onInbound` without adding a WhatsApp-specific agent.

```sh
corepack pnpm --filter @effi/bot-setup dev
```

Set `WHATSAPP_PHONE_NUMBER` to receive a pairing code, or adapt the channel's `onQR` callback for QR login. Baileys is an unofficial hackathon transport and is not a production WhatsApp guarantee; use only staged, non-sensitive data. The channel registers reports and acknowledgements, not report or case status.
