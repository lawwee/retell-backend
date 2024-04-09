import axios from "axios";

export async function checkAvailability(): Promise<string[]> {
  try {
    const response = await axios.get(
      `https://api.calendly.com/user_availability_schedules`,
      {
        params: {
          user: process.env.CALLENDY_URI,
        },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CALLENDY_API}`,
        },
      },
    );

    const availableTimes: string[] = [];

    response.data.collection.forEach((schedule: any) => {
      schedule.rules.forEach((rule: any) => {
        if (rule.intervals && rule.intervals.length > 0) {
          rule.intervals.forEach((interval: any) => {
            const { from } = interval; // Destructure from
            const [hour, minute] = from.split(":").map(Number); // Extract hour and minute

            // Convert 24-hour format to 12-hour format
            const period = hour >= 12 ? "pm" : "am";
            const formattedHour = (hour % 12 || 12).toString(); // Convert hour to 12-hour format

            const formattedMinute = minute.toString().padStart(2, "0"); // Add leading zero if minute < 10

            const formattedTime = `${formattedHour}:${formattedMinute}${period}`;

            availableTimes.push(`${rule.wday}: ${formattedTime}`);
          });
        }
      });
    });

    return availableTimes;
  } catch (error) {
    console.error("Error fetching available times from Calendly:", error);
    return []; // Return an empty array in case of error
  }
}
