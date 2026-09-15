# Effi bot gateway

The gateway exposes Telegram through Eve's native channel and WhatsApp through one direct Baileys socket. Both channels persist inbound messages before starting an Eve turn and use the same reporting, authentication, evidence, and acknowledgement pipeline.

Both channels use Muse Spark 1.3 Contributor Free through OpenCode Zen's Responses API, configured with `OPENCODE_API_KEY`, `OPENCODE_BASE_URL`, and `OPENCODE_MODEL`. The start script reads an exported key first, then `OPENCODE_API_KEY` from `.env.local`, then the `opencode-go` credential in `~/.local/share/opencode/auth.json`. If the model is unavailable, the already-persisted report draft remains recoverable and the channel asks the citizen to retry that message.

## WhatsApp

Set `WHATSAPP_ALLOWED_NUMBERS` to a comma-separated list of E.164 numbers without `+`. Messages from every other number, groups, status broadcasts, and Message Yourself are ignored. The channel also accepts Baileys LIDs only when Baileys resolves them to an allowed phone number.

Baileys authentication defaults to `.data/whatsapp-auth`. On the first start, scan the terminal QR from WhatsApp > Linked Devices. Later starts restore the saved credentials. Provider message IDs are stored beside the credentials so an inbound message starts at most one Eve turn. Images and voice notes are copied to `WHATSAPP_MEDIA_DIR` before use.

Start the local gateway and Telegram tunnel:

```sh
./scripts/effi-bot.sh start
./scripts/effi-bot.sh webhook
```

Useful commands from the repository root:

```sh
./scripts/effi-bot.sh status
./scripts/effi-bot.sh logs
./scripts/effi-bot.sh restart
./scripts/effi-bot.sh restart --fresh   # wipe durable sessions before a clean run
./scripts/effi-bot.sh stop
```

The full demo, including service order and fallbacks, is in `docs/demo-runbook.md`.

Set `WHATSAPP_CONNECT=0` for builds and tests that must not open a live socket. Text, images, GPS pins, numbered Eve input requests, typing indicators, read receipts, and `/reset` are handled directly. Voice notes use Vercel AI Gateway Whisper transcription with language auto-detection and Cartesia Sonic 3.6 for replies; the generated audio is converted to WhatsApp-compatible Ogg Opus before delivery.

Baileys is an unofficial hackathon transport. Use staged, non-sensitive data. This channel registers new complaints and acknowledges registration; it does not expose report or case status.
