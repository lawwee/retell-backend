import { contactModel, EventModel } from "./contacts/contact_model";
import {
  reviewCallback,
  reviewTranscript
} from "./helper-fuction/transcript-review";
import { format } from "date-fns";
import OpenAI from "openai";
import { callstatusenum } from "./utils/types";
import callHistoryModel from "./contacts/history_model";
import Retell from "retell-sdk";
const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});

// import { EventModel } from "./contacts/contact_model";
// import callHistoryModel from "./contacts/history_model";
// import { callSentimentenum } from "./utils/types";

export async function script() {
  try {
    const contacts = await contactModel.find({tag: "dmm-test-list", dial_status:"on call"})

    for (const contact of contacts) {
      console.log(contact.callId);
      const callid = contact.callId.toString()
      const callResponse = await retell.call.retrieve(callid);

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
        const isDNC =
        analyzedTranscript.message.content === "dnc";

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


        function convertMsToHourMinSec(ms: number): string {
          const totalSeconds = Math.floor(ms / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
  
          return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
            2,
            "0",
          )}:${String(seconds).padStart(2, "0")}`;
        }

        let agentNameEnum;
        if (callResponse.agent_id === "agent_32a895d5bc1ab924ef8eb6992f") {
          agentNameEnum = "ARS";
        } else if (callResponse.agent_id === "agent_e503fb8dd8e5c7534918801979") {
          agentNameEnum = "LQR";
        } else if (callResponse.agent_id === "agent_155d747175559aa33eee83a976") {
          agentNameEnum = "SDR";
        } else if (callResponse.agent_id === "214e92da684138edf44368d371da764c") {
          agentNameEnum = "TVAG";
        } else if (callResponse.agent_id === "agent_07ff7f6c39540e4e71a5c71385") {
          agentNameEnum = "DMM";
        } else if (callResponse.agent_id === "agent_e38445b7ca6a51d392bb9b5807") {
          agentNameEnum = "TNP";
        } else if (callResponse.agent_id === "........") {
          agentNameEnum = "DME";
        }
        const todays = new Date();
        todays.setHours(0, 0, 0, 0);
        const todayString = todays.toISOString().split("T")[0];
        const callData = {
          callId: callResponse.call_id,
          agentId: callResponse.agent_id,
          userFirstname: callResponse.retell_llm_dynamic_variables?.user_firstname || null,
          userLastname: callResponse.retell_llm_dynamic_variables?.user_lastname || null,
          userEmail: callResponse.retell_llm_dynamic_variables?.user_email || null,
          recordingUrl: callResponse.recording_url || null,
          disconnectionReason: disconnection_reason || null,
          callStatus: callResponse.call_status,
          startTimestamp: callResponse.start_timestamp || null,
          endTimestamp: callResponse.end_timestamp || null,
          durationMs:
            (callResponse.end_timestamp - callResponse.start_timestamp) || 0,
          transcript: callResponse.transcript || null,
          transcriptObject: callResponse.transcript_object || [],
          transcriptWithToolCalls:
            callResponse.transcript_with_tool_calls || [],
          publicLogUrl: callResponse.public_log_url || null,
          callType: callResponse.call_type || null,
          customAnalysisData:callResponse.call_analysis,
          fromNumber: (callResponse as any).from_number || null,
          toNumber:  (callResponse as any).to_number|| null,
          direction: (callResponse as any).direction || null,
          agentName: agentNameEnum,
          date: todayString,
          address: callResponse.retell_llm_dynamic_variables?.user_address || null
        };
        await callHistoryModel.findOneAndUpdate(
          { callId: callResponse.agent_id, agentId: callResponse.agent_id },
          { $set: callData },
          { upsert: true, returnOriginal: false },
        );
      }
    }

    console.log("Contacts updated successfully.");
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

// export async function script() {
//   try {
//     // Fetch all documents from the callHistoryModel
//     const results = await callHistoryModel.find({agentName:{$exists:true}});

//     // Initialize a counter to track the number of matched documents
//     let matchCounter = 0;

//     // Prepare an array for bulk update operations on EventModel
//     const bulkOpsEventModel = [];

//     // Iterate over the documents in the callHistoryModel
//     for (const doc of results) {
//       const callId = doc.callId; // Assuming the callHistory model has a field `callId`

//       // Find the corresponding document in the EventModel using callId
//       const eventDoc = await EventModel.findOne({ callId });

//       // If a matching document is found in the EventModel
//       if (eventDoc) {
//         // Increment the matchCounter
//         matchCounter++;

//         // Add the update operation to the bulkOps array
//         bulkOpsEventModel.push({
//           updateOne: {
//             filter: { _id: eventDoc._id }, // Match the EventModel by its ID
//             update: {
//               $set: {
//                 retellCallStatus: doc.callStatus,
//                 duration: doc.durationMs,
//                 agentName: doc.agentName,
//                 timestamp: doc.endTimestamp
//                 // Add any other fields you want to update
//               },
//             },
//           },
//         });

//         // Log the counter and the successful update
//         console.log(`Matched and updated ${matchCounter}: EventModel with callId: ${callId} updated.`);
//       } else {
//         // Log that no matching EventModel was found for this callId
//         console.log(`No matching EventModel found for callId: ${callId}`);
//       }
//     }

//     // Execute the bulk update operation if there are any updates
//     if (bulkOpsEventModel.length > 0) {
//       const result = await EventModel.bulkWrite(bulkOpsEventModel);
//       console.log(`Bulk update successful: ${result.modifiedCount} documents updated.`);
//     } else {
//       console.log("No documents to update.");
//     }
//   } catch (error) {
//     console.log("Error in script:", error);
//   }
// }
