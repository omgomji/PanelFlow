/**
 * Singleton PrismaClient instance.
 *
 * Centralised here so every module imports from the same place
 * instead of creating separate clients (which would open multiple
 * connection pools).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
