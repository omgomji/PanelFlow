import * as Sentry from '@sentry/node';
import { app } from './app';
import { closeVectorStore } from './ai/retrieval';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { startKafkaConsumers } from './workers/kafka.consumer';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
}

const port = process.env.PORT || 5000;

const server = app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Backend server running on port ${port} (0.0.0.0)`);
  void startKafkaConsumers();
});

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}; shutting down gracefully.`);
  server.close(async () => {
    await closeVectorStore().catch(() => undefined);
    await redis.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  });
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
