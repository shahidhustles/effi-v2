# 03 - Connect the direct WhatsApp adapter

Status: complete, verified 2026-09-10.

## Goal

Effi runs the direct Eve custom WhatsApp channel from `eve-wa-adapter` and routes its messages into the existing Effi reporting pipeline.

## Files

Modify:
- `apps/bot-gateway/agent/channels/whatsapp.ts`
- `apps/bot-gateway/agent/agent.ts`
- `apps/bot-gateway/agent/lib/reporting.ts`
- `apps/bot-gateway/src/whatsapp-channel.ts`
- `apps/bot-gateway/src/index.ts`
- `apps/bot-gateway/tests/whatsapp-channel.test.ts`
- `apps/bot-gateway/package.json`
- `apps/bot-gateway/.env.example`
- `apps/bot-gateway/README.md`
- `scripts/effi-bot.sh`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

Delete when no longer referenced:
- `apps/bot-gateway/src/file-chat-state.ts`
- `apps/bot-gateway/agent/lib/whatsapp-dispatch.ts`

## Implementation notes

Use the adapter's QR, reconnect, direct-message filtering, media parsing, GPS parsing, HITL response, typing, and delivery behavior. Keep Effi's provider-ID dedupe, controlled media storage, structured location, report context, channel auth, cancellation lock, and acknowledgement. One WhatsApp implementation must remain.

## Confirmed decisions

- Run one direct Baileys socket inside the Eve custom channel; remove Chat SDK and the internal HTTP bridge.
- Restore `.data/whatsapp-auth` credentials and print a terminal QR when logged out. Do not add pairing-code login.
- Start WhatsApp with `scripts/effi-bot.sh start`; builds and tests set `WHATSAPP_CONNECT=0`.
- Fail closed unless at least one E.164 number is configured in `WHATSAPP_ALLOWED_NUMBERS`. Ignore every other number, groups, status broadcasts, and Message Yourself without replying. Accept an LID only when Baileys maps it to an allowed phone number.
- Queue overlapping turns. Render Eve input requests as numbered plain text and accept the matching numeric reply.
- Keep `/reset`, `/clear`, and natural-language cancellation. Both slash commands discard the active draft and start a fresh Eve session.
- Support text, images, GPS pins, and voice in the adapter now. This ticket's live acceptance test is one inbound text from the configured second account; Ticket 04 owns the complete WhatsApp reporting journey.
- Use Deepgram for transcription and Cartesia for spoken replies, converting Cartesia output to WhatsApp-compatible Ogg Opus.
- Route the shared Telegram and WhatsApp agent through OpenCode Go. Send Eve's durable session ID in `x-opencode-session`; do not retain the Vercel AI Gateway fallback.
- Keep Eve at `0.52.5`: it was the npm `latest` release when this ticket was implemented; the proposed `0.54` release was not available.

## Verification

- Focused tests cover strict sender filtering, LID mapping, text/media/location normalization, and durable provider-ID dedupe.
- A live run must show one connected socket and one Eve turn for one inbound text from the configured allowed account.
- Live verification from the configured account reached Effi through WhatsApp, completed issue, photo, GPS, and confirmation processing, and returned the Clerk authentication link.
- The adapter keeps WhatsApp's composing indicator active during processing and refreshes it before WhatsApp expires the presence state.
- `pnpm --filter @effi/bot-setup typecheck`, `lint`, `test`, and `build` pass. The focused suite contains 67 tests.

## Blocked by

- 01 - Fix the gateway feedback loop

## Done when

- `apps/bot-gateway` starts one Baileys socket, prints a scannable QR when logged out, restores saved auth after restart, and an inbound WhatsApp text reaches the Effi agent once.
