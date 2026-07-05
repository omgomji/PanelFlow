/**
 * Database Seed Script
 *
 * Populates the database with realistic sample data for development and demo:
 *   - 1 ADMIN user (om, username: om) with bcrypt-hashed password
 *   - 6 INTERVIEWER users with realistic names and roles, password 'password123'
 *   - Monday–Friday availability for all users
 *   - 4 event types for admin (15 min, 30 min, 45 min, 60 min)
 *   - Realistic sample bookings (individual)
 *   - 4 Realistic Positions with multiple panels and assigned interviewers
 *   - Panel bookings: past with disagreement, detailed feedback, upcoming, no-show, cancelled
 *
 * Run with: npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();
const IST_TIMEZONE = 'Asia/Kolkata';
const SALT_ROUNDS = 12;

function toUtcFromIst(baseDate: Date, dayOffset: number, hhmm: string): Date {
  const shifted = addDays(baseDate, dayOffset);
  const datePart = formatInTimeZone(shifted, IST_TIMEZONE, 'yyyy-MM-dd');
  return fromZonedTime(`${datePart}T${hhmm}:00`, IST_TIMEZONE);
}

function weekdaySchedule(userId: number, timezone: string) {
  return {
    userId,
    timezone,
    beforeEventBufferMinutes: 15,
    afterEventBufferMinutes: 15,
    startTimeIncrementMinutes: 30,
    minimumNoticeMinutes: 240,
    maximumDaysInFuture: 60,
    allowBackToBack: true,
    days: {
      create: [
        { dayOfWeek: 1, intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] } },
        { dayOfWeek: 2, intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] } },
        { dayOfWeek: 3, intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] } },
        { dayOfWeek: 4, intervals: { create: [{ startTime: '09:00', endTime: '17:00', order: 0 }] } },
        { dayOfWeek: 5, intervals: { create: [{ startTime: '09:00', endTime: '16:00', order: 0 }] } },
      ],
    },
  };
}

async function main() {
  console.log('🗑️  Clearing database...');
  await prisma.feedback.deleteMany();
  await prisma.bookingHost.deleteMany();
  await prisma.panelInterviewer.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.panel.deleteMany();
  await prisma.position.deleteMany();
  await prisma.availabilityDateOverrideInterval.deleteMany();
  await prisma.availabilityDateOverride.deleteMany();
  await prisma.availabilityInterval.deleteMany();
  await prisma.availabilityDay.deleteMany();
  await prisma.availabilitySchedule.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.eventType.deleteMany();
  await prisma.user.deleteMany();

  console.log('🔑 Hashing passwords...');
  const adminHash = await bcrypt.hash('password123', SALT_ROUNDS);
  const interviewerHash = await bcrypt.hash('password123', SALT_ROUNDS);

  // ── Users ──────────────────────────────────────────────────
  console.log('👤 Seeding users...');
  const admin = await prisma.user.create({
    data: {
      username: 'om',
      name: 'Om (Admin)',
      email: 'om@example.com',
      timezone: IST_TIMEZONE,
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });

  const usersData = [
    { username: 'emily', name: 'Emily Chen', email: 'emily.chen@example.com' },
    { username: 'michael', name: 'Michael Rodriguez', email: 'michael.r@example.com' },
    { username: 'sarah', name: 'Sarah Kim', email: 'sarah.kim@example.com' },
    { username: 'david', name: 'David Patel', email: 'david.patel@example.com' },
    { username: 'jessica', name: 'Jessica Taylor', email: 'jessica.t@example.com' },
    { username: 'james', name: 'James Wilson', email: 'james.w@example.com' },
  ];

  const interviewers = [];
  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        ...u,
        timezone: IST_TIMEZONE,
        passwordHash: interviewerHash,
        role: 'INTERVIEWER',
      },
    });
    interviewers.push(user);
  }

  const [emily, michael, sarah, david, jessica, james] = interviewers;

  // ── Availability Schedules ─────────────────────────────────
  console.log('📅 Seeding availability schedules...');
  await prisma.availabilitySchedule.create({ data: weekdaySchedule(admin.id, IST_TIMEZONE) });
  for (const interviewer of interviewers) {
    await prisma.availabilitySchedule.create({ data: weekdaySchedule(interviewer.id, IST_TIMEZONE) });
  }

  // ── Event Types (for admin) ────────────────────────────────
  console.log('📝 Seeding event types...');
  const chat15 = await prisma.eventType.create({
    data: {
      userId: admin.id,
      title: '15 Min Catch-up',
      slug: '15-min-catch-up',
      duration: 15,
      description: 'A quick 15-minute sync to touch base.',
      isActive: true,
    },
  });

  const interview30 = await prisma.eventType.create({
    data: {
      userId: admin.id,
      title: '30 Min Initial Screen',
      slug: '30-min-initial-screen',
      duration: 30,
      description: 'Standard 30-minute introductory call with a recruiter or hiring manager.',
      isActive: true,
    },
  });

  const deepDive45 = await prisma.eventType.create({
    data: {
      userId: admin.id,
      title: '45 Min Strategy Session',
      slug: '45-min-strategy',
      duration: 45,
      description: 'Deep dive into product or technical strategy.',
      isActive: true,
    },
  });

  await prisma.eventType.create({
    data: {
      userId: admin.id,
      title: '60 Min System Design',
      slug: '60-min-system-design',
      duration: 60,
      description: 'In-depth architecture and system design discussion.',
      isActive: true,
    },
  });

  // ── Contacts ───────────────────────────────────────────────
  console.log('📇 Seeding contacts...');
  await prisma.contact.createMany({
    data: [
      {
        userId: admin.id,
        name: 'Alex Johnson',
        email: 'alex.j@example.com',
        phone: '+1 415-555-0198',
        note: 'Strong candidate for the Senior Frontend role. Follow up regarding their open-source contributions.',
      },
      {
        userId: admin.id,
        name: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        phone: '+1 212-555-0133',
        note: 'Met at ReactConf. Interested in Full Stack opportunities.',
      },
      {
        userId: admin.id,
        name: 'Jordan Lee',
        email: 'jordan.lee@example.com',
        phone: '+1 512-555-0155',
        note: 'Requires visa sponsorship. Keep in mind for future roles.',
      },
    ],
  });

  // ── Sample Bookings (individual) ───────────────────────────
  console.log('📌 Seeding sample bookings...');
  const now = new Date();

  // Tomorrow, 10:00 AM
  const tomorrow = toUtcFromIst(now, 1, '10:00');
  const booking1 = await prisma.booking.create({
    data: {
      eventTypeId: chat15.id,
      userId: admin.id,
      inviteeName: 'Alex Johnson',
      inviteeEmail: 'alex.j@example.com',
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 15 * 60_000),
      status: 'SCHEDULED',
    },
  });
  await prisma.bookingHost.create({
    data: {
      bookingId: booking1.id,
      userId: admin.id,
      startTime: tomorrow,
      endTime: new Date(tomorrow.getTime() + 15 * 60_000),
      status: 'SCHEDULED',
    },
  });

  // Day After Tomorrow, 2:30 PM
  const dayAfter = toUtcFromIst(now, 2, '14:30');
  const booking2 = await prisma.booking.create({
    data: {
      eventTypeId: interview30.id,
      userId: admin.id,
      inviteeName: 'Priya Sharma',
      inviteeEmail: 'priya.sharma@example.com',
      startTime: dayAfter,
      endTime: new Date(dayAfter.getTime() + 30 * 60_000),
      status: 'SCHEDULED',
    },
  });
  await prisma.bookingHost.create({
    data: {
      bookingId: booking2.id,
      userId: admin.id,
      startTime: dayAfter,
      endTime: new Date(dayAfter.getTime() + 30 * 60_000),
      status: 'SCHEDULED',
    },
  });

  // Yesterday, 11:00 AM
  const yesterday = toUtcFromIst(now, -1, '11:00');
  const booking3 = await prisma.booking.create({
    data: {
      eventTypeId: deepDive45.id,
      userId: admin.id,
      inviteeName: 'Jordan Lee',
      inviteeEmail: 'jordan.lee@example.com',
      startTime: yesterday,
      endTime: new Date(yesterday.getTime() + 45 * 60_000),
      status: 'SCHEDULED',
    },
  });
  await prisma.bookingHost.create({
    data: {
      bookingId: booking3.id,
      userId: admin.id,
      startTime: yesterday,
      endTime: new Date(yesterday.getTime() + 45 * 60_000),
      status: 'SCHEDULED',
    },
  });

  // Two Days Ago, Cancelled
  const twoDaysAgo = toUtcFromIst(now, -2, '15:00');
  const booking4 = await prisma.booking.create({
    data: {
      eventTypeId: chat15.id,
      userId: admin.id,
      inviteeName: 'Sam Taylor',
      inviteeEmail: 'sam.taylor@example.com',
      startTime: twoDaysAgo,
      endTime: new Date(twoDaysAgo.getTime() + 15 * 60_000),
      status: 'CANCELLED',
      cancellationReason: 'Candidate had a last minute emergency.',
    },
  });
  await prisma.bookingHost.create({
    data: {
      bookingId: booking4.id,
      userId: admin.id,
      startTime: twoDaysAgo,
      endTime: new Date(twoDaysAgo.getTime() + 15 * 60_000),
      status: 'CANCELLED',
    },
  });

  // ── Positions & Panels ───────────────────────────────────────
  console.log('🏢 Seeding positions and panels...');
  
  const pos1 = await prisma.position.create({
    data: {
      title: 'Full Stack Engineer (React/Node)',
      description: 'We are looking for a strong Full Stack Engineer proficient in React, Next.js, and Node.js to build scalable user interfaces and robust APIs.',
      status: 'OPEN',
      createdById: admin.id,
    },
  });
  
  const pos1_panel1 = await prisma.panel.create({
    data: {
      positionId: pos1.id,
      title: 'Frontend Deep Dive',
      slug: 'fullstack-frontend',
      duration: 60,
      interviewers: { create: [{ userId: emily.id }, { userId: michael.id }] }
    }
  });

  const pos1_panel2 = await prisma.panel.create({
    data: {
      positionId: pos1.id,
      title: 'Backend & System Design',
      slug: 'fullstack-backend',
      duration: 60,
      interviewers: { create: [{ userId: sarah.id }, { userId: david.id }] }
    }
  });

  const pos2 = await prisma.position.create({
    data: {
      title: 'Product Manager',
      description: 'Seeking a data-driven Product Manager to lead our core engagement squad, working closely with engineering and design.',
      status: 'OPEN',
      createdById: admin.id,
    }
  });
  const pos2_panel1 = await prisma.panel.create({
    data: {
      positionId: pos2.id,
      title: 'Product Strategy & Vision',
      slug: 'pm-strategy',
      duration: 45,
      interviewers: { create: [{ userId: jessica.id }, { userId: james.id }] }
    }
  });

  const pos3 = await prisma.position.create({
    data: {
      title: 'Engineering Manager',
      description: 'Looking for an experienced Engineering Manager to lead a team of 8 engineers focused on platform reliability.',
      status: 'OPEN',
      createdById: admin.id,
    }
  });
  const pos3_panel1 = await prisma.panel.create({
    data: {
      positionId: pos3.id,
      title: 'Leadership & People Management',
      slug: 'em-leadership',
      duration: 60,
      interviewers: { create: [{ userId: emily.id }, { userId: david.id }] }
    }
  });

  const pos4 = await prisma.position.create({
    data: {
      title: 'Senior DevOps Engineer',
      description: 'Requires deep knowledge of Kubernetes, AWS, and CI/CD pipelines.',
      status: 'CLOSED',
      createdById: admin.id,
    }
  });

  // ── Sample Panel Bookings (with Feedback) ───────────────────
  console.log('📌 Seeding panel bookings and feedback...');
  
  // 1. Past Full Stack Backend Panel - Disagreement
  const pastDisagreement = toUtcFromIst(now, -3, '14:00');
  await prisma.booking.create({
    data: {
      panelId: pos1_panel2.id, // Backend & System Design
      inviteeName: 'Alex Johnson',
      inviteeEmail: 'alex.j@example.com',
      startTime: pastDisagreement,
      endTime: new Date(pastDisagreement.getTime() + 60 * 60_000),
      status: 'SCHEDULED',
      hosts: {
        create: [
          { userId: sarah.id, startTime: pastDisagreement, endTime: new Date(pastDisagreement.getTime() + 60 * 60_000), status: 'SCHEDULED' },
          { userId: david.id, startTime: pastDisagreement, endTime: new Date(pastDisagreement.getTime() + 60 * 60_000), status: 'SCHEDULED' }
        ]
      },
      feedback: {
        create: [
          { interviewerId: sarah.id, recommendation: 'YES', notes: 'Candidate has a solid understanding of Node.js event loop and handled the API design well. Missed a few edge cases on scaling.' },
          { interviewerId: david.id, recommendation: 'NO', notes: 'Struggled significantly when discussing database indexing and query optimization. Not quite ready for a senior role.' }
        ]
      }
    }
  });

  // 2. Past Product Manager Panel - Strong Yes
  const pastPartial = toUtcFromIst(now, -1, '10:00');
  await prisma.booking.create({
    data: {
      panelId: pos2_panel1.id, // Product Strategy
      inviteeName: 'Samantha Brooks',
      inviteeEmail: 'samantha.b@example.com',
      startTime: pastPartial,
      endTime: new Date(pastPartial.getTime() + 45 * 60_000),
      status: 'SCHEDULED',
      hosts: {
        create: [
          { userId: jessica.id, startTime: pastPartial, endTime: new Date(pastPartial.getTime() + 45 * 60_000), status: 'SCHEDULED' },
          { userId: james.id, startTime: pastPartial, endTime: new Date(pastPartial.getTime() + 45 * 60_000), status: 'SCHEDULED' }
        ]
      },
      feedback: {
        create: [
          { interviewerId: jessica.id, recommendation: 'STRONG_YES', notes: 'Exceptional product sense. Walked through a complex roadmap prioritization scenario flawlessly. Highly recommend.' },
          { interviewerId: james.id, recommendation: 'YES', notes: 'Very good communication skills and stakeholder management experience.' }
        ]
      }
    }
  });

  // 3. Upcoming Full Stack Frontend Panel
  const upcoming = toUtcFromIst(now, 2, '11:00');
  await prisma.booking.create({
    data: {
      panelId: pos1_panel1.id, // Frontend Deep Dive
      inviteeName: 'Lucas Martinez',
      inviteeEmail: 'lucas.m@example.com',
      startTime: upcoming,
      endTime: new Date(upcoming.getTime() + 60 * 60_000),
      status: 'SCHEDULED',
      hosts: {
        create: [
          { userId: emily.id, startTime: upcoming, endTime: new Date(upcoming.getTime() + 60 * 60_000), status: 'SCHEDULED' },
          { userId: michael.id, startTime: upcoming, endTime: new Date(upcoming.getTime() + 60 * 60_000), status: 'SCHEDULED' }
        ]
      }
    }
  });

  // 4. NO_SHOW - Engineering Manager Leadership Panel
  const noShowTime = toUtcFromIst(now, -5, '09:00');
  await prisma.booking.create({
    data: {
      panelId: pos3_panel1.id, // Leadership
      inviteeName: 'Marcus Johnson',
      inviteeEmail: 'marcus@example.com',
      startTime: noShowTime,
      endTime: new Date(noShowTime.getTime() + 60 * 60_000),
      status: 'NO_SHOW',
      hosts: {
        create: [
          { userId: emily.id, startTime: noShowTime, endTime: new Date(noShowTime.getTime() + 60 * 60_000), status: 'NO_SHOW' },
          { userId: david.id, startTime: noShowTime, endTime: new Date(noShowTime.getTime() + 60 * 60_000), status: 'NO_SHOW' }
        ]
      }
    }
  });

  // 5. CANCELLED with reason - Product Manager
  const cancelledTime = toUtcFromIst(now, 4, '13:00');
  await prisma.booking.create({
    data: {
      panelId: pos2_panel1.id, // Product Strategy
      inviteeName: 'Lisa Wong',
      inviteeEmail: 'lisa.w@example.com',
      startTime: cancelledTime,
      endTime: new Date(cancelledTime.getTime() + 45 * 60_000),
      status: 'CANCELLED',
      cancellationReason: 'Candidate accepted another offer at a competitor.',
      hosts: {
        create: [
          { userId: jessica.id, startTime: cancelledTime, endTime: new Date(cancelledTime.getTime() + 45 * 60_000), status: 'CANCELLED' },
          { userId: james.id, startTime: cancelledTime, endTime: new Date(cancelledTime.getTime() + 45 * 60_000), status: 'CANCELLED' }
        ]
      }
    }
  });

  console.log('✅ Database seeded successfully!');
  console.log('\n📋 Seeded credentials:');
  console.log('  ADMIN:       om@example.com     / password123');
  console.log('  INTERVIEWER: emily.chen@example.com / password123 (and 5 others)');
  console.log('\n🔗 Positions and Panels set up for Full Stack, PM, and EM roles.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
