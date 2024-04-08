// This script includes functions for listing event types and creating a new event (appointment) on Calendly. Please ensure you replace 'YourCalendlyAPIToken' with your actual Calendly API token and adjust the event type UUID, invitee email, and start/end times as per your requirement.

// javascript
import axios from "axios"

const apiToken = process.env.CALLENDY_API;
const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
};

// Function to list event types
export async function listEventTypes() {
    try {
        const response = await axios.get('https://api.calendly.com/event_types', { headers });
        return response.data;
    } catch (error) {
        console.error('Failed to retrieve event types:', error);
        return null;
    }
}

// Function to create a new event (appointment)
export async function createEvent(email:string, eventTypeUuid:string, startTime: string, endTime: string) {
    try {
        const data = {
            event_type_uuid: eventTypeUuid,
            start_time: startTime,
            end_time: endTime,
            invitees: [
                { email }
            ]
        };
        const response = await axios.post('https://api.calendly.com/scheduled_events', data, { headers });
        return response.data;
    } catch (error) {
        console.error('Failed to create event:', error);
        return null;
    }
}


// // Example usage
// (async () => {
//     // List event types
//     const eventTypes = await listEventTypes();
//     console.log(eventTypes);


//     // Create an event
//     // Replace these values with your actual data
//     const email = 'invitee@example.com';
//     const eventTypeUuid = 'your-event-type-uuid';
//     const startTime = '2024-01-01T09:00:00Z'; // ISO 8601 format
//     const endTime = '2024-01-01T10:00:00Z';   // ISO 8601 format
//     const event = await createEvent(email, eventTypeUuid, startTime, endTime);
//     console.log(event);
// })();


// This script requires Axios for making HTTP requests, a promise-based HTTP client popular in the Node.js ecosystem. If you haven't already installed Axios in your project, you can do so by running npm install axios in your project directory.

// Please ensure you adjust the placeholder values in the script with actual data specific to your Calendly setup, such as the API token, event type UUID, invitee email, and the start/end times for the event.