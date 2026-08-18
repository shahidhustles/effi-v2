# Effi WhatsApp transport

The `agent/channels/whatsapp.ts` channel uses the shared Eve agent through Chat SDK's staged `chat-adapter-baileys` transport. It keeps Baileys authentication, provider-ID dedupe state, Chat SDK subscriptions/cache, and copied media under the configured durable storage directories. Provider IDs use recoverable claim/complete leases on both sides of dispatch, so media, ingress, ambiguous HTTP responses, and Eve dispatch failures do not drop or duplicate a model turn. Because Baileys receives messages on a persistent socket rather than an HTTP webhook, the handler re-enters Eve through the secret-protected internal socket route before starting the model turn.

The default `FileChatState` is durable across restarts for this single-process service. Replace it with a shared Redis/Postgres Chat SDK state adapter before running multiple bot instances. WhatsApp and Telegram use the same staged report store, evidence tools, pending-submission validation, authentication binding, idempotent report creation, and report-ID acknowledgement. Ticket 08 owns migration of that shared staged store to the final Convex/officer pipeline.

```sh
corepack pnpm --filter @effi/bot-setup dev
```

Set `WHATSAPP_PHONE_NUMBER` to receive a pairing code, or adapt the channel's `onQR` callback for QR login. Baileys is an unofficial hackathon transport and is not a production WhatsApp guarantee; use only staged, non-sensitive data. The channel registers reports and acknowledgements, not report or case status.

Set `EFFI_INTERNAL_BASE_URL` to the reachable URL of this Eve service and use a strong `EFFI_INTERNAL_DISPATCH_SECRET`. The loopback default is appropriate only when Baileys and Eve run in the same process on port 3000.

Voice notes are copied into Effi-controlled media storage before transcription. `SARVAM_API_KEY` enables Saaras v3 speech-to-text and Bulbul v3 responses; the latest turn chooses the response language and text/voice modality. Failed or ambiguous transcription receives a Hindi voice retry, with text as the delivery fallback.
