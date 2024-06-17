import axios from "axios";

export async function checkAvailability(): Promise<string[]> {
  try {
    // Get the current time
    const currentTime = new Date();

    // Add 2 minutes to the current time
    const twoMinutesLater = new Date(currentTime.getTime() + 2 * 60000); // 2 minutes = 2 * 60,000 milliseconds

    // Format the dates in the desired ISO 8601 format
    const startDate = twoMinutesLater.toISOString();
    const endDate = new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days = 7 * 24 * 60 * 60 * 1000 milliseconds

    const response = await axios.get(
      `https://api.calendly.com/event_type_available_times`,
      {
        params: {
         event_type: process.env.CALLENDY_URI,
         start_time:startDate,
         end_time:endDate
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CALLENDY_API}`,
        },
      },
    );

    const availableTimes: string[] = [];

    response.data.collection.forEach((schedule: any) => {
      if (schedule.status === 'available') { // Check if status is available
        const startTime = new Date(schedule.start_time); // Parse the start time

        // Get the day of the week
        const dayOfWeek = startTime.toLocaleString('en-US', { weekday: 'long' });

        // Convert the start time to 12-hour format
        const formattedTime = startTime.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

        // Construct the result string
        const resultString = `${dayOfWeek} ${formattedTime}`;

        // Add the formatted time to the list of available times
        availableTimes.push(resultString);
      }
    });

    return availableTimes.slice(0,2);
  } catch (error) {
    console.log("Error fetching available times from Calendly:", error);  
    return []; // Return an empty array in case of error
  }
}
