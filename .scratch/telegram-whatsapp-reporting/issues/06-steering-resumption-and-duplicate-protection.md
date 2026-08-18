# 06 — Steering, resumption, and duplicate protection

**What to build:** A resilient conversation path in which rapid citizen messages converge into one coherent turn, interrupted complaints resume in their original channel, and retries from platforms or authentication cannot duplicate messages, submissions, or reports.

**Blocked by:** 02 — Live Telegram text reporting; 03 — WhatsApp text-reporting parity.

**Status:** ready-for-agent

- [ ] Each inbound message is durably persisted before it can steer an active Eve turn.
- [ ] A rapid text, photo, and location burst cancels obsolete work and produces one coherent response based on the complete persisted conversation.
- [ ] Streaming delivery is disabled so partial output from a cancelled turn never reaches Telegram or WhatsApp.
- [ ] No consequential submission tool can run while the report remains unconfirmed and steerable.
- [ ] Explicit confirmation locks the conversation; messages received while authentication is pending return a deterministic instruction rather than steering the submission.
- [ ] An incomplete report resumes from the same Eve session and persisted conversation when the citizen returns through its original channel.
- [ ] A report never resumes through a different channel or inherits details from an older registered complaint.
- [ ] Repeated Telegram and WhatsApp provider message IDs are ignored without duplicating persisted messages or model turns.
- [ ] Pending submission and authentication callback idempotency keys prevent duplicate reports under retries or concurrent delivery.
- [ ] Separate citizens and conversations continue concurrently without sharing report state.

