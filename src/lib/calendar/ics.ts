/** --- YAML
 * name: ICS Generator
 * description: Generate .ics calendar files for appointments and subscription feeds
 * --- */

interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: Date;
  dtend: Date;
}

function formatDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function generateIcsEvent(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CRES-CA//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@cres-ca.com`,
    `DTSTART:${formatDate(event.dtstart)}`,
    `DTEND:${formatDate(event.dtend)}`,
    `SUMMARY:${escapeIcs(event.summary)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcs(event.location)}`);
  }

  lines.push(`DTSTAMP:${formatDate(new Date())}`);
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

export function generateIcsFeed(events: IcsEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CRES-CA//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CRES-CA Appointments',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}@cres-ca.com`);
    lines.push(`DTSTART:${formatDate(event.dtstart)}`);
    lines.push(`DTEND:${formatDate(event.dtend)}`);
    lines.push(`SUMMARY:${escapeIcs(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    lines.push(`DTSTAMP:${formatDate(new Date())}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
