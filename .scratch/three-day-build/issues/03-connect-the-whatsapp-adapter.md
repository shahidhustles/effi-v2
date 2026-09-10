# 03 - Connect the direct WhatsApp adapter

## Goal

Effi runs the direct Eve custom WhatsApp channel from `eve-wa-adapter` and routes its messages into the existing Effi reporting pipeline.

## Files

Modify:
- `apps/bot-gateway/agent/channels/whatsapp.ts`
- `apps/bot-gateway/src/whatsapp-channel.ts`
- `apps/bot-gateway/src/whatsapp-persistence.ts`
- `apps/bot-gateway/agent/lib/whatsapp-reporting.ts`
- `apps/bot-gateway/package.json`
- `pnpm-lock.yaml`
- `apps/bot-gateway/.env.example`

Delete when no longer referenced:
- `apps/bot-gateway/src/file-chat-state.ts`
- `apps/bot-gateway/agent/lib/whatsapp-dispatch.ts`

## Implementation notes

Use the adapter's QR, reconnect, direct-message filtering, media parsing, GPS parsing, HITL response, typing, and delivery behavior. Keep Effi's provider-ID dedupe, controlled media storage, structured location, report context, channel auth, cancellation lock, and acknowledgement. One WhatsApp implementation must remain.

## Blocked by

- 01 - Fix the gateway feedback loop

## Done when

- `apps/bot-gateway` starts one Baileys socket, prints a scannable QR when logged out, restores saved auth after restart, and an inbound WhatsApp text reaches the Effi agent once.

