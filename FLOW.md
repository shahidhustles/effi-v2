# Flow

1. Telegram or WhatsApp normalizes and stages an inbound event.
2. `ConvexReportStore` derives an opaque scope and calls `reporting:resumeOrAppendInbound` before a model turn.
3. The transactional mutation resumes one eligible draft or creates an isolated draft, deduplicates the provider message, then returns bounded durable context.
4. Voice transcription, evidence inspection, submission preparation, and registration synchronize their changed draft state before their handler returns.
