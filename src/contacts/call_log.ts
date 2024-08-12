import { Schema, model } from "mongoose";
import { Ilogs } from "../types";
const dailyStatsSchema = new Schema<Ilogs>(
  {
    day: { type: String },
    totalCalls:{type: Number},
    totalTransffered:{type: Number},
    totalAnsweredByVm:{type: Number},
    totalFailed: {type:Number},
    totalAppointment:{type: Number},
    agentId:{type:String}

  },
  { timestamps: true },
);

// Create model for daily call statistics
export const DailyStatsModel = model("DailyStats", dailyStatsSchema);
