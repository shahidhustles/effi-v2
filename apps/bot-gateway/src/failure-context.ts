const secretPattern = /\b(?:api[_ -]?key|token|authorization|password|secret)\b\s*(?:=|:)?\s*\S+/giu;

/** Safe, actionable context for operational logs; never send this to a citizen. */
export const failureContext = (operation: string, error: unknown): { operation: string; error: string } => ({
  operation,
  error: (error instanceof Error ? error.message : String(error))
    .replace(secretPattern, "[redacted]")
    .slice(0, 240),
});
