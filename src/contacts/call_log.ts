import {Schema, model} from "mongoose";
import { Ilogs } from "../types";
const dailyStatsSchema = new Schema<Ilogs>({
  myDate: {
    type: String,
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
  },
}, {timestamps: true});

// Create model for daily call statistics
export const DailyStats = model("DailyStats", dailyStatsSchema);
