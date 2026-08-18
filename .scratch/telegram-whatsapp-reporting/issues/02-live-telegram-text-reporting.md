# 02 — Live Telegram text reporting

**What to build:** The complete authenticated text-reporting journey through a real Telegram bot and the standalone Eve service. A citizen can describe an issue, submit mandatory photo evidence and coordinates, approve Effi's interpretation, authenticate, and receive the persisted report ID in Telegram.

**Blocked by:** 01 — Shared simulated report registration.

**Status:** ready-for-agent

- [ ] The standalone Eve service starts without Next.js and exposes the native Telegram channel on the configured always-on runtime.
- [ ] Telegram webhook verification rejects invalid requests and deduplicates redelivered provider message IDs.
- [ ] Telegram text, image, current-location, and manually selected pin events enter the shared reporting path without Telegram-specific domain logic.
- [ ] The configured AI Gateway model can converse, inspect the staged image, ask focused clarifications, and call submission preparation only after explicit confirmation.
- [ ] Telegram image content is copied into Effi-controlled storage before model processing and remains referenced in the original conversation.
- [ ] Current GPS coordinates and manually selected pins work; typed-address-only input cannot satisfy location completeness.
- [ ] The final interpretation supports Confirm and Edit actions plus natural-language corrections.
- [ ] The authentication link is short-lived, single-use, bound to the pending submission and Telegram conversation, and creates exactly one authenticated report.
- [ ] Telegram returns a clear acknowledgement and report ID after authentication succeeds.
- [ ] No Telegram action or natural-language request exposes report or case status.

