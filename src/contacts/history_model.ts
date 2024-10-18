import mongoose, { Schema, Document } from 'mongoose';

interface ICallData extends Document {
  callId: string;
  agentId: string;
  retellLLMDynamicVariables: {
    userFirstname: string;
    userEmail: string;
    userLastname: string;
  };
  callStatus: string;
  startTimestamp: number;
  endTimestamp: number;
  durationMs: number;
  transcript: string;
  publicLogUrl: string;
  disconnectionReason: string;
  costMetadata: {
    telecommunication: string;
    llmModel: string;
    voiceProvider: string;
  };
  callCost: {
    productCosts: any[];
    totalDurationUnitPrice: number;
    totalDurationSeconds: number;
    totalOneTimePrice: number;
    combinedCost: number;
  };
  callType: string;
  fromNumber: string;
  toNumber: string;
  direction: string;
  callEndedData?: {
    
    endReason?: string; 
  };
  callAnalyzedData?: {
    callAnalysis: {
      callSummary: string;
      inVoicemail: boolean;
      userSentiment: string;
      callSuccessful: boolean;
      agentTaskCompletionRating: string;
      callCompletionRating: string;
      customAnalysisData: object;
    };
  };
}

const CallDataSchema = new Schema<ICallData>({
  callId: { type: String, required: true },
  agentId: { type: String, required: true },
  retellLLMDynamicVariables: {
    userFirstname: { type: String, required: true },
    userEmail: { type: String, required: true },
    userLastname: { type: String, required: true },
  },
  callStatus: { type: String, required: true },
  startTimestamp: { type: Number, required: true },
  endTimestamp: { type: Number, required: true },
  durationMs: { type: Number, required: true },
  transcript: { type: String, required: true },
  publicLogUrl: { type: String, required: true },
  disconnectionReason: { type: String, required: true },
  costMetadata: {
    telecommunication: { type: String, required: true },
    llmModel: { type: String, required: true },
    voiceProvider: { type: String, required: true },
  },
  callCost: {
    productCosts: { type: [Object] },
    totalDurationUnitPrice: { type: Number,  },
    totalDurationSeconds: { type: Number,  },
    totalOneTimePrice: { type: Number, },
    combinedCost: { type: Number, required: true },
  },
  callType: { type: String, required: true },
  fromNumber: { type: String, required: true },
  toNumber: { type: String, required: true },
  direction: { type: String, },
  callEndedData: {
    endReason: { type: String }, 
  },
  callAnalyzedData: {
    callAnalysis: {
      callSummary: { type: String },
      inVoicemail: { type: Boolean },
      userSentiment: { type: String },
      callSuccessful: { type: Boolean },
      agentTaskCompletionRating: { type: String },
      callCompletionRating: { type: String },
      customAnalysisData: { type: Object },
    },
  },
});

const callHistoryModel = mongoose.model<ICallData>('callHistory', CallDataSchema);

export default callHistoryModel;
