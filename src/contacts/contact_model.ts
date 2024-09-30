import { Schema, model } from "mongoose";
import mongoose from "mongoose";
import {
  DaysToBeProcessedEnum,
  IContact,
  Ijob,
  callstatusenum,
  jobstatus,
} from "../types";

const ContactSchema = new Schema<IContact>(
  {
    firstname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
    },
    phone: {
      type: String,
      required: true,
    },
    isusercalled: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    callId: {
      type: String,
    },
    agentId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(callstatusenum),
      default: callstatusenum.NOT_CALLED,
    },
    referenceToCallId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "transcript",
    },
    linktocallLogModel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyStats",
    },
    datesCalled: {
      type: [String],
      default: [],
    },
    answeredByVM: {
      type: Boolean,
      default: false,
    },
    dayToBeProcessed: {
      type: String,
      enum: Object.values(DaysToBeProcessedEnum),
    },
    tag: {
      type: String,
    },
    jobProcessedWithId: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

const jobschema = new Schema<Ijob>(
  {
    callstatus: {
      type: String,
      enum: Object.values(jobstatus),
    },
    jobId: {
      type: String,
      required: true,
    },
    processedContacts: {
      type: Number,
      default: 0,
    },
    processedContactsForRedial: {
      type: Number,
      default: 0,
    },
    agentId: {
      type: String,
    },
    scheduledTime: { type: String },
    shouldContinueProcessing: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const transcriptSchema = new Schema(
  {
    callId: {
      type: String,
    },
    transcript: { type: String },
    recordingUrl: { type: String },
    retellCallSummary: { type: String },
    userSentiment: { type: String },
    agentSemtiment: { type: String },
    disconnectionReason: { type: String },
    analyzedTranscript: { type: String },
    agentId:{type:String}
  },
  { timestamps: true },
);

export const EventModel = model("transcript", transcriptSchema);
export const contactModel = model<IContact>("Retell", ContactSchema);
export const jobModel = model<Ijob>("RetellJOb", jobschema);
const db = process.env.URL;

export const connectDb = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(db);
    console.log("MongoDB Connected to " + conn.connection.name);
  } catch (error) {
    console.log("Error: " + (error as Error).message);
    process.exit(1);
  }
};
