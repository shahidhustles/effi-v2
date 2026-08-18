# 07 — Provider fallback and recovery

**What to build:** Graceful recovery across model, speech, media, storage, and delivery failures so citizens retain already supplied evidence and receive a usable response whenever a configured fallback is available.

**Blocked by:** 05 — Multilingual voice reporting; 06 — Steering, resumption, and duplicate protection.

**Status:** ready-for-agent

- [ ] Transient media download, storage, speech, model, and delivery failures receive at most one automatic retry.
- [ ] AI Gateway uses the contributor Muse Spark model first and falls back to Gemini only for provider errors, timeouts, or rate limits.
- [ ] The handled model ID is recorded for every turn without exposing provider details to the citizen.
- [ ] A model fallback preserves the same agent instructions, image input, conversation history, and submission-tool contract.
- [ ] Text-to-speech uses Sarvam Bulbul first, Cartesia Sonic 3 second, and a text response when both fail.
- [ ] Hindi is used for the voice recovery prompt when speech cannot be understood; if Hindi synthesis also fails, the citizen receives the prompt as text.
- [ ] Successfully received text, images, audio, and coordinates remain persisted after downstream provider failures and are not requested again unnecessarily.
- [ ] When automatic recovery is exhausted, Effi returns a short instruction naming only the content the citizen must retry.
- [ ] Consequential writes are never blindly retried and remain idempotent under provider and callback failures.
- [ ] Logs retain actionable internal failure context without leaking credentials, citizen content, or provider diagnostics into bot responses.

