import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../config/prisma';

describe('Public Bookings Endpoints', () => {
  let host: any;
  let eventType: any;

  beforeEach(async () => {
    // Create a host user
    host = await prisma.user.create({
      data: {
        name: 'Booking Host',
        email: 'host@example.com',
        passwordHash: 'hash',
        role: 'ADMIN',
        username: 'bookinghost',
      },
    });

    // Create an event type
    eventType = await prisma.eventType.create({
      data: {
        userId: host.id,
        title: '30 Min Chat',
        slug: '30-min',
        duration: 30,
        isActive: true,
      },
    });

    // Create a schedule for the host
    await prisma.availabilitySchedule.create({
      data: {
        userId: host.id,
        timezone: 'UTC',
        days: {
          create: [
            {
              dayOfWeek: 1,
              intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] },
            },
            {
              dayOfWeek: 2,
              intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] },
            },
            {
              dayOfWeek: 3,
              intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] },
            },
            {
              dayOfWeek: 4,
              intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] },
            },
            {
              dayOfWeek: 5,
              intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] },
            },
          ],
        },
      },
    });
  });

  // Find the next Monday
  const getNextMonday = (date: Date) => {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + ((1 + 7 - d.getUTCDay()) % 7 || 7));
    d.setUTCHours(10, 0, 0, 0); // 10:00 AM UTC
    return d.toISOString();
  };

  it('should successfully create a public booking', async () => {
    const nextMonday = getNextMonday(new Date());
    const bookingData = {
      inviteeName: 'John Doe',
      inviteeEmail: 'john@example.com',
      startTime: nextMonday,
    };

    const res = await request(app)
      .post(`/api/public/${host.username}/${eventType.slug}/book`)
      .send(bookingData);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.inviteeName).toBe('John Doe');
  });

  it('should prevent double booking in the same slot', async () => {
    const nextMonday = getNextMonday(new Date());
    // Create first booking manually
    const bookingData = {
      inviteeName: 'Alice',
      inviteeEmail: 'alice@example.com',
      startTime: nextMonday,
    };

    // First booking
    const res1 = await request(app)
      .post(`/api/public/${host.username}/${eventType.slug}/book`)
      .send(bookingData);

    expect(res1.status).toBe(201);

    // Second booking for the exact same time
    const res2 = await request(app)
      .post(`/api/public/${host.username}/${eventType.slug}/book`)
      .send({
        inviteeName: 'Bob',
        inviteeEmail: 'bob@example.com',
        startTime: nextMonday,
      });

    expect(res2.status).toBe(409); // ConflictError
    expect(res2.body.error).toBe('This time slot is no longer available');
  });
});
