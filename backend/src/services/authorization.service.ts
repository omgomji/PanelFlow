export function canManagePosition(userId: number, role: string, position: { createdById: number }) {
  return role === 'ADMIN' || position.createdById === userId;
}
export function canManagePanel(userId: number, role: string, panel: { position: { createdById: number } }) {
  return canManagePosition(userId, role, panel.position);
}
export function canManageBooking(userId: number, role: string, booking: { eventTypeId: number | null; eventType?: { userId: number } | null; panel?: { position: { createdById: number } } | null }) {
  if (role === 'ADMIN') return true;
  return booking.eventTypeId !== null ? booking.eventType?.userId === userId : booking.panel?.position.createdById === userId;
}
export function canViewFeedback(userId: number, role: string, hostIds: number[]) { return role === 'ADMIN' || hostIds.includes(userId); }
export function canSubmitFeedback(userId: number, hostIds: number[]) { return hostIds.includes(userId); }
