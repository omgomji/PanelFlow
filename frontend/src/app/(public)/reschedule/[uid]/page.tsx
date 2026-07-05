'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRescheduleDetails, getPublicSlots, rescheduleBooking } from '@/lib/api';
import type { RescheduleDetailsResponse } from '@/types/public';
import axios from 'axios';
import { AlertDialog } from '@/components/ui/AlertDialog';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export default function ReschedulePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<RescheduleDetailsResponse | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });
  const showAlert = (title: string, message: string) => setAlertInfo({ isOpen: true, title, message });
  const closeAlert = () => setAlertInfo(prev => ({ ...prev, isOpen: false }));

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  const hostTimeZone = eventData?.user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const data = await getRescheduleDetails(uid);
        if (data.booking.status === 'CANCELLED') {
           setError('This booking is already cancelled and cannot be rescheduled.');
        } else {
           setEventData(data);
        }
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError((err.response?.data as { error?: string } | undefined)?.error || 'Booking not found');
        } else {
          setError('Booking not found');
        }
      } finally {
        setLoading(false);
      }
    };
    if (uid) fetchEventData();
  }, [uid]);

  const fetchSlots = useCallback(async (date: Date) => {
    if (!eventData) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const data = await getPublicSlots(eventData.user.username, eventData.eventType.slug, formattedDate);
      const slots = data.map((slot) => slot.time);
      setAvailableSlots(slots);
    } catch (err) {
      console.error(err);
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [eventData]);

  const handleDateClick = (date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) return; // can't book past days
    setSelectedDate(date);
    fetchSlots(date);
  };

  const handleReschedule = async () => {
    if (!selectedSlot || !eventData) return;
    setIsSubmitting(true);
    try {
      const newBooking = await rescheduleBooking(uid, selectedSlot);
      
      const query = new URLSearchParams({
        bookingId: String(newBooking.id),
        startTime: String(newBooking.startTime),
        endTime: String(newBooking.endTime),
        inviteeName: newBooking.inviteeName,
        inviteeEmail: newBooking.inviteeEmail,
        timezone: hostTimeZone,
      });

      router.push(`/${eventData.user.username}/${eventData.eventType.slug}/success?${query.toString()}`);
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (axios.isAxiosError(err)) {
        showAlert('Error', (err.response?.data as { error?: string } | undefined)?.error || 'Failed to reschedule. Please try again.');
      } else {
        showAlert('Error', 'Failed to reschedule. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-clay/5 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-sm border-b-2 border-stamp border-2" />
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen bg-clay/5 flex items-center justify-center">
        <div className="text-red-500 font-medium">{error || 'Event not found'}</div>
      </div>
    );
  }

  const { eventType, user, booking } = eventData;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array(startDayOfWeek).fill(null);

  const prevBookingDate = new Date(booking.startTime);

  return (
    <div className="min-h-screen bg-clay/5 flex flex-col">
      <div className="bg-paper border-b border-ink border-2">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-[12px] font-medium font-medium text-ink/60 uppercase">PanelFlow</span>
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="bg-paper rounded-sm border-2 border-ink overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 min-h-[600px] relative">
            <div className="border-b border-ink border-2 p-4 md:p-6 md:border-b-0 md:border-r">
              <div className="mb-6">
                <span className="inline-block px-3 py-1 bg-sage/20 text-sage rounded-sm text-xs font-bold uppercase tracking-wider">
                  Rescheduling
                </span>
              </div>
              <h2 className="text-xs font-medium text-ink/60 uppercase tracking-wide mb-1">
                {user.name}
              </h2>
              <h1 className="text-2xl font-bold text-ink mb-4">{eventType.title}</h1>

              <div className="flex flex-col gap-3 text-[14px] font-display font-semibold tracking-wide text-ink/70">
                <div className="flex items-center gap-2 font-medium">
                  <span className="material-symbols-outlined text-lg">schedule</span>
                  {eventType.duration} min
                </div>
                
                <div className="mt-4 p-3 bg-clay/5 rounded-sm border-2 border-ink">
                  <p className="text-xs font-bold text-ink/60 uppercase mb-2">Original Time</p>
                  <p className="font-medium text-ink/90">
                    {formatInTimeZone(prevBookingDate, hostTimeZone, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-ink/70">
                    {formatInTimeZone(prevBookingDate, hostTimeZone, 'h:mma')} - {formatInTimeZone(new Date(booking.endTime), hostTimeZone, 'h:mma')}
                  </p>
                </div>
              </div>
              
              {selectedSlot && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-sm">
                  <p className="text-xs font-bold text-stamp uppercase mb-2">New Time</p>
                  <p className="font-bold text-ink">
                     {formatInTimeZone(new Date(selectedSlot), hostTimeZone, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-ink/80 font-medium">
                     {formatInTimeZone(new Date(selectedSlot), hostTimeZone, 'h:mma')}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 md:col-span-2">
              <h2 className="text-lg font-bold text-ink mb-4">Select a New Date & Time</h2>

              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  disabled={isBefore(startOfMonth(currentMonth), startOfMonth(new Date()))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded transition-colors hover:bg-clay/10 disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-xl text-ink/70">chevron_left</span>
                </button>
                <span className="text-base font-bold text-ink">{format(currentMonth, 'MMMM yyyy')}</span>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded transition-colors hover:bg-clay/10"
                >
                  <span className="material-symbols-outlined text-xl text-ink/70">chevron_right</span>
                </button>
              </div>

              <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex-1">
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                      <div key={d} className="text-center text-[10px] font-bold text-ink/60 py-2 sm:text-xs">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {paddingDays.map((_, i) => (
                      <div key={`padding-${i}`} />
                    ))}
                    {daysInMonth.map((day, i) => {
                      const past = isBefore(day, startOfDay(new Date()));
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      return (
                        <button
                          key={i}
                          disabled={past}
                          onClick={() => handleDateClick(day)}
                          className={`aspect-square rounded-sm text-[14px] font-display font-semibold tracking-wide font-medium transition-colors m-auto flex items-center justify-center w-10 h-10
 ${past ? 'text-clay/50 cursor-not-allowed' : ''}
 ${isSelected ? 'bg-stamp text-paper hover:bg-blue-700' : 'text-ink/80 hover:bg-clay/10'}
 ${isToday(day) && !isSelected ? 'bg-blue-50 text-stamp font-bold' : ''}`}
                        >
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 text-xs text-ink/60 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">public</span>
                    Times shown in <strong className="text-ink/80">{hostTimeZone}</strong>
                  </div>
                </div>

                {selectedDate && (
                  <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-ink border-2 pt-6 lg:pt-0 lg:pl-6">
                    <div className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink mb-4 text-center lg:text-left">
                      {format(selectedDate, 'EEEE, MMMM d')}
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                      {slotsLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="h-5 w-5 animate-spin rounded-sm border-b-2 border-stamp border-2" />
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <div className="text-center py-8 text-ink/60 text-[14px] font-display font-semibold tracking-wide">
                          No time slots available
                        </div>
                      ) : (
                        availableSlots.map((slotIso) => {
                          const slotTime = formatInTimeZone(new Date(slotIso), hostTimeZone, 'h:mma');
                          const isSelected = selectedSlot === slotIso;

                          return (
                            <div key={slotIso} className="flex flex-col gap-2">
                              <button
                                onClick={() => setSelectedSlot(slotIso)}
                                className={`w-full py-3 px-4 rounded-sm text-[14px] font-display font-semibold tracking-wide font-bold transition-all
 ${isSelected
 ? 'bg-slate-800 text-paper '
 : 'bg-paper border-2 border-ink text-stamp hover:border-stamp border-2 hover:border-2 hover:py-[11px] hover:px-[15px]'
 }`}
                              >
                                {slotTime}
                              </button>
                              {isSelected && (
                                <button
                                  onClick={handleReschedule}
                                  disabled={isSubmitting}
                                  className="w-full rounded-sm bg-stamp py-3 text-[14px] font-display font-semibold tracking-wide font-bold text-paper transition-colors hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                  {isSubmitting ? 'Confirming...' : 'Confirm Reschedule'}
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={closeAlert}
      />
    </div>
  );
}
