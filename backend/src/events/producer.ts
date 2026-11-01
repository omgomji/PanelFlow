import { kafkaProducer, isKafkaConfigured } from '../config/kafka';
import { TOPICS, BookingEvent } from './types';

let isProducerConnected = false;

// In-process fallback listeners for when Kafka is not configured
type EventListener = (event: BookingEvent) => Promise<void> | void;
const inProcessListeners: EventListener[] = [];

export function registerInProcessEventListener(listener: EventListener) {
  inProcessListeners.push(listener);
}

export async function publishBookingEvent(event: BookingEvent): Promise<void> {
  if (isKafkaConfigured && kafkaProducer) {
    try {
      if (!isProducerConnected) {
        await kafkaProducer.connect();
        isProducerConnected = true;
      }

      await kafkaProducer.send({
        topic: TOPICS.BOOKING_EVENTS,
        messages: [
          {
            key: String('bookingId' in event ? event.bookingId : event.newBookingId),
            value: JSON.stringify(event),
            headers: {
              timestamp: Date.now().toString(),
            },
          },
        ],
      });
      return;
    } catch (error) {
      console.error('[Kafka] Failed to publish booking event, falling back to in-process handlers:', error);
    }
  }

  // Fallback / local development without Kafka
  for (const listener of inProcessListeners) {
    try {
      await listener(event);
    } catch (err) {
      console.error('[Event] In-process listener failed:', err);
    }
  }
}

