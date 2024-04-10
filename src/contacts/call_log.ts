import {Schema, model} from "mongoose";
import { Ilogs } from "../types";
const dailyStatsSchema = new Schema<Ilogs>({
  date: {
    type: Date,
    required: true,
  },
  totalCalls: {
    type: Number,
    default: 0,
  },
  callsAnswered: {
    type: Number,
    default: 0,
  },
  callsNotAnswered: {
    type: Number,
    default: 0,
  },
  agentId: {
    type: String
  }
});

// Create model for daily call statistics
export const DailyStats = model("DailyStats", dailyStatsSchema);
