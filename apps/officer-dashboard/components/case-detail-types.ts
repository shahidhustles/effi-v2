import type { CaseCategory, CaseChannel, CasePriority, CaseStatus } from "./case-inbox-state";

export type CaseLocation = {
  source: "current_gps" | "selected_pin";
  latitude: number;
  longitude: number;
};

export type CaseCitation =
  | { kind: "transcript_message"; sourceMessageId: string; explanation: string }
  | { kind: "accepted_evidence"; attachmentId: string; explanation: string };

export type CaseEvidence = {
  attachmentId: string;
  storageKey: string;
  storageId?: string;
  url: string | null;
  mediaType: string;
  sourceMessageId: string;
};

export type TranscriptAttachment = {
  attachmentId: string;
  storageKey: string;
  storageId?: string;
  mediaType: string;
  accepted: boolean;
};

export type TranscriptContent =
  | {
      kind: "citizen_message";
      text?: string;
      voiceTranscript?: string;
      action?: "confirm" | "edit" | "help" | "cancel";
      location?: CaseLocation;
      attachments: TranscriptAttachment[];
    }
  | { kind: "effi_message"; text: string }
  | {
      kind: "input_request";
      text: string;
      requestId: string;
      prompt: string;
      options: { id: string; label: string }[];
      allowFreeform: boolean;
    };

export type CaseTranscriptMessage = {
  sourceMessageId: string;
  sequence: number;
  direction: "citizen" | "effi";
  occurredAt: number;
  content: TranscriptContent;
};

export type CaseDetail = {
  case: {
    reportId: string;
    reportNumber: string;
    summary: string;
    category: CaseCategory;
    location: CaseLocation;
    reportedAt: number;
    submittedAt: number;
    recommendedPriority: CasePriority;
    currentPriority: CasePriority;
    priorityReasons: string[];
    citations: CaseCitation[];
    acceptedEvidence: CaseEvidence[];
    channel: CaseChannel;
    conversationId: string;
    status: CaseStatus;
  };
  transcript: CaseTranscriptMessage[];
};
