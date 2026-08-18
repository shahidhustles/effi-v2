# 04 — Photo refinement and editable confirmation

**What to build:** A conversational completeness loop in which every report requires a model-accepted photo, citizens receive useful guidance when an image is inadequate, and the complete interpretation remains editable until explicit confirmation freezes the submission.

**Blocked by:** 01 — Shared simulated report registration.

**Status:** ready-for-agent

- [ ] Text or voice evidence without an accepted photo cannot reach final confirmation or create a report.
- [ ] Undecodable image files fail safely at the ingress boundary and produce a focused retry request.
- [ ] The conversational vision model distinguishes satisfactory, clearly unrelated or unusable, and uncertain staged images.
- [ ] An unsatisfactory or uncertain image produces one concrete improvement request rather than an accusation or permanent rejection.
- [ ] There is no fixed photo retry limit, and the citizen can request help or cancel the active complaint.
- [ ] Every received image remains in the original conversation, while only model-accepted images appear as primary submitted evidence.
- [ ] Effi asks only one focused clarification at a time for the issue, accepted photo, or coordinates.
- [ ] Confirm and Edit actions work where supported, and equivalent corrections can be supplied through natural text or voice.
- [ ] After each correction, Effi presents the complete updated interpretation again.
- [ ] Explicit confirmation freezes the interpretation; post-confirmation messages cannot silently alter the pending submission.

