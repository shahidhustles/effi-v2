# Decisions

- Ticket 09 indexes only a keyed HMAC scope made from channel, sender, and DM conversation. This preserves stable resume while keeping raw provider identities out of lookup indexes.
- Convex owns independent draft and message documents, avoiding an unbounded transcript array on the draft document.
- Every agent-side mutation that changes transcript, evidence, or phase mirrors the bounded draft snapshot to Convex before returning tool output.
