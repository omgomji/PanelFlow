ALTER TABLE "OutboxEvent" ADD COLUMN "lockedAt" TIMESTAMP(3), ADD COLUMN "lockedBy" TEXT, ADD COLUMN "notificationSentAt" TIMESTAMP(3);
ALTER TABLE "WebhookDelivery" ADD COLUMN "eventId" INTEGER;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_eventId_key" UNIQUE ("endpointId", "eventId");
