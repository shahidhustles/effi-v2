# 04 - Prove both messaging channels

## Goal

Telegram and WhatsApp both complete the same real reporting outcome before dashboard work starts.

## Files

Modify as required by observed failures:
- `apps/bot-gateway/agent/channels/telegram.ts`
- `apps/bot-gateway/agent/channels/whatsapp.ts`
- `apps/bot-gateway/agent/instructions.md`
- `apps/bot-gateway/src/voice.ts`
- `apps/bot-gateway/src/sarvam-voice-provider.ts`
- `apps/bot-gateway/src/cartesia-voice-provider.ts`
- `packages/backend/convex/reporting.ts`

## Implementation notes

Run one text, image, location, confirm, claim, and acknowledgement journey per channel. Run one representative voice turn per channel. Keep a text fallback if voice synthesis fails. Add only narrow regressions for bugs found during these runs.

## Blocked by

- 02 - Finish the live Telegram journey
- 03 - Connect the direct WhatsApp adapter

## Done when

- Telegram and WhatsApp each create one real case with accepted evidence and return the correct report ID to the originating conversation.

