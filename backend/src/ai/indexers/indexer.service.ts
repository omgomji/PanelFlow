import { prisma } from '../../config/prisma';
import { sha256, stableUuid, splitDocuments, toBaseDocuments, cleanText, type NormalizedSourceDocument } from '../document';
import { deleteSourceVectors, deleteSourceVectorsByParent, indexDocuments } from '../retrieval';
import type { SourceType } from '../document';

type SourceEnvelope = {
  sourceType: SourceType;
  sourceId: string;
  docs: NormalizedSourceDocument[];
};

async function withCurrentUserVersions(docs: NormalizedSourceDocument[]): Promise<NormalizedSourceDocument[]> {
  const ids = Array.from(new Set(docs.flatMap((doc) => Object.keys(doc.metadata.authorizedUsers).map(Number))));
  if (!ids.length) return docs;
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, aiAccessVersion: true } });
  const versions = Object.fromEntries(users.map((user) => [String(user.id), user.aiAccessVersion]));
  return docs.map((doc) => ({
    ...doc,
    metadata: { ...doc.metadata, authorizedUserVersions: versions },
  }));
}

function userAccessMap(ids: number[]): Record<string, true> {
  return Object.fromEntries(ids.map((id) => [String(id), true])) as Record<string, true>;
}

function metadataHashKey(docs: NormalizedSourceDocument[]): string {
  return sha256(JSON.stringify(docs));
}

function indexIds(source: SourceEnvelope, chunks: Awaited<ReturnType<typeof splitDocuments>>): string[] {
  return chunks.map((chunk, index) => stableUuid(`${source.sourceType}:${source.sourceId}:${metadataHashKey(source.docs)}:${index}`));
}

async function persistIndexState(source: SourceEnvelope, chunkCount: number, contentHash: string, lastError?: string) {
  await prisma.ragSource.upsert({
    where: { sourceType_sourceId: { sourceType: source.sourceType, sourceId: source.sourceId } },
    update: {
      contentHash,
      indexVersion: 1,
      chunkCount,
      indexedAt: lastError ? undefined : new Date(),
      lastError: lastError ?? null,
      updatedAt: new Date(),
    },
    create: {
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      contentHash,
      indexVersion: 1,
      chunkCount,
      indexedAt: lastError ? null : new Date(),
      lastError: lastError ?? null,
    },
  });
}

export async function indexSource(source: SourceEnvelope): Promise<{ chunkCount: number; skipped: boolean }> {
  const normalizedDocs = await withCurrentUserVersions(
    source.docs
      .map((doc) => ({
        ...doc,
        content: cleanText(doc.content),
        metadata: {
          ...doc.metadata,
          indexSourceType: source.sourceType,
          indexSourceId: source.sourceId,
        },
      }))
      .filter((doc) => doc.content)
  );
  if (!normalizedDocs.length) {
    await deleteSourceVectors(source.sourceType, source.sourceId);
    await persistIndexState(source, 0, metadataHashKey([]));
    return { chunkCount: 0, skipped: false };
  }

  const contentHash = metadataHashKey(normalizedDocs);
  const existing = await prisma.ragSource.findUnique({
    where: { sourceType_sourceId: { sourceType: source.sourceType, sourceId: source.sourceId } },
    select: { contentHash: true, chunkCount: true },
  });

  if (existing?.contentHash === contentHash) {
    return { chunkCount: existing.chunkCount, skipped: true };
  }

  try {
    const baseDocs = toBaseDocuments(normalizedDocs);
    const chunks = await splitDocuments(baseDocs);
    const ids = indexIds({ ...source, docs: normalizedDocs }, chunks);

    await deleteSourceVectors(source.sourceType, source.sourceId);
    if (chunks.length) {
      await indexDocuments(chunks, ids);
    }
    await persistIndexState(source, chunks.length, contentHash);
    return { chunkCount: chunks.length, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await persistIndexState(source, 0, contentHash, message.slice(0, 500));
    throw error;
  }
}

async function bookingSource(bookingId: number): Promise<SourceEnvelope | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      eventType: { select: { id: true, title: true, duration: true, description: true, userId: true } },
      panel: {
        include: {
          position: { select: { id: true, title: true, createdById: true } },
          interviewers: { select: { userId: true } },
        },
      },
      hosts: { select: { userId: true } },
      feedback: {
        include: { interviewer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!booking) return null;

  const isPanel = Boolean(booking.panelId);
  const panelUsers = isPanel
    ? Array.from(new Set([
        booking.panel?.position.createdById ?? -1,
        ...(booking.panel?.interviewers.map((row) => row.userId) ?? []),
        ...booking.hosts.map((row) => row.userId),
      ].filter((id) => id > 0)))
    : [];
  const authorizedUserIds = isPanel
    ? panelUsers
    : Array.from(new Set([
        booking.eventType?.userId,
        booking.userId,
        ...booking.hosts.map((host) => host.userId),
      ].filter((id): id is number => typeof id === 'number' && id > 0)));

  const title = booking.panel?.title || booking.eventType?.title || 'Meeting';
  const participantLines = [
    `Invitee: ${booking.inviteeName} <${booking.inviteeEmail}>`,
    booking.panel ? `Panel: ${booking.panel.title}` : undefined,
    booking.panel?.position ? `Position: ${booking.panel.position.title}` : undefined,
    booking.hosts.length ? `Interviewers: ${booking.hosts.map((host) => String(host.userId)).join(', ')}` : undefined,
  ].filter(Boolean);

  const meetingText = [
    `Meeting: ${title}`,
    `Date: ${booking.startTime.toISOString()}`,
    `Status: ${booking.status}`,
    `Duration: ${booking.durationMinutes} minutes`,
    ...participantLines,
    booking.inviteeNotes ? `Invitee notes: ${booking.inviteeNotes}` : undefined,
    booking.eventType?.description ? `Meeting description: ${booking.eventType.description}` : undefined,
  ].filter(Boolean).join('\n');

  const docs: NormalizedSourceDocument[] = [{
    sourceType: 'booking',
    sourceId: String(booking.id),
    content: meetingText,
    metadata: {
      sourceType: 'booking',
      sourceId: String(booking.id),
      userId: booking.eventType?.userId ?? booking.userId ?? undefined,
      authorizedUsers: userAccessMap(authorizedUserIds),
      authorizedUserVersions: {},
      title,
      createdAt: booking.createdAt.toISOString(),
      date: booking.startTime.toISOString(),
      meetingId: booking.id,
      eventTypeId: booking.eventTypeId ?? undefined,
      panelId: booking.panelId ?? undefined,
      positionId: booking.panel?.position.id,
    },
  }];

  const submitted = new Set(booking.feedback.map((row) => row.interviewerId));
  const feedbackViewerPool = isPanel ? panelUsers : booking.hosts.map((host) => host.userId);
  const feedbackAuthorizedUserIds = Array.from(new Set(feedbackViewerPool.filter((id) => submitted.has(id))));

  for (const feedback of booking.feedback) {
    docs.push({
      sourceType: 'feedback',
      sourceId: String(feedback.id),
      content: [
        `Feedback for ${title}`,
        `Interviewer: ${feedback.interviewer.name}`,
        `Recommendation: ${feedback.recommendation}`,
        feedback.notes ? `Notes: ${feedback.notes}` : undefined,
      ].filter(Boolean).join('\n'),
      metadata: {
        sourceType: 'feedback',
        sourceId: String(feedback.id),
        parentSourceType: 'booking',
        parentSourceId: String(booking.id),
        authorizedUsers: userAccessMap(feedbackAuthorizedUserIds),
        authorizedUserVersions: {},
        title: `Feedback — ${feedback.interviewer.name} — ${title}`,
        createdAt: feedback.createdAt.toISOString(),
        date: booking.startTime.toISOString(),
        meetingId: booking.id,
        feedbackId: feedback.id,
      },
    });
  }

  return { sourceType: 'booking', sourceId: String(booking.id), docs };
}

async function eventTypeSource(id: number): Promise<SourceEnvelope | null> {
  const item = await prisma.eventType.findUnique({ where: { id } });
  if (!item) return null;
  return {
    sourceType: 'eventType', sourceId: String(id), docs: [{
      sourceType: 'eventType', sourceId: String(id),
      content: [`Event type: ${item.title}`, `Slug: ${item.slug}`, `Duration: ${item.duration} minutes`, `Active: ${item.isActive}`, item.description ? `Description: ${item.description}` : undefined].filter(Boolean).join('\n'),
      metadata: { sourceType: 'eventType', sourceId: String(id), userId: item.userId, authorizedUsers: userAccessMap([item.userId]), authorizedUserVersions: {}, title: item.title, eventTypeId: item.id },
    }],
  };
}

async function contactSource(id: number): Promise<SourceEnvelope | null> {
  const item = await prisma.contact.findUnique({ where: { id } });
  if (!item) return null;
  return {
    sourceType: 'contact', sourceId: String(id), docs: [{
      sourceType: 'contact', sourceId: String(id),
      content: [`Contact: ${item.name}`, `Email: ${item.email}`, item.phone ? `Phone: ${item.phone}` : undefined, item.note ? `Note: ${item.note}` : undefined].filter(Boolean).join('\n'),
      metadata: { sourceType: 'contact', sourceId: String(id), userId: item.userId, authorizedUsers: userAccessMap([item.userId]), authorizedUserVersions: {}, title: item.name, contactId: item.id, createdAt: item.createdAt.toISOString() },
    }],
  };
}

async function positionSource(id: number): Promise<SourceEnvelope | null> {
  const item = await prisma.position.findUnique({
    where: { id },
    include: { panels: { include: { interviewers: { select: { userId: true } } } } },
  });
  if (!item) return null;
  const authorizedUserIds = Array.from(new Set([item.createdById, ...item.panels.flatMap((panel) => panel.interviewers.map((row) => row.userId))]));
  return {
    sourceType: 'position', sourceId: String(id), docs: [{
      sourceType: 'position', sourceId: String(id),
      content: [`Position: ${item.title}`, `Status: ${item.status}`, item.description ? `Description: ${item.description}` : undefined].filter(Boolean).join('\n'),
      metadata: { sourceType: 'position', sourceId: String(id), userId: item.createdById, authorizedUsers: userAccessMap(authorizedUserIds), authorizedUserVersions: {}, title: item.title, positionId: item.id, createdAt: item.createdAt.toISOString() },
    }],
  };
}

async function panelSource(id: number): Promise<SourceEnvelope | null> {
  const item = await prisma.panel.findUnique({
    where: { id },
    include: {
      position: { select: { id: true, title: true, createdById: true } },
      interviewers: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!item) return null;
  const authorizedUserIds = Array.from(new Set([item.position.createdById, ...item.interviewers.map((row) => row.userId)]));
  return {
    sourceType: 'panel', sourceId: String(id), docs: [{
      sourceType: 'panel', sourceId: String(id),
      content: [`Panel: ${item.title}`, `Position: ${item.position.title}`, `Duration: ${item.duration} minutes`, `Interviewers: ${item.interviewers.map((row) => `${row.user.name} <${row.user.email}>`).join(', ')}`].join('\n'),
      metadata: { sourceType: 'panel', sourceId: String(id), authorizedUsers: userAccessMap(authorizedUserIds), authorizedUserVersions: {}, title: item.title, panelId: item.id, positionId: item.positionId },
    }],
  };
}

export async function indexBooking(bookingId: number) {
  const source = await bookingSource(bookingId);
  if (!source) {
    await deleteSource('booking', String(bookingId));
    return;
  }
  await deleteSourceVectorsByParent('booking', String(bookingId));
  await indexSource(source);
}

export async function indexEventType(id: number) {
  const source = await eventTypeSource(id);
  if (source) await indexSource(source);
}

export async function indexContact(id: number) {
  const source = await contactSource(id);
  if (source) await indexSource(source);
}

export async function indexPosition(id: number) {
  const source = await positionSource(id);
  if (source) await indexSource(source);
}

export async function indexPanel(id: number) {
  const source = await panelSource(id);
  if (source) await indexSource(source);
}

export async function deleteSource(sourceType: string, sourceId: string) {
  try {
    await deleteSourceVectors(sourceType, sourceId);
    if (sourceType === 'booking') {
      await deleteSourceVectorsByParent('booking', sourceId);
    }
  } catch (error) {
    console.error('[ai] vector delete failed', { sourceType, sourceId, error: error instanceof Error ? error.message : String(error) });
  }
  await prisma.ragSource.deleteMany({ where: { sourceType, sourceId } });
}

export async function reindexAll(): Promise<{ sources: number; chunks: number; failures: number }> {
  let sources = 0;
  let chunks = 0;
  let failures = 0;

  const bookings = await prisma.booking.findMany({ select: { id: true } });
  for (const row of bookings) {
    try { const source = await bookingSource(row.id); if (source) { const result = await indexSource(source); sources++; chunks += result.chunkCount; } }
    catch (error) { failures++; console.error('[ai] booking index failed', { id: row.id, error: error instanceof Error ? error.message : String(error) }); }
  }

  const [eventTypes, contacts, positions, panels] = await Promise.all([
    prisma.eventType.findMany({ select: { id: true } }),
    prisma.contact.findMany({ select: { id: true } }),
    prisma.position.findMany({ select: { id: true } }),
    prisma.panel.findMany({ select: { id: true } }),
  ]);

  for (const collection of [eventTypes, contacts, positions, panels]) {
    for (const row of collection) {
      try {
        const source = collection === eventTypes ? await eventTypeSource(row.id)
          : collection === contacts ? await contactSource(row.id)
          : collection === positions ? await positionSource(row.id)
          : await panelSource(row.id);
        if (source) { const result = await indexSource(source); sources++; chunks += result.chunkCount; }
      } catch (error) { failures++; console.error('[ai] source index failed', { id: row.id, error: error instanceof Error ? error.message : String(error) }); }
    }
  }

  return { sources, chunks, failures };
}
