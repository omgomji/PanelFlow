import { prisma } from '../../config/prisma';
import { indexBooking, indexPanel, indexPosition } from './indexer.service';

export async function safeReindexBooking(bookingId: number, reason: string) {
  void indexBooking(bookingId).catch((error) => {
    console.error('[ai] booking reindex failed', { bookingId, reason, error: error instanceof Error ? error.message : String(error) });
  });
}

export async function safeReindexPanelAndBookings(panelId: number, reason: string) {
  try {
    const panel = await prisma.panel.findUnique({ where: { id: panelId }, select: { positionId: true } });
    await indexPanel(panelId);
    if (panel) await indexPosition(panel.positionId);
    const bookings = await prisma.booking.findMany({ where: { panelId }, select: { id: true } });
    await Promise.all(bookings.map(({ id }) => indexBooking(id)));
  } catch (error) {
    console.error('[ai] panel reindex failed', { panelId, reason, error: error instanceof Error ? error.message : String(error) });
  }
}

export async function safeReindexPositionAndBookings(positionId: number, reason: string) {
  try {
    await indexPosition(positionId);
    const panels = await prisma.panel.findMany({ where: { positionId }, select: { id: true } });
    const bookings = await prisma.booking.findMany({ where: { panelId: { in: panels.map((panel) => panel.id) } }, select: { id: true } });
    await Promise.all([
      ...panels.map(({ id }) => indexPanel(id)),
      ...bookings.map(({ id }) => indexBooking(id)),
    ]);
  } catch (error) {
    console.error('[ai] position reindex failed', { positionId, reason, error: error instanceof Error ? error.message : String(error) });
  }
}
