'use client';

import { useState, useEffect, useCallback } from 'react';
import { getHostedBookings, getBookingFeedback, submitFeedback } from '@/lib/api';
import type { MeetingRecord } from '@/types/booking';
import type { Feedback, Recommendation } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';

export default function FeedbackPage() {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [selectedBooking, setSelectedBooking] = useState<number | null>(null);

  // Feedback viewer/editor state
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadMeetings = useCallback(async () => {
    try {
      const allMeetings = await getHostedBookings('past');
      // Filter out CANCELLED
      const valid = allMeetings.filter(m => m.status !== 'CANCELLED');
      setMeetings(valid);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleSelectBooking = async (bookingId: number) => {
    if (selectedBooking === bookingId) {
      setSelectedBooking(null);
      return;
    }
    
    setSelectedBooking(bookingId);
    setLoadingFeedbacks(true);
    setFormError('');
    try {
      const fbs = await getBookingFeedback(bookingId);
      setFeedbacks(fbs);
      
      const myFeedback = fbs.find(f => f.interviewerId === user?.id);
      if (myFeedback) {
        setRecommendation(myFeedback.recommendation);
        setNotes(myFeedback.notes || '');
      } else {
        setRecommendation('');
        setNotes('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !recommendation) return;
    
    setFormError('');
    setSubmitting(true);
    try {
      await submitFeedback(selectedBooking, { 
        recommendation: recommendation as Recommendation, 
        notes 
      });
      // Reload feedbacks to reveal others'
      const fbs = await getBookingFeedback(selectedBooking);
      setFeedbacks(fbs);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setFormError((err.response?.data as { error?: string })?.error || 'Failed to submit feedback');
      } else {
        setFormError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-sm border-b-2 border-stamp border-2" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Meeting Feedback</h1>
      
      {!meetings.length ? (
        <div className="rounded-sm border-2 border-dashed border-ink border-2 bg-clay/5 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-clay/50 mb-2">rate_review</span>
          <p className="font-medium text-ink/60">No past meetings found requiring feedback.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => {
            const isSelected = selectedBooking === meeting.id;
            return (
              <div key={meeting.id} className="rounded-sm border-2 border-ink bg-paper overflow-hidden">
                <div 
                  className={`px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-clay/5 transition-colors ${isSelected ? 'bg-clay/5 border-b border-ink border-2' : ''}`}
                  onClick={() => handleSelectBooking(meeting.id)}
                >
                  <div>
                    <h3 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">
                      {meeting.panel ? (
                        <>
                          <span className="text-ink/60 font-medium mr-1">{meeting.panel.position?.title} -</span>
                          {meeting.panel.title}
                        </>
                      ) : (
                        meeting.eventType?.title || 'Meeting'
                      )}{' '}
                      with {meeting.inviteeName}
                    </h3>
                    <div className="text-xs text-ink/60 mt-1 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">event</span>
                      {new Date(meeting.startTime).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {meeting.status === 'NO_SHOW' && (
                      <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">
                        No Show
                      </span>
                    )}
                    <span className="material-symbols-outlined text-ink/50">
                      {isSelected ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="p-5">
                    {loadingFeedbacks ? (
                      <div className="flex justify-center py-4">
                        <div className="h-5 w-5 animate-spin rounded-sm border-b-2 border-stamp border-2" />
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* My Feedback Form */}
                        <div className="flex-1">
                          <h4 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink mb-3">Your Feedback</h4>
                          
                          {formError && (
                            <div className="mb-4 rounded-sm bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                              {formError}
                            </div>
                          )}

                          <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                              <label className="block text-xs font-bold text-ink mb-2">Recommendation</label>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { val: 'STRONG_NO', label: 'Strong No', color: 'red' },
                                    { val: 'NO', label: 'No', color: 'orange' },
                                    { val: 'YES', label: 'Yes', color: 'emerald' },
                                    { val: 'STRONG_YES', label: 'Strong Yes', color: 'green' }
                                  ] as const
                                ).map((opt) => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => setRecommendation(opt.val as Recommendation)}
                                    className={`px-4 py-2 rounded-sm text-[14px] font-display font-semibold tracking-wide font-bold border transition-colors ${
                                      recommendation === opt.val
                                        ? `bg-${opt.color}-100 border-${opt.color}-200 text-${opt.color}-700`
                                        : 'bg-paper border-ink border-2 text-ink/70 hover:bg-clay/5'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-bold text-ink mb-1.5">Notes (Optional)</label>
                              <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border-2 border-ink rounded-sm text-[14px] font-display font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-stamp/30 focus:border-stamp border-2 resize-none"
                                placeholder="Any additional thoughts?"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={!recommendation || submitting}
                              className="rounded-sm bg-stamp px-5 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-paper hover:bg-blue-700 disabled:opacity-50"
                            >
                              {submitting ? 'Submitting...' : 'Submit Feedback'}
                            </button>
                          </form>
                        </div>

                        {/* Co-panelists Feedback */}
                        <div className="flex-1 md:border-l md:border-ink border-2 md:pl-6">
                          <h4 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink mb-3">Panel Feedback</h4>
                          
                          {!feedbacks.some(f => f.interviewerId === user?.id) && user?.role !== 'ADMIN' ? (
                            <div className="rounded-sm bg-clay/5 border-2 border-ink p-4 text-center">
                              <span className="material-symbols-outlined text-clay/50 text-2xl mb-1">lock</span>
                              <p className="text-xs font-medium text-ink/60">
                                Submit your own feedback first to see how others voted.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {feedbacks.length === 0 ? (
                                <p className="text-xs text-ink/60 italic">No feedback submitted yet.</p>
                              ) : (
                                feedbacks.map(fb => (
                                  <div key={fb.id} className="p-3 rounded-sm bg-clay/5 border-2 border-ink">
                                    <div className="flex justify-between items-center mb-1">
                                      <div className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">{fb.interviewer.name}</div>
                                      <div className="text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider bg-clay/20 text-ink/80">
                                        {fb.recommendation.replace('_', ' ')}
                                      </div>
                                    </div>
                                    {fb.notes && (
                                      <p className="text-xs text-ink/70 mt-2">{fb.notes}</p>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
