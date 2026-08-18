# 08 — Cross-channel P0 acceptance

**What to build:** Final proof that the approved text, multilingual voice, switching, and reliability journeys work end to end in both Telegram and WhatsApp using staged, non-sensitive data, and that the resulting records are ready for the shared officer pipeline.

**Blocked by:** 04 — Photo refinement and editable confirmation; 05 — Multilingual voice reporting; 06 — Steering, resumption, and duplicate protection; 07 — Provider fallback and recovery.

**Status:** ready-for-agent

- [ ] The complete text journey passes in Telegram and WhatsApp: supported-language text, satisfactory photo, current GPS or manual pin, clarification, correction, confirmation, authentication, one report, and acknowledgement ID.
- [ ] The complete voice journey passes in both channels: voice replies, language switching, modality switching, mandatory photo, exact coordinates, text-plus-voice final confirmation, authentication, and acknowledgement.
- [ ] The reliability journey passes in both channels: burst steering, duplicate suppression, interrupted-session resumption, preserved evidence after provider failure, and one report under repeated authentication callbacks.
- [ ] Stored reports from both channels share the same domain representation, Convex persistence path, evidence model, authenticated identity model, and downstream officer case path.
- [ ] Original conversations retain every message and attachment reference, while primary evidence includes only accepted images.
- [ ] Typed addresses and landmarks do not satisfy location completeness.
- [ ] No messaging-channel status action or natural-language status query exposes report or case progress.
- [ ] The demonstrated language list is supported by recorded end-to-end evidence across transcription, model comprehension, response generation, and synthesis.
- [ ] The contributor-tier model receives only staged, non-sensitive demo inputs, and the launch requirement to use a non-contributor model remains explicit.
- [ ] The Baileys path is documented and demonstrated as a replaceable hackathon transport rather than a production WhatsApp commitment.
- [ ] Relevant type checks, tests, lint checks, and builds pass, with any unrelated pre-existing failures identified separately.

