import type { Document } from '@langchain/core/documents';

export type AiIntent = 'RAG' | 'DATABASE' | 'HYBRID' | 'CLARIFICATION' | 'OUT_OF_SCOPE';

export type AiOperation =
  | 'meeting_count'
  | 'meeting_list'
  | 'meeting_lookup'
  | 'last_meeting'
  | 'meeting_prep'
  | 'availability'
  | 'cancel_meeting'
  | 'reschedule_meeting'
  | 'unknown';

export type Citation = {
  sourceType: string;
  sourceId: string;
  title: string;
  date?: string;
};

export type RetrievedDocument = {
  document: Document;
  score: number;
};

export type RetrievedContext = {
  pageContent: string;
  metadata: Record<string, unknown>;
  score: number;
};

export type AiPendingAction = {
  type: 'cancel_meeting';
  bookingId: number;
  confirmationText: string;
};

export type AiResponse = {
  answer: string;
  citations: Citation[];
  intent: AiIntent;
  operation: AiOperation;
  pendingAction?: AiPendingAction;
};

export type AiQueryInput = {
  userId: number;
  role: 'ADMIN' | 'INTERVIEWER';
  query: string;
  context?: {
    meetingId?: number;
    date?: string;
  };
};
