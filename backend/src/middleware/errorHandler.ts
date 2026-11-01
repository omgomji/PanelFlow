import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { AppError } from '../utils/errors';

/**
 * Global error handler middleware.
 *
 * Must be registered LAST in the middleware chain.
 * Express identifies error handlers by the 4-argument signature
 * (err, req, res, next) — all four params must be present.
 *
 * In Express 5, async route handlers that throw or return rejected
 * promises automatically forward the error here — no manual
 * try/catch wrappers needed in controllers.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log for debugging (visible in server console)
  console.error(`[Error] ${err.message}`);

  // ── Custom application errors ──────────────────────────────
  // Thrown explicitly in services/controllers with a known status code.
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // ── Prisma: unique constraint violation ────────────────────
  // e.g. duplicate slug for the same user
  if ((err as any).code === 'P2002') {
    return res.status(400).json({ error: 'A record with this value already exists' });
  }

  // ── PostgreSQL: exclusion constraint violation ─────────────
  // Fires when a concurrent booking slips past the application-layer
  // overlap check (TOCTOU race). The DB-level exclusion constraint
  // `no_overlapping_bookings` catches it and prevents the INSERT.
  // PG error code 23P01 = exclusion_violation
  if (
    (err as any).code === '23P01' ||
    err.message?.includes('no_overlapping_bookings')
  ) {
    return res.status(409).json({ error: 'This time slot is no longer available' });
  }

  // ── Fallback ───────────────────────────────────────────────
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  res.status(500).json({ error: 'Internal server error' });
};
