import { google, calendar_v3 } from 'googleapis';
import { readFileSync } from 'fs';

// Load the service account credentials from the downloaded JSON file
const credentials = JSON.parse(readFileSync('service-account.json', 'utf8'));

// Create a JWT client using the service account credentials
const auth = new google.auth.JWT(
  credentials.client_email,
  undefined,
  credentials.private_key,
  ['https://www.googleapis.com/auth/calendar']
);

// Create the calendar API instance using the authenticated client
const calendar = google.calendar({ version: 'v3', auth });

// Function to create an event
function createEvent() {
  const event: calendar_v3.Schema$Event = {
    summary: 'Sample Event',
    description: 'A chance to hear more about Google\'s developer products.',
    start: {
      dateTime: '2024-09-10T09:00:00-07:00',
      timeZone: 'America/Los_Angeles',
    },
    end: {
      dateTime: '2024-09-10T17:00:00-07:00',
      timeZone: 'America/Los_Angeles',
    },
    attendees: [
      { email: 'attendee1@example.com' },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 10 },
      ],
    },
  };

  calendar.events.insert(
    {
      calendarId: 'primary',
      requestBody: event,  
    },
    (err: Error | null, res) => {
      if (err) {
        console.error('There was an error contacting the Calendar service:', err);
        return;
      }
      console.log('Event created:', res?.data.htmlLink);
    }
  );
}
 
createEvent();
