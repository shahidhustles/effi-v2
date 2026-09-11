# 04a - Persist two-sided report transcripts

## Goal

Every durable Telegram and WhatsApp report draft records the citizen's messages and the Effi replies that the channel delivered. Ticket 05 can then create a case from the real conversation instead of an incomplete citizen-only history.

## User flow

1. A citizen sends report details through Telegram or WhatsApp.
2. Effi asks questions, presents its interpretation, and requests confirmation.
3. The channel delivers each reply.
4. Convex appends the delivered reply to the same durable draft as the citizen message.
5. A restart can load the citizen inputs while retaining the ordered two-sided transcript for the submitted case.

## Requirements

- Persist terminal assistant messages after successful channel delivery.
- Persist structured question prompts and options after successful delivery.
- Use Eve event IDs to make replayed hook delivery idempotent.
- Give every citizen and Effi message a transactionally assigned sequence number.
- Do not feed Effi transcript rows back into inbound report-state reconstruction.
- Keep Telegram and WhatsApp on one shared transcript persistence path.

## Implementation decisions

- Add transcript direction and sequence fields to `anonymousReportMessages` and a sequence counter to `anonymousReportDrafts`.
- Add one gateway-authenticated Convex mutation for Effi transcript entries.
- Use one agent-level Eve hook for `message.completed` and `input.requested`. Eve runs channel delivery before hooks, so the database records only successfully delivered output.
- Store prompt options as structured data. Provider-specific button or numbered-list formatting remains presentation data.

## Demo / acceptance

- [ ] A Telegram report draft contains ordered citizen and Effi rows, including the final interpretation and confirmation prompt.
- [ ] A WhatsApp report draft contains the same two-sided sequence.
- [ ] Replaying one Eve event ID does not create a duplicate transcript row.
- [ ] Restarting the gateway still restores report state from citizen rows without treating Effi replies as citizen input.

## Out of scope

- Case brief and priority generation
- Officer case queries or dashboard UI
- Backfilling deleted development records
- Provider delivery receipts beyond successful channel handler completion
