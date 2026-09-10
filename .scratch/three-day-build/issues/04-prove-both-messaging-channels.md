# 04 - Prove both messaging channels

Status: Complete

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

Claim links remain valid for 24 hours. `/clear` and `/reset` cancel the active draft immediately. An unclaimed link expires automatically after 24 hours; the next hourly cleanup sends an expiry notice to the originating channel and removes the abandoned draft and media.

## Blocked by

- 02 - Finish the live Telegram journey
- 03 - Connect the direct WhatsApp adapter

## Done when

- Telegram and WhatsApp each create one real case with accepted evidence and return the correct report ID to the originating conversation.

## Verification

- Telegram: `RPT-js70ddg0f1brngnbfhym5qvea98e4wpq` created a submitted case with accepted evidence and a delivered acknowledgement to conversation `7993389847`.
- WhatsApp: `RPT-js77exkrg6yx5x5ehmfzgpdgdx8e4j8p` created a submitted case with accepted evidence and a delivered acknowledgement to conversation `121655552659456@lid`.
- WhatsApp voice evidence includes successful English and Hindi Deepgram transcripts. Telegram voice evidence was completed in Ticket 02.
- Successful claims send `Your report has been registered. Report ID: ...` to the originating conversation.
- Expired unclaimed links send `Your report registration link has expired. Send a new issue to start a new report.` to the originating conversation.
