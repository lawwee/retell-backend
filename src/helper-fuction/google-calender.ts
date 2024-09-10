import { google, calendar_v3 } from 'googleapis';

const auth = new google.auth.JWT(
  "=",
  undefined,
 "",  ['https://www.googleapis.com/auth/calendar'],
  '' // impersonate your main account
);

// Create the calendar API instance using the authenticated client
const calendar = google.calendar({ version: 'v3', auth });

// Function to create an event and notify the creator by email
export async function createGoogleCalendarEvent() {
  const event: calendar_v3.Schema$Event = {
    summary: 'Self-Reminder Event', // Event title
    start: {
      dateTime: '2024-09-10T09:00:00-07:00', // Start time
      timeZone: 'America/Los_Angeles',        // Time zone
    },
    end: {
      dateTime: '2024-09-10T10:00:00-07:00', // End time
      timeZone: 'America/Los_Angeles',       // Time zone
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 0 } // Send an email immediately when the event is created
      ]
    }
  };

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',                  // Use the primary calendar
      requestBody: event,
      sendUpdates: 'all'                      // Notify creator of the event
    });
    console.log('Event created:', response.data.htmlLink);
  } catch (err) {
    console.error('Error creating the event:', err);
  }
}
