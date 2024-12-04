import { contactModel, EventModel } from "./contacts/contact_model";
import {
  reviewCallback,
  reviewTranscript,
} from "./helper-fuction/transcript-review";
import { format } from "date-fns";
import OpenAI from "openai";
import { callstatusenum } from "./utils/types";
import callHistoryModel from "./contacts/history_model";
import Retell from "retell-sdk";
const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});

export async function script() {
  try {
    const contacts = await callHistoryModel.find().limit(1000).exec();

    for (const contact of contacts) {
      console.log(contact.callId);
      const callResponse = await retell.call.retrieve(contact.callId);

      if (callResponse) {
        const { user_firstname, user_lastname } =
          callResponse.retell_llm_dynamic_variables as {
            user_firstname: string;
            user_lastname: string;
          };
        let callStatus;
        let analyzedTranscript;
        const disconnection_reason = callResponse.disconnection_reason;
        const isCallFailed = disconnection_reason === "dial_failed";
        const isCallTransferred = disconnection_reason === "call_transfer";
        // const isMachine = disconnection_reason === "voicemail_reached";
        const isDialNoAnswer = disconnection_reason === "dial_no_answer";
        const isCallInactivity = disconnection_reason === "inactivity";
        const isCallAnswered =
          disconnection_reason === "user_hangup" ||
          disconnection_reason === "agent_hangup";

        analyzedTranscript = await reviewTranscript(callResponse.transcript);
        const isCallScheduled =
          analyzedTranscript.message.content === "scheduled";
        const isMachine = analyzedTranscript.message.content === "voicemail";
        const isIVR = analyzedTranscript.message.content === "ivr";

        if (isMachine) {
          callStatus = callstatusenum.VOICEMAIL;
        } else if (isIVR) {
          callStatus = callstatusenum.IVR;
        } else if (isCallFailed) {
          callStatus = callstatusenum.FAILED;
        } else if (isCallTransferred) {
          callStatus = callstatusenum.TRANSFERRED;
        } else if (isDialNoAnswer) {
          callStatus = callstatusenum.NO_ANSWER;
        } else if (isCallScheduled) {
          callStatus = callstatusenum.SCHEDULED;
        } else if (isCallInactivity) {
          callStatus = callstatusenum.INACTIVITY;
        } else if (isCallAnswered) {
          callStatus = callstatusenum.CALLED;
        }

        // const analyzedTranscript = await reviewTranscript(callResponse.transcript);
        const status = callStatus;
        const summary = callResponse.call_analysis.call_summary;
        const sentiment = analyzedTranscript.message.content;

        if (user_firstname) {
          contact.userFirstname = user_firstname || contact.userFirstname;
          contact.userLastname = user_lastname || contact.userLastname;
          contact.callSummary = summary;
          contact.userSentiment = sentiment;
          contact.callStatus = status;

          await contact.save();
        }
      }
    }

    console.log("Contacts updated successfully.");
  } catch (error) {
    console.error("Error occurred:", error);
  }
}
