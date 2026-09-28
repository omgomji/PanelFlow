import { ConflictError, NotFoundError } from '../utils/errors';
import { generateSlots } from './slots.service';
import { panelSlotsService } from './panelSlots.service';
import { publicService } from './public.service';

export async function validateBookableSlot(input: { sourceType: 'individual' | 'panel'; username?: string; slug: string; startTime: Date; candidateTimezone: string }) {
  const candidateDate = new Intl.DateTimeFormat('en-CA', { timeZone: input.candidateTimezone }).format(input.startTime);
  if (input.sourceType === 'panel') {
    const slots = await panelSlotsService.getSlots(input.slug, candidateDate, input.candidateTimezone);
    if (!slots.some((slot) => new Date(slot).getTime() === input.startTime.getTime())) throw new ConflictError('This time slot is no longer available');
    return;
  }
  const user = await publicService.getUserByUsername(input.username!);
  const eventType = await publicService.getActiveEventType(user.id, input.slug);
  const schedule = await publicService.getScheduleWithIntervals(user.id);
  if (!schedule) throw new NotFoundError('No availability configured');
  const hostDate = new Intl.DateTimeFormat('en-CA', { timeZone: schedule.timezone }).format(input.startTime);
  const slots = await generateSlots(user.id, eventType.duration, schedule.timezone, schedule.days, schedule.dateOverrides, hostDate, schedule);
  if (!slots.some((slot) => new Date(slot).getTime() === input.startTime.getTime())) throw new ConflictError('This time slot is no longer available');
}
