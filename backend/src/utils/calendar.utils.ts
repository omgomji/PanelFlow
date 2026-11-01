import ical, { ICalCalendarMethod } from 'ical-generator';

export function generateBookingIcs(params: {
  uid: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
}): string {
  const calendar = ical({
    name: 'PanelFlow Calendar',
    method: ICalCalendarMethod.REQUEST,
  });

  calendar.createEvent({
    id: params.uid,
    start: params.startTime,
    end: params.endTime,
    summary: params.title,
    description: params.description,
    location: params.location || 'Remote / Google Meet / Zoom',
    organizer: {
      name: params.organizerName,
      email: params.organizerEmail,
    },
    attendees: [
      {
        name: params.attendeeName,
        email: params.attendeeEmail,
        rsvp: true,
      },
    ],
  });

  return calendar.toString();
}

