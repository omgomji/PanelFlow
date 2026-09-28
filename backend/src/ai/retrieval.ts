import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { PoolConfig } from 'pg';
import type { Document } from '@langchain/core/documents';
import { aiConfig } from './config';
import type { Citation, RetrievedDocument } from './types';
import { prisma } from '../config/prisma';
import { buildAuthorizedMetadataFilter } from './auth-filter';
import { isProviderLimitError, markGeminiUnavailable } from './provider';

let vectorStorePromise: Promise<PGVectorStore> | null = null;

function pgConfig(): PoolConfig {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for AI vector retrieval.');
  }

  return {
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: aiConfig.requestTimeoutMs,
  };
}

export async function getVectorStoreForMaintenance(): Promise<PGVectorStore> {
  aiConfig.requireEmbeddingKey();
  if (!vectorStorePromise) {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: aiConfig.embeddingModel,
      outputDimensionality: aiConfig.embeddingDimensions,
      maxRetries: 2,
      maxConcurrency: 4,
    });

    vectorStorePromise = PGVectorStore.initialize(embeddings, {
      postgresConnectionOptions: pgConfig(),
      tableName: 'rag_chunks',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'content',
        metadataColumnName: 'metadata',
      },
      distanceStrategy: 'cosine',
      skipInitializationCheck: true,
    } as any).catch((error) => {
      vectorStorePromise = null;
      throw error;
    });
  }
  return vectorStorePromise;
}

export async function indexDocuments(
  documents: Document[],
  ids: string[],
): Promise<void> {
  if (!documents.length) return;
  const store = await getVectorStoreForMaintenance();
  await store.addDocuments(documents, { ids });
}

export async function deleteSourceVectors(sourceType: string, sourceId: string): Promise<void> {
  if (!aiConfig.hasGeminiKey()) return;
  const store = await getVectorStoreForMaintenance();
  await store.delete({ filter: { sourceType, sourceId } });
}

export async function deleteSourceVectorsByParent(parentSourceType: string, parentSourceId: string): Promise<void> {
  if (!aiConfig.hasGeminiKey()) return;
  const store = await getVectorStoreForMaintenance();
  await store.delete({ filter: { parentSourceType, parentSourceId } });
}

async function liveSourceKeys(sourceKeys: Array<{ sourceType: string; sourceId: string }>) {
  if (!sourceKeys.length) return new Set<string>();
  const liveSources = await prisma.ragSource.findMany({
    where: { OR: sourceKeys.map((key) => ({ sourceType: key.sourceType, sourceId: key.sourceId })) },
    select: { sourceType: true, sourceId: true },
  });
  return new Set(liveSources.map((row) => `${row.sourceType}:${row.sourceId}`));
}

async function retrieveLexicalAuthorized(
  query: string,
  userId: number,
  role: 'ADMIN' | 'INTERVIEWER',
): Promise<RetrievedDocument[]> {
  const user = role === 'INTERVIEWER'
    ? await prisma.user.findUnique({ where: { id: userId }, select: { aiAccessVersion: true } })
    : null;
  if (role === 'INTERVIEWER' && !user) return [];

  const limit = aiConfig.topK;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const rows = role === 'ADMIN'
    ? await prisma.$queryRaw<Array<{ id: string; content: string; metadata: Record<string, unknown>; rank: number }>>`
        SELECT c.id, c.content, c.metadata,
          GREATEST(
            ts_rank_cd(to_tsvector('simple', c.content), websearch_to_tsquery('simple', ${trimmedQuery})),
            CASE WHEN lower(c.content) LIKE lower('%' || ${trimmedQuery} || '%') THEN 0.25 ELSE 0 END
          ) AS rank
        FROM rag_chunks c
        JOIN rag_sources s
          ON s.source_type = c.metadata->>'indexSourceType'
         AND s.source_id = c.metadata->>'indexSourceId'
        WHERE to_tsvector('simple', c.content) @@ websearch_to_tsquery('simple', ${trimmedQuery})
           OR lower(c.content) LIKE lower('%' || ${trimmedQuery} || '%')
        ORDER BY rank DESC, c.id
        LIMIT ${limit}`
    : await prisma.$queryRaw<Array<{ id: string; content: string; metadata: Record<string, unknown>; rank: number }>>`
        SELECT c.id, c.content, c.metadata,
          GREATEST(
            ts_rank_cd(to_tsvector('simple', c.content), websearch_to_tsquery('simple', ${trimmedQuery})),
            CASE WHEN lower(c.content) LIKE lower('%' || ${trimmedQuery} || '%') THEN 0.25 ELSE 0 END
          ) AS rank
        FROM rag_chunks c
        JOIN rag_sources s
          ON s.source_type = c.metadata->>'indexSourceType'
         AND s.source_id = c.metadata->>'indexSourceId'
        WHERE (c.metadata @> jsonb_build_object('authorizedUsers', jsonb_build_object(${String(userId)}, true)))
          AND (c.metadata @> jsonb_build_object('authorizedUserVersions', jsonb_build_object(${String(userId)}, ${user!.aiAccessVersion})))
          AND (to_tsvector('simple', c.content) @@ websearch_to_tsquery('simple', ${trimmedQuery})
            OR lower(c.content) LIKE lower('%' || ${trimmedQuery} || '%'))
        ORDER BY rank DESC, c.id
        LIMIT ${limit}`;

  return rows.map((row) => ({
    document: {
      pageContent: row.content,
      metadata: row.metadata,
    } as Document,
    score: Math.max(0, Math.min(1, Number(row.rank) || 0)),
  }));
}

export async function retrieveAuthorized(
  query: string,
  userId: number,
  role: 'ADMIN' | 'INTERVIEWER',
): Promise<RetrievedDocument[]> {
  let metadataFilter = undefined;
  if (role !== 'ADMIN') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { aiAccessVersion: true } });
    if (!user) return [];
    metadataFilter = buildAuthorizedMetadataFilter(userId, role, user.aiAccessVersion);
  }

  try {
    const store = await getVectorStoreForMaintenance();
    const results = await store.similaritySearchWithScore(query, aiConfig.topK, metadataFilter as any);
    const candidates = results
      .map(([document, distance]) => ({
        document,
        score: Math.max(0, Math.min(1, 1 - Number(distance))),
      }))
      .filter(({ score }) => score >= aiConfig.minSimilarity);

    if (!candidates.length) return [];

    const sourceKeys = candidates.map(({ document }) => {
      const metadata = document.metadata as Record<string, unknown>;
      return {
        sourceType: String(metadata.indexSourceType || metadata.sourceType || ''),
        sourceId: String(metadata.indexSourceId || metadata.sourceId || ''),
      };
    }).filter((key) => key.sourceType && key.sourceId);

    if (!sourceKeys.length) return [];

    const liveKeys = await liveSourceKeys(sourceKeys);
    return candidates
      .filter(({ document }) => {
        const metadata = document.metadata as Record<string, unknown>;
        const key = `${String(metadata.indexSourceType || metadata.sourceType || '')}:${String(metadata.indexSourceId || metadata.sourceId || '')}`;
        return liveKeys.has(key);
      })
      .slice(0, aiConfig.topK);
  } catch (error) {
    // Groq does not expose a LangChain embeddings integration suitable for this
    // vector store. When Gemini embedding quota is exhausted (or Gemini is not
    // configured for a chat-only deployment), fall back to PostgreSQL full-text
    // retrieval while retaining the same authorization predicates.
    if (isProviderLimitError(error) || !aiConfig.hasGeminiKey()) {
      if (isProviderLimitError(error)) markGeminiUnavailable(error);
      console.warn('[ai] vector retrieval unavailable; using PostgreSQL lexical fallback');
      return retrieveLexicalAuthorized(query, userId, role);
    }
    throw error;
  }
}

export function citationsFromDocuments(documents: RetrievedDocument[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const item of documents) {
    const metadata = item.document.metadata as Record<string, unknown>;
    const sourceType = String(metadata.sourceType || 'source');
    const sourceId = String(metadata.sourceId || '');
    if (!sourceId) continue;
    const key = `${sourceType}:${sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      sourceType,
      sourceId,
      title: String(metadata.title || `${sourceType} ${sourceId}`),
      date: metadata.date ? String(metadata.date) : undefined,
    });
  }
  return citations;
}

export async function closeVectorStore(): Promise<void> {
  if (vectorStorePromise) {
    const store = await vectorStorePromise.catch(() => null);
    await store?.end();
    vectorStorePromise = null;
  }
}
