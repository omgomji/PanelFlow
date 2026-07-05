-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityInterval" (
    "id" SERIAL NOT NULL,
    "dayId" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityInterval_pkey" PRIMARY KEY ("id")
);

-- Migrate old single-interval day data into the new interval table
INSERT INTO "AvailabilityInterval" ("dayId", "startTime", "endTime", "order")
SELECT "id", "startTime", "endTime", 0
FROM "AvailabilityDay";

-- AlterTable
ALTER TABLE "AvailabilityDay" DROP COLUMN "startTime",
DROP COLUMN "endTime";

-- CreateIndex
CREATE INDEX "Contact_userId_createdAt_idx" ON "Contact"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_email_key" ON "Contact"("userId", "email");

-- CreateIndex
CREATE INDEX "AvailabilityInterval_dayId_startTime_endTime_idx" ON "AvailabilityInterval"("dayId", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityInterval_dayId_order_key" ON "AvailabilityInterval"("dayId", "order");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityInterval" ADD CONSTRAINT "AvailabilityInterval_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "AvailabilityDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
