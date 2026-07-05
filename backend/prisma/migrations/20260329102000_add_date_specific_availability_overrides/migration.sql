-- CreateTable
CREATE TABLE "AvailabilityDateOverride" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "AvailabilityDateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityDateOverrideInterval" (
    "id" SERIAL NOT NULL,
    "overrideId" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityDateOverrideInterval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityDateOverride_scheduleId_date_key" ON "AvailabilityDateOverride"("scheduleId", "date");

-- CreateIndex
CREATE INDEX "AvailabilityDateOverride_scheduleId_date_idx" ON "AvailabilityDateOverride"("scheduleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityDateOverrideInterval_overrideId_order_key" ON "AvailabilityDateOverrideInterval"("overrideId", "order");

-- CreateIndex
CREATE INDEX "AvailabilityDateOverrideInterval_overrideId_startTime_endTime_idx" ON "AvailabilityDateOverrideInterval"("overrideId", "startTime", "endTime");

-- AddForeignKey
ALTER TABLE "AvailabilityDateOverride" ADD CONSTRAINT "AvailabilityDateOverride_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AvailabilitySchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityDateOverrideInterval" ADD CONSTRAINT "AvailabilityDateOverrideInterval_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "AvailabilityDateOverride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
