import { beforeAll, afterAll, afterEach } from 'vitest';
import { execSync } from 'child_process';

const testDbUrl = process.env.DATABASE_URL?.replace(
  /\/[^/?]+(\?|$)/,
  '/calendly_test$1'
);
process.env.DATABASE_URL = testDbUrl;

// Import prisma AFTER modifying process.env
import { prisma } from '../config/prisma';

beforeAll(async () => {
  try {
    execSync('npx prisma db push --accept-data-loss', { 
      stdio: 'ignore',
      env: { ...process.env, DATABASE_URL: testDbUrl }
    });
  } catch (error) {
    console.error('Failed to sync test database', error);
  }
});

afterEach(async () => {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  try {
    if (tables.length > 0) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    }
  } catch (error) {
    console.error({ error });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
