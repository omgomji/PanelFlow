import { describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { retrieveAuthorized } from '../ai/retrieval';
import { indexContact, indexBooking } from '../ai/indexers/indexer.service';
import { deleteSource } from '../ai/indexers/indexer.service';
import { runPanelFlowAi } from '../ai/graph';
import { createAvailabilityTool, createCancelMeetingTool } from '../ai/tools';
import { bookingsService } from '../services/bookings.service';
import { addDays } from 'date-fns';

describe.skipIf(process.env.AI_INTEGRATION_TESTS !== 'true')('PanelFlow AI integration', () => {
  async function createUser(suffix: string, role: 'ADMIN' | 'INTERVIEWER' = 'INTERVIEWER') {
    return prisma.user.create({
      data: {
        username: `ai_${suffix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        name: `AI ${suffix}`,
        email: `ai_${suffix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`,
        role,
        timezone: 'Asia/Kolkata',
      },
    });
  }

  it('retrieves relevant context and excludes another user before the LLM', async () => {
    const userA = await createUser('a');
    const userB = await createUser('b');
    const eventA = await prisma.eventType.create({ data: { userId: userA.id, title: 'A Sync', slug: `a-${Date.now()}`, duration: 30, description: 'API payment sync' } });
    const eventB = await prisma.eventType.create({ data: { userId: userB.id, title: 'B Sync', slug: `b-${Date.now()}`, duration: 30, description: 'Private deployment discussion' } });

    const relevant = await prisma.booking.create({
      data: {
        eventTypeId: eventA.id,
        userId: userA.id,
        inviteeName: 'Rahul',
        inviteeEmail: 'rahul@example.com',
        startTime: new Date('2026-10-05T10:00:00.000Z'),
        endTime: new Date('2026-10-05T10:30:00.000Z'),
        durationMinutes: 30,
        inviteeNotes: 'We discussed the payment integration API and unresolved webhook retries.',
        hosts: { create: [{ userId: userA.id, startTime: new Date('2026-10-05T10:00:00.000Z'), endTime: new Date('2026-10-05T10:30:00.000Z'), status: 'SCHEDULED' }] },
      },
    });
    const privateBooking = await prisma.booking.create({
      data: {
        eventTypeId: eventB.id,
        userId: userB.id,
        inviteeName: 'Private Client',
        inviteeEmail: 'private@example.com',
        startTime: new Date('2026-10-05T11:00:00.000Z'),
        endTime: new Date('2026-10-05T11:30:00.000Z'),
        durationMinutes: 30,
        inviteeNotes: 'Private information about a deployment incident.',
        hosts: { create: [{ userId: userB.id, startTime: new Date('2026-10-05T11:00:00.000Z'), endTime: new Date('2026-10-05T11:30:00.000Z'), status: 'SCHEDULED' }] },
      },
    });

    await Promise.all([indexBooking(relevant.id), indexBooking(privateBooking.id)]);
    const docs = await retrieveAuthorized('payment integration webhook', userA.id, 'INTERVIEWER');

    expect(docs.length).toBeGreaterThan(0);
    expect(String(docs[0].document.metadata.sourceId)).toBe(String(relevant.id));
    expect(docs.every(({ document }) => String(document.metadata.sourceId) !== String(privateBooking.id))).toBe(true);
  });

  it('keeps indexing idempotent and removes vectors when the canonical source is deleted', async () => {
    const user = await createUser('contact');
    const contact = await prisma.contact.create({ data: { userId: user.id, name: 'Acme', email: 'acme@example.com', note: 'Payment migration' } });

    await indexContact(contact.id);
    const first = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM rag_chunks WHERE metadata @> ${JSON.stringify({ indexSourceType: 'contact', indexSourceId: String(contact.id) })}::jsonb`;
    await indexContact(contact.id);
    const second = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM rag_chunks WHERE metadata @> ${JSON.stringify({ indexSourceType: 'contact', indexSourceId: String(contact.id) })}::jsonb`;
    expect(Number(first[0].count)).toBeGreaterThan(0);
    expect(Number(second[0].count)).toBe(Number(first[0].count));

    await prisma.contact.update({ where: { id: contact.id }, data: { note: 'Payment migration and webhook retries' } });
    await indexContact(contact.id);
    const updated = await prisma.$queryRaw<Array<{ content: string }>>`SELECT content FROM rag_chunks WHERE metadata @> ${JSON.stringify({ indexSourceType: 'contact', indexSourceId: String(contact.id) })}::jsonb LIMIT 1`;
    expect(updated[0].content).toContain('webhook retries');

    await prisma.contact.delete({ where: { id: contact.id } });
    await deleteSource('contact', String(contact.id));
    const remaining = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM rag_chunks WHERE metadata @> ${JSON.stringify({ indexSourceType: 'contact', indexSourceId: String(contact.id) })}::jsonb`;
    expect(Number(remaining[0].count)).toBe(0);
  });

  it('does not hallucinate on empty retrieval and returns citations on grounded answers', async () => {
    const user = await createUser('answer');
    const event = await prisma.eventType.create({ data: { userId: user.id, title: 'Architecture Review', slug: `architecture-${Date.now()}`, duration: 45 } });
    const booking = await prisma.booking.create({
      data: {
        eventTypeId: event.id,
        userId: user.id,
        inviteeName: 'Sarah',
        inviteeEmail: 'sarah@example.com',
        startTime: new Date('2026-10-06T10:00:00.000Z'),
        endTime: new Date('2026-10-06T10:45:00.000Z'),
        durationMinutes: 45,
        inviteeNotes: 'The team decided to use event-driven retries for the payment integration.',
        hosts: { create: [{ userId: user.id, startTime: new Date('2026-10-06T10:00:00.000Z'), endTime: new Date('2026-10-06T10:45:00.000Z'), status: 'SCHEDULED' }] },
      },
    });
    await indexBooking(booking.id);

    const grounded = await runPanelFlowAi({ userId: user.id, role: 'INTERVIEWER', query: 'What did we decide about payment integration retries?' });
    expect(grounded.citations.length).toBeGreaterThan(0);
    expect(grounded.answer.toLowerCase()).toContain('event');

    const empty = await runPanelFlowAi({ userId: user.id, role: 'INTERVIEWER', query: 'What happened in the Neptune launch retrospective?' });
    expect(empty.answer).toContain('I could not find relevant authorized information');
  });

  it('enforces feedback reveal gating and fails closed after access is revoked', async () => {
    const owner = await createUser('feedback-owner');
    const host = await createUser('feedback-host');
    const event = await prisma.eventType.create({
      data: { userId: owner.id, title: 'Panel Interview', slug: `feedback-${Date.now()}`, duration: 45 },
    });
    const booking = await prisma.booking.create({
      data: {
        eventTypeId: event.id,
        userId: owner.id,
        inviteeName: 'Candidate',
        inviteeEmail: 'candidate@example.com',
        startTime: new Date('2026-10-07T10:00:00.000Z'),
        endTime: new Date('2026-10-07T10:45:00.000Z'),
        durationMinutes: 45,
        hosts: {
          create: [
            { userId: owner.id, startTime: new Date('2026-10-07T10:00:00.000Z'), endTime: new Date('2026-10-07T10:45:00.000Z'), status: 'SCHEDULED' },
            { userId: host.id, startTime: new Date('2026-10-07T10:00:00.000Z'), endTime: new Date('2026-10-07T10:45:00.000Z'), status: 'SCHEDULED' },
          ],
        },
      },
    });

    await prisma.feedback.create({
      data: { bookingId: booking.id, interviewerId: host.id, recommendation: 'YES', notes: 'Strong API debugging experience.' },
    });
    await indexBooking(booking.id);

    const visibleToSubmittedHost = await retrieveAuthorized('strong API debugging recommendation', host.id, 'INTERVIEWER');
    expect(visibleToSubmittedHost.some(({ document }) => document.metadata.sourceType === 'feedback')).toBe(true);

    const revokedUser = await createUser('feedback-revoked');
    const revokedEvent = await prisma.eventType.create({
      data: { userId: owner.id, title: 'Revocation Test', slug: `revoke-${Date.now()}`, duration: 30 },
    });
    const revokedBooking = await prisma.booking.create({
      data: {
        eventTypeId: revokedEvent.id,
        userId: owner.id,
        inviteeName: 'Revocation Candidate',
        inviteeEmail: 'revoke@example.com',
        startTime: new Date('2026-10-08T10:00:00.000Z'),
        endTime: new Date('2026-10-08T10:30:00.000Z'),
        durationMinutes: 30,
        hosts: { create: [{ userId: revokedUser.id, startTime: new Date('2026-10-08T10:00:00.000Z'), endTime: new Date('2026-10-08T10:30:00.000Z'), status: 'SCHEDULED' }] },
      },
    });
    await indexBooking(revokedBooking.id);
    await prisma.bookingHost.delete({ where: { bookingId_userId: { bookingId: revokedBooking.id, userId: revokedUser.id } } });
    await prisma.user.update({ where: { id: revokedUser.id }, data: { aiAccessVersion: { increment: 1 } } });

    const afterRevocation = await retrieveAuthorized('revocation candidate', revokedUser.id, 'INTERVIEWER');
    expect(afterRevocation).toHaveLength(0);
  });

  it('routes availability and cancellation through explicit authenticated tools/services', async () => {
    const user = await createUser('tools');
    await prisma.availabilitySchedule.create({ data: { userId: user.id, timezone: 'Asia/Kolkata', days: { create: [{ dayOfWeek: 1, intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] } }] } } });
    const availability = await createAvailabilityTool(user.id).invoke({ date: '2026-10-12', durationMinutes: 30 });
    expect((availability as any).slots.length).toBeGreaterThan(0);

    const otherUser = await createUser('other');
    const event = await prisma.eventType.create({ data: { userId: otherUser.id, title: 'Other', slug: `other-${Date.now()}`, duration: 30 } });
    const booking = await prisma.booking.create({
      data: {
        eventTypeId: event.id,
        userId: otherUser.id,
        inviteeName: 'Unauthorized',
        inviteeEmail: 'unauthorized@example.com',
        startTime: addDays(new Date(), 2),
        endTime: addDays(new Date(), 2),
        durationMinutes: 30,
      },
    });
    const cancelLookup = await createCancelMeetingTool(user.id, 'INTERVIEWER', 'Asia/Kolkata').invoke({ bookingId: booking.id });
    expect((cancelLookup as any).found).toBe(false);

    await expect(bookingsService.cancel(user.id, booking.id, undefined, 'INTERVIEWER')).rejects.toThrow();
  });
});
