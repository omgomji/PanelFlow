import { kafka, isKafkaConfigured } from '../config/kafka';
import { TOPICS, BookingEvent } from '../events/types';
import { registerInProcessEventListener } from '../events/producer';
import { indexBooking } from '../ai/indexers/indexer.service';
import { invalidateSlotCache } from '../services/bookings.service';
import { emailService } from '../services/email.service';
import { broadcastSlotChange } from '../routes/events.routes';
import { recordEventProcessingError } from '../controllers/admin.controller';

async function handleBookingEvent(event: BookingEvent): Promise<void> {
  switch (event.type) {
    case 'BOOKING_CREATED': {
      console.info('[Worker] Processing BOOKING_CREATED for bookingId:', event.bookingId);
      await invalidateSlotCache(event.panelSlug, event.hostUserIds);
      broadcastSlotChange(event.panelSlug);
      void indexBooking(event.bookingId).catch((err) => {
        console.error('[Worker] AI Indexing failed for created booking:', err.message);
      });
      await emailService.sendBookingConfirmation(event);
      break;
    }

    case 'BOOKING_CANCELLED': {
      console.info('[Worker] Processing BOOKING_CANCELLED for bookingId:', event.bookingId);
      await invalidateSlotCache(undefined, event.hostUserIds);
      broadcastSlotChange();
      void indexBooking(event.bookingId).catch((err) => {
        console.error('[Worker] AI Indexing failed for cancelled booking:', err.message);
      });
      await emailService.sendBookingCancellation(event);
      break;
    }

    case 'BOOKING_RESCHEDULED': {
      console.info('[Worker] Processing BOOKING_RESCHEDULED for newBookingId:', event.newBookingId);
      await invalidateSlotCache(undefined, event.hostUserIds);
      broadcastSlotChange();
      void Promise.all([
        indexBooking(event.oldBookingId),
        indexBooking(event.newBookingId),
      ]).catch((err) => {
        console.error('[Worker] AI Indexing failed for rescheduled booking:', err.message);
      });
      await emailService.sendBookingRescheduled(event);
      break;
    }
  }
}

export async function startKafkaConsumers(): Promise<void> {
  // Always register in-process fallback
  registerInProcessEventListener(handleBookingEvent);

  if (!isKafkaConfigured || !kafka) {
    console.info('[Worker] Kafka not configured. Using in-process event pipeline.');
    return;
  }

  try {
    const consumer = kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID || 'panelflow-core-consumers',
    });

    await consumer.connect();
    await consumer.subscribe({ topic: TOPICS.BOOKING_EVENTS, fromBeginning: false });

    console.info('[Kafka] Consumer subscribed to topic:', TOPICS.BOOKING_EVENTS);

    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const event: BookingEvent = JSON.parse(message.value.toString());
          await handleBookingEvent(event);
        } catch (err) {
          const errorMessage = (err as Error).message;
          console.error('[Kafka] Error processing message:', errorMessage);
          recordEventProcessingError(errorMessage);
        }
      },
    });
  } catch (error) {
    console.warn('[Kafka] Consumer connection failed, falling back to in-process mode:', (error as Error).message);
  }
}

