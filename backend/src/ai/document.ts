import { createHash } from 'node:crypto';
import { Document } from '@langchain/core/documents';
import { aiConfig } from './config';

export type SourceType = 'booking' | 'feedback' | 'eventType' | 'contact' | 'panel' | 'position';

export type RagMetadata = {
  sourceType: SourceType;
  sourceId: string;
  userId?: number;
  authorizedUsers: Record<string, true>;
  authorizedUserVersions: Record<string, number>;
  title: string;
  createdAt?: string;
  date?: string;
  meetingId?: number;
  feedbackId?: number;
  eventTypeId?: number;
  contactId?: number;
  panelId?: number;
  positionId?: number;
  indexSourceType?: string;
  indexSourceId?: string;
  parentSourceType?: string;
  parentSourceId?: string;
  contentHash: string;
};

export type NormalizedSourceDocument = {
  sourceType: SourceType;
  sourceId: string;
  content: string;
  metadata: Omit<RagMetadata, 'contentHash'>;
};

export function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableUuid(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const compact = hex.join('');
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function toBaseDocuments(source: NormalizedSourceDocument[]): Document<RagMetadata>[] {
  return source
    .map((item) => {
      const normalized = cleanText(item.content);
      if (!normalized) return null;

      const contentHash = sha256(JSON.stringify({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        content: normalized,
        metadata: item.metadata,
      }));

      return new Document<RagMetadata>({
        pageContent: normalized,
        metadata: {
          ...item.metadata,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          contentHash,
        },
      });
    });
}

export async function splitDocuments(documents: Document[]): Promise<Document[]> {
  const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: aiConfig.chunkSize,
    chunkOverlap: aiConfig.chunkOverlap,
    separators: ['\n\n', '\n', '. ', ', ', ' ', ''],
  });
  return splitter.splitDocuments(documents);
}
