/**
 * Application Entry Point
 *
 * Bootstraps the Express 5 server with:
 *   - CORS (exact origin from FRONTEND_URL + credentials: true for cross-origin cookies)
 *   - cookie-parser (must come before any route that reads req.cookies)
 *   - JSON body parsing
 *   - JWT auth middleware on admin routes
 *   - Route mounting
 *   - Global error handler (must be last)
 *
 * Architecture:
 *   Routes → Controllers → Services → Prisma → PostgreSQL
 *
 * The PrismaClient singleton lives in src/config/prisma.ts
 * to avoid circular imports and multiple connection pools.
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import eventTypesRouter from './routes/eventTypes';
import availabilityRouter from './routes/availability';
import bookingsRouter from './routes/bookings';
import contactsRouter from './routes/contacts';
import publicRouter from './routes/public';
import authRouter from './routes/auth.routes';
import positionsRouter from './routes/positions.routes';
import panelsRouter from './routes/panels.routes';
import usersRouter from './routes/users.routes';
import cronRouter from './routes/cron.routes';
import webhookRouter from './routes/webhook.routes';
import adminRouter from './routes/admin.routes';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// ── Global Middleware ────────────────────────────────────────
// CORS: exact origin required when credentials:true — '*' is rejected by browsers.
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// cookie-parser must be registered before any route that reads req.cookies.
// Without it, req.cookies is undefined even when the browser sends the cookie.
app.use(cookieParser());
app.use(express.json());

// ── Health Check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── Auth Routes (public) ──────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Admin Routes ──────────────────────────────────────────────
// Protected by requireAuth — decodes JWT, attaches req.user = { id, role }.
app.use('/api/event-types', requireAuth, eventTypesRouter);
app.use('/api/availability', requireAuth, availabilityRouter);
app.use('/api/bookings', requireAuth, bookingsRouter);
app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/positions', requireAuth, positionsRouter);
app.use('/api/panels', requireAuth, panelsRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/webhooks', requireAuth, webhookRouter);
app.use('/api/admin', requireAuth, adminRouter);
app.use('/api/cron', cronRouter);

// ── Public Routes ────────────────────────────────────────────
// No auth required — accessed by invitees via booking links.
app.use('/api/public', publicRouter);

// ── Global Error Handler ─────────────────────────────────────
// Must be registered LAST. Express 5 auto-forwards async errors here.
app.use(errorHandler);

export { app };
