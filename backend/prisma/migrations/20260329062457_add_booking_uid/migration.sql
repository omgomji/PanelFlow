/*
  Warnings:

  - A unique constraint covering the columns `[uid]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - The required column `uid` was added to the `Booking` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "AvailabilitySchedule" ADD COLUMN     "allowBackToBack" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maximumDaysInFuture" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "minimumNoticeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startTimeIncrementMinutes" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "uid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata';

-- CreateIndex
CREATE UNIQUE INDEX "Booking_uid_key" ON "Booking"("uid");
