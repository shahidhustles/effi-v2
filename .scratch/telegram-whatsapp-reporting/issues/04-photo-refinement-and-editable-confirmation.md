# 04 — Photo refinement and editable confirmation

**What to build:** A conversational completeness loop in which every report requires a model-accepted photo, citizens receive useful guidance when an image is inadequate, and the complete interpretation remains editable until explicit confirmation freezes the submission.

**Blocked by:** 01 — Shared simulated report registration.

**Status:** ready-for-agent

**Implementation:** completed

- [x] Text or voice evidence without an accepted photo cannot reach final confirmation or create a report.
- [x] Undecodable image files fail safely at the ingress boundary and produce a focused retry request.
- [x] The conversational vision model distinguishes satisfactory, clearly unrelated or unusable, and uncertain staged images.
- [x] An unsatisfactory or uncertain image produces one concrete improvement request rather than an accusation or permanent rejection.
- [x] There is no fixed photo retry limit, and the citizen can request help or cancel the active complaint.
- [x] Every received image remains in the original conversation, while only model-accepted images appear as primary submitted evidence.
- [x] Effi asks only one focused clarification at a time for the issue, accepted photo, or coordinates.
- [x] Confirm and Edit actions work where supported, and equivalent corrections can be supplied through natural text or voice.
- [x] After each correction, Effi presents the complete updated interpretation again.
- [x] Explicit confirmation freezes the interpretation; post-confirmation messages cannot silently alter the pending submission.

## Comments

Implemented in the shared simulated report-registration seam. Ingress now validates the message envelope, records decode status, and safely normalizes malformed images; the fake vision model returns accepted/unrelated/uncertain/undecodable outcomes, retry guidance is focused, accepted evidence is separated from conversation history, and confirmation/edit/help/cancel plus voice-transcript corrections are covered by behavioral tests. Full `pnpm check` passes.
