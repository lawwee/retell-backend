import { dailyGraphModel } from "./graphModel";


export async function updateStatsByHour(agentId: string, date: string, timestamp: Date) {
  try {
    
    const currentHour = new Date(timestamp).toISOString().slice(11, 13); 
    const hourKey = `${currentHour}:00`;

    
    const statsUpdate = {
      $inc: {
        totalCalls: 1,
        [`hourlyCalls.${hourKey}`]: 1,
      },
    };

    
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
