/**
 * Public Routes
 *
 * These routes are accessed by invitees — no authentication required.
 *
 * Individual booking flow (existing, unchanged):
 *   GET  /:username/:slug        → event type details
 *   GET  /:username/:slug/slots  → available time slots for a date
 *   POST /:username/:slug/book   → create a booking
 *
 * Panel booking flow (new):
 *   GET  /panels/:panelSlug/slots → available slots (intersection of all interviewers)
 *   POST /panels/:panelSlug/book  → create a panel booking
 *   GET  /panels/:panelSlug       → panel details (for booking page header)
 *
 * Note: panel routes are declared BEFORE /:username to avoid slug-match conflicts.
 */
import { Router } from 'express';
import { publicController } from '../controllers/public.controller';
import { panelPublicController } from '../controllers/panelPublic.controller';

const router = Router();

// ── Reschedule ────────────────────────────────────────────────
router.get('/reschedule/:uid/details', publicController.getRescheduleDetails);
router.post('/reschedule/:uid', publicController.rescheduleBooking);

// ── Panel Public Routes (must be before /:username) ──────────
router.get('/panels/:panelSlug', panelPublicController.getPanelDetails);
router.get('/panels/:panelSlug/slots', panelPublicController.getSlots);
router.post('/panels/:panelSlug/book', panelPublicController.createBooking);

// ── Individual Booking Routes ────────────────────────────────
router.get('/:username', publicController.getPublicProfile);
router.get('/:username/:slug', publicController.getEventDetails);
router.get('/:username/:slug/slots', publicController.getSlots);
router.post('/:username/:slug/book', publicController.createBooking);

export default router;
