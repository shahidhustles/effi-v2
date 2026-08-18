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

