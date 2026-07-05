/**
 * PostgreSQL Exclusion & Check Constraint Setup
 *
 * This script applies database-level constraints that prevent:
 *   1. Overlapping SCHEDULED bookings for the same host (on BookingHost)
 *   2. A Booking being both individual and panel, or neither
 *
 * WHY THIS EXISTS:
 * Prisma cannot express PostgreSQL exclusion constraints or CHECK constraints
 * in its schema DSL. The application-layer $transaction check (in bookings.service.ts)
 * catches 99% of conflicts, but under high concurrency the TOCTOU race condition
 * means two transactions can both pass the SELECT check simultaneously.
 * The exclusion constraint is the database-level guarantee that prevents this.
 *
 * REQUIRES:
 *   - btree_gist extension (enables GiST index on scalar types)
 *   - BookingHost table (added in Phase 1 schema update)
 *
 * Run with: npx ts-node prisma/setup-constraints.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Setting up PostgreSQL constraints...');

  // Enable btree_gist extension — required for exclusion constraints
  // that combine scalar columns (userId) with range types (tstzrange)
  await prisma.$executeRawUnsafe(
    `CREATE EXTENSION IF NOT EXISTS btree_gist;`
  );
  console.log('  ✓ btree_gist extension enabled');

  // ── Original: Booking-level exclusion constraint ────────────────────────
  // Drop and re-apply in case of re-run.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS no_overlapping_bookings;`
  );

  // For individual bookings: userId on Booking prevents the host from being
  // double-booked across all their event types.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Booking"
    ADD CONSTRAINT no_overlapping_bookings
    EXCLUDE USING gist (
      "userId" WITH =,
      tsrange("startTime", "endTime") WITH &&
    )
    WHERE (status = 'SCHEDULED'::"BookingStatus" AND "userId" IS NOT NULL);
  `);
  console.log('  ✓ Exclusion constraint no_overlapping_bookings applied to Booking');

  // ── New: BookingHost-level exclusion constraint ─────────────────────────
  // Same mechanism, scoped to per-host rows so it catches conflicts across
  // both individual and panel bookings (all write a BookingHost row).
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "BookingHost" DROP CONSTRAINT IF EXISTS no_overlapping_host_bookings;`
  );

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "BookingHost"
    ADD CONSTRAINT no_overlapping_host_bookings
    EXCLUDE USING gist (
      "userId" WITH =,
      tsrange("startTime", "endTime") WITH &&
    )
    WHERE ("status" = 'SCHEDULED'::"BookingStatus");
  `);
  console.log('  ✓ Exclusion constraint no_overlapping_host_bookings applied to BookingHost');

  // ── New: Booking mutual-exclusivity CHECK ───────────────────────────────
  // A Booking is either individual (eventTypeId + userId set, panelId NULL)
  // or panel (panelId set, eventTypeId + userId NULL) — never both, never neither.
  // This is the "don't trust app code alone" philosophy already used above.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS booking_exactly_one_kind;`
  );

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Booking"
    ADD CONSTRAINT booking_exactly_one_kind
    CHECK (
      ("eventTypeId" IS NOT NULL AND "userId" IS NOT NULL AND "panelId" IS NULL) OR
      ("eventTypeId" IS NULL AND "userId" IS NULL AND "panelId" IS NOT NULL)
    );
  `);
  console.log('  ✓ CHECK constraint booking_exactly_one_kind applied to Booking');

  console.log('✅ Database constraints configured successfully!');
}

main()
  .catch((e) => {
    console.error('Setup error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
