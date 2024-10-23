import axios from "axios"

const apiToken = process.env.CALLENDY_API;
const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
};


export async function listEventTypes() {
    try {
        const response = await axios.get('https://api.calendly.com/event_types', { headers });
        return response.data;
    } catch (error) {
        console.error('Failed to retrieve event types:', error);
        return null;
    }
}

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

