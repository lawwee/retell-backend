import { Schema, model } from "mongoose";
import { Itranscript } from "../types";


const transcriptSchema = new Schema<Itranscript>(
  {
    transcript: {
        type: String
    }
  },
  { timestamps: true },
);

export const contactModel = model<Itranscript>("RetellTranscript", transcriptSchema);
