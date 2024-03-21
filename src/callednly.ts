limport axios from "axios";
export const getevent = async ()=>{
try {
  const apiToken = process.env.CALLENDY_API;
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };
  const response = await axios.get("https://api.calendly.com/event_types", {
    headers,
  });
  const eventTypes = response.data;
} catch (error) {
  if (axios.isAxiosError(error)) {
    console.error("Failed to retrieve event types:", error);
  } else {
    console.error("Failed to retrieve event types:", error);
  }
}
}



async function bookAppointmentWithCalendly(
  appointmentType: string,
  date:string,
  time:string,
  participantName:string,
  participantEmail:string,
) {
  try {
    // Make a POST request to Calendly's API to create an appointment
    const response = await axios.post(
      "https://api.calendly.com/scheduled_events",
      {
        event_type_uuid: appointmentType, // The UUID of the event type in Calendly
        start_time: `${date}T${time}:00Z`, // The start time of the appointment
        end_time: `${date}T${time}:30Z`, // Assuming appointment duration is 30 minutes
        invitee: {
          name: participantName, // Participant's name
          email: participantEmail, // Participant's email
        },
      },
      {
        headers: {
          Authorization: "Bearer YOUR_CALDENDLY_API_KEY", // Replace with your Calendly API key
          "Content-Type": "application/json",
        },
      },
    );

    // Check if the appointment was successfully created
    if (response.status === 201) {
      console.log("Appointment successfully created with Calendly");
      return true;
    } else {
      console.error("Failed to create appointment with Calendly");
      return false;
    }
  } catch (error) {
    console.error("Error creating appointment with Calendly:", error);
    return false;
  }
}

module.exports = { bookAppointmentWithCalendly };
