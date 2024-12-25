import { dailyGraphModel } from "./graphModel";
import { DateTime } from 'luxon'; // You can use the luxon library to manage time zones

export async function updateStatsByHour(agentId: string, date: string, timestamp: Date) {
  try {
    // Convert the timestamp to PST using Luxon
    const pstTime = DateTime.fromJSDate(timestamp).setZone('America/Los_Angeles'); // Convert to PST/PDT
    const currentHour = pstTime.toFormat('HH'); // Get the hour in 'HH' format (24-hour clock)
    const hourKey = `${currentHour}:00`; // Form the hour key

    const statsUpdate = {
      $inc: {
        totalCalls: 1,
        [`hourlyCalls.${hourKey}`]: 1,
      },
    };

    // Update the stats or insert a new document if not found
    const updatedStats = await dailyGraphModel.findOneAndUpdate(
      { date, agentId },
      statsUpdate,
      { upsert: true, new: true }
    );

    return updatedStats;
  } catch (error) {
    console.error("Error in updateStatsByHour:", error);
    throw error;
  }
}
