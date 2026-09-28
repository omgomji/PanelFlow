CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;
UPDATE "Booking" b SET "durationMinutes" = COALESCE(e."duration", p."duration", 30)
FROM "EventType" e FULL OUTER JOIN "Panel" p ON false
WHERE b."durationMinutes" IS NULL AND (e."id" = b."eventTypeId" OR p."id" = b."panelId");
UPDATE "Booking" SET "durationMinutes" = 30 WHERE "durationMinutes" IS NULL;
ALTER TABLE "Booking" ALTER COLUMN "durationMinutes" SET NOT NULL;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "inviteeNotes" TEXT;
ALTER TABLE "Booking" ADD CONSTRAINT booking_exactly_one_kind CHECK (("eventTypeId" IS NOT NULL AND "userId" IS NOT NULL AND "panelId" IS NULL) OR ("eventTypeId" IS NULL AND "userId" IS NULL AND "panelId" IS NOT NULL));
ALTER TABLE "BookingHost" ADD CONSTRAINT no_overlapping_host_bookings EXCLUDE USING gist ("userId" WITH =, tsrange("startTime", "endTime", '[)') WITH &&) WHERE ("status" = 'SCHEDULED'::"BookingStatus");
ALTER TABLE "WebhookDelivery" ADD COLUMN IF NOT EXISTS "lastError" TEXT, ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "OutboxEvent" ("id" SERIAL PRIMARY KEY, "type" TEXT NOT NULL, "aggregateId" INTEGER NOT NULL, "payload" JSONB NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3), "nextAttemptAt" TIMESTAMP(3));
CREATE TABLE "RefreshSession" ("id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES "User"("id"), "tokenHash" TEXT NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "rotatedFrom" INTEGER);
