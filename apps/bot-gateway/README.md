# Effi WhatsApp transport

The `agent/channels/whatsapp.ts` channel uses the shared Eve agent through Chat SDK's staged `chat-adapter-baileys` transport. It keeps Baileys authentication, provider-ID dedupe state, Chat SDK subscriptions/cache, and copied media under the configured durable storage directories. Provider IDs use a recoverable claim/complete lease, so media and ingress failures can be retried instead of permanently dropping an event. `createWhatsAppChannel` invokes the shared report ingress after normalization and media copying, before Eve processes the message.

The default `FileChatState` is durable across restarts for this single-process service. Replace it with a shared Redis/Postgres Chat SDK state adapter before running multiple bot instances. WhatsApp and Telegram use the same staged report store, evidence tools, pending-submission validation, authentication binding, idempotent report creation, and report-ID acknowledgement. Ticket 08 owns migration of that shared staged store to the final Convex/officer pipeline.

```sh
corepack pnpm --filter @effi/bot-setup dev
```

Set `WHATSAPP_PHONE_NUMBER` to receive a pairing code, or adapt the channel's `onQR` callback for QR login. Baileys is an unofficial hackathon transport and is not a production WhatsApp guarantee; use only staged, non-sensitive data. The channel registers reports and acknowledgements, not report or case status.
