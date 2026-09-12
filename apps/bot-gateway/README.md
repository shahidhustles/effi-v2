# Effi bot gateway

The gateway exposes Telegram through Eve's native channel and WhatsApp through one direct Baileys socket. Both channels persist inbound messages before starting an Eve turn and use the same reporting, authentication, evidence, and acknowledgement pipeline.

Both channels use the same fine-tuned Effi model through an OpenAI-compatible Chat Completions endpoint. Configure it with `EFFI_MODEL_API_KEY`, `EFFI_MODEL_BASE_URL`, and `EFFI_MODEL_ID`. The gateway has no automatic Muse fallback. If the endpoint is unavailable, the already-persisted report draft remains recoverable and the channel asks the citizen to retry that message.

## WhatsApp

Set `WHATSAPP_ALLOWED_NUMBERS` to a comma-separated list of E.164 numbers without `+`. Messages from every other number, groups, status broadcasts, and Message Yourself are ignored. The channel also accepts Baileys LIDs only when Baileys resolves them to an allowed phone number.

Baileys authentication defaults to `.data/whatsapp-auth`. On the first start, scan the terminal QR from WhatsApp > Linked Devices. Later starts restore the saved credentials. Provider message IDs are stored beside the credentials so an inbound message starts at most one Eve turn. Images and voice notes are copied to `WHATSAPP_MEDIA_DIR` before use.

Start the local gateway and Telegram tunnel:

```sh
./scripts/effi-bot.sh start
```

Useful commands from the repository root:

```sh
./scripts/effi-bot.sh status
./scripts/effi-bot.sh logs
./scripts/effi-bot.sh restart
./scripts/effi-bot.sh stop
```

Set `WHATSAPP_CONNECT=0` for builds and tests that must not open a live socket. Text, images, GPS pins, numbered Eve input requests, typing indicators, read receipts, and `/reset` are handled directly. Voice notes use Deepgram Nova-3 for transcription and Cartesia Sonic 3.5 for replies; the generated audio is converted to WhatsApp-compatible Ogg Opus before delivery.

Baileys is an unofficial hackathon transport. Use staged, non-sensitive data. This channel registers new complaints and acknowledges registration; it does not expose report or case status.
