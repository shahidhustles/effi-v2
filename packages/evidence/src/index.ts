import type { EvidenceId } from "@effi/domain";

export type EvidenceKind = "image" | "audio" | "location" | "text";
export type SourceReference = { messageId: string; timestamp?: string; mediaOffsetSeconds?: number };
export type EvidenceItem = { id: EvidenceId; kind: EvidenceKind; storageKey?: string; source: SourceReference; capturedAt: string };
export type EvidenceSufficiency = { isSufficient: boolean; missing: readonly ("issue" | "location" | "usable_evidence")[] };
