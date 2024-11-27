import mongoose, { Schema } from "mongoose";

const LLMUpdateHistorySchema = new Schema({
    llm_id: { type: String, required: true },
    previousData: { type: Object, required: true },
    updatedData: { type: Object, required: true },
    timestamp: { type: Date, default: Date.now },
    updateIndex: { type: Number, required: true }, 
  }, {timestamps: true});
  
  export const LLMUpdateHistory = mongoose.model('LLMUpdateHistory', LLMUpdateHistorySchema);
  