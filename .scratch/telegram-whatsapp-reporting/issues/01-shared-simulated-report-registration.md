# 01 — Shared simulated report registration

**What to build:** A complete simulated citizen journey through the shared reporting seam: the citizen sends text, a satisfactory photo, and exact coordinates; reviews and confirms Effi's interpretation; completes simulated authentication; and receives one report ID backed by a persisted report, conversation, and evidence history. This tracer bullet establishes the channel-neutral reporting path before live platform and provider concerns are introduced.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] A fake channel can deliver text, an image, and either current GPS coordinates or a manually selected pin through the shared inbound contract.
- [x] Every inbound message and attachment reference is persisted before model processing, and platform media is represented by Effi-controlled storage metadata.
- [x] A fake vision-capable model can gather the understandable issue, accept the photo, confirm exact coordinates, and present a complete interpretation.
- [x] The citizen can correct the interpretation and must explicitly confirm it before submission preparation begins.
- [x] Confirmation creates an immutable pending submission and returns a short-lived, single-use simulated authentication link.
- [x] Successful simulated authentication creates exactly one report and returns its report ID through the fake channel.
- [x] The persisted result includes the report, original conversation, attachment references, accepted primary image evidence, exact coordinates, and authenticated citizen identity.
- [x] A new complaint after registration receives a fresh, memory-isolated agent session.
- [x] The complete journey is covered at the highest behavioral seam without assertions against private framework or provider internals.
