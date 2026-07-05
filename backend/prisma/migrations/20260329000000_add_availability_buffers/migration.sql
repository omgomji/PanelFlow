-- AlterTable
ALTER TABLE "AvailabilitySchedule"
ADD COLUMN "beforeEventBufferMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "afterEventBufferMinutes" INTEGER NOT NULL DEFAULT 0;

-- Add constraints to keep buffer values non-negative
ALTER TABLE "AvailabilitySchedule"
ADD CONSTRAINT "AvailabilitySchedule_beforeEventBufferMinutes_check" CHECK ("beforeEventBufferMinutes" >= 0),
ADD CONSTRAINT "AvailabilitySchedule_afterEventBufferMinutes_check" CHECK ("afterEventBufferMinutes" >= 0);
