import { prisma } from '../config/prisma';
import crypto from 'crypto';

export const webhookService = {
  async dispatchWebhookEvent(userId: number, event: string, data: unknown): Promise<void> {
    // Fire and forget by running this asynchronously without returning the promise to the caller
    // (In Node.js, we can just let this execute in the background if we don't await the inner logic)
    setImmediate(async () => {
      try {
        const endpoints = await prisma.webhookEndpoint.findMany({
          where: {
            userId,
            isActive: true,
            events: { has: event }
          }
        });

        if (endpoints.length === 0) return;

        const timestamp = new Date().toISOString();
        const payload = { event, timestamp, data };
        const payloadString = JSON.stringify(payload);

        const sendRequest = async (endpoint: any, attempt: number): Promise<boolean> => {
          const signaturePayload = timestamp + '.' + payloadString;
          const signature = crypto
            .createHmac('sha256', endpoint.secret)
            .update(signaturePayload)
            .digest('hex');

          let statusCode: number | null = null;
          let success = false;

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch(endpoint.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-PanelFlow-Signature': `sha256=${signature}`,
                'X-PanelFlow-Timestamp': timestamp
              },
              body: payloadString,
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            statusCode = response.status;
            success = response.ok;
          } catch (error) {
            console.error(`Webhook attempt ${attempt} failed for ${endpoint.url}`, error);
          }

          // Log delivery attempt
          await prisma.webhookDelivery.create({
            data: {
              endpointId: endpoint.id,
              event,
              payload: payload as any,
              statusCode,
              success,
              attempt
            }
          });

          return success;
        };

        for (const endpoint of endpoints) {
          const success = await sendRequest(endpoint, 1);
          if (!success) {
            // Inline retry after ~2s
            setTimeout(() => {
              sendRequest(endpoint, 2);
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Failed to process webhooks:', error);
      }
    });
  }
};
