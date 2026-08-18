# 05 — Multilingual voice reporting

**What to build:** A complete voice-first complaint journey in Telegram and WhatsApp. Effi transcribes Indian-language voice notes, replies by voice in the citizen's latest language, follows language and modality switches, and completes the same authenticated report path as text reporting.

**Blocked by:** 02 — Live Telegram text reporting; 03 — WhatsApp text-reporting parity.

**Status:** ready-for-agent

- [ ] Telegram and WhatsApp voice notes are stored and transcribed through Sarvam Saaras v3 before the model turn.
- [ ] A normal voice-note input receives a voice-note response only, in the detected spoken language.
- [ ] A normal text input receives a text response in that input's language.
- [ ] The latest input independently controls both language and modality, allowing mid-conversation switches without starting a new report.
- [ ] Unintelligible speech or failed language detection produces a Hindi voice request to try again rather than a guessed transcript.
- [ ] The report can combine voice description, mandatory image evidence, and current GPS or a manually selected pin.
- [ ] A voice user receives the final interpretation in both text and voice, while a text user receives it in text.
- [ ] Corrections and explicit confirmation work through voice as well as text and available channel actions.
- [ ] Sarvam Bulbul v3 produces the primary voice response in every language claimed for the demo.
- [ ] Representative staged samples establish the actual supported demo-language set; provider marketing lists alone do not become product claims.
- [ ] The voice journey authenticates, creates exactly one report, and returns its report ID through both channels.

## Comments

- Implemented the shared voice contract and Sarvam adapter. Telegram stages raw `voice`/`audio` files through Eve's Bot API helpers; WhatsApp consumes Chat SDK/Baileys audio attachments via `fetchData`, copies them into Effi storage, persists a pending message, then runs Saaras v3 before dispatch. Bulbul v3 returns MP3 audio for Telegram multipart delivery and Chat SDK audio delivery.
- Latest-turn language and modality are tracked independently. Hindi recovery never forwards an unintelligible or language-unknown transcript; text is used only when recovery audio or ordinary synthesis cannot be delivered. Authentication-pending WhatsApp messages are persisted but cannot steer the report.
- Deterministic contract coverage now includes Saaras/Bulbul request and response handling, Telegram voice staging/delivery, WhatsApp audio staging, language detection, pending-to-transcribed enrichment, recovery-without-guessed-text, and latest-turn switching. `pnpm check` passes.
- Live Sarvam credentials and representative non-sensitive audio fixtures were not available in this workspace, so the demo-language checklist remains open until real end-to-end samples establish the claimed language set. Cartesia fallback and automatic provider retries remain ticket 07 scope. The current Baileys adapter's public outbound audio path does not expose a native `ptt` flag, so WhatsApp delivery is a playable audio attachment rather than a guaranteed voice-note bubble.
