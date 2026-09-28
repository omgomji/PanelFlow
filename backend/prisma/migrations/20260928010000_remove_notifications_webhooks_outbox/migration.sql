DROP TABLE IF EXISTS "WebhookDelivery";
DROP TABLE IF EXISTS "WebhookEndpoint";
DROP TABLE IF EXISTS "OutboxEvent";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "reminderSentAt";