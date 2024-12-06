// import { contactModel, EventModel } from "./contacts/contact_model";
// import {
//   reviewCallback,
//   reviewTranscriptForSentiment,
// } from "./helper-fuction/transcript-review";
// import { format } from "date-fns";
// import OpenAI from "openai";
// import { callstatusenum } from "./utils/types";
// import callHistoryModel from "./contacts/history_model";
// import Retell from "retell-sdk";
// const retell = new Retell({
//   apiKey: process.env.RETELL_API_KEY,
// });

import { EventModel } from "./contacts/contact_model";
import callHistoryModel from "./contacts/history_model";
import { callSentimentenum } from "./utils/types";

// export async function script() {
//   try {
//     const contacts = await callHistoryModel.find().limit(1000).exec();

//     for (const contact of contacts) {
//       console.log(contact.callId);
//       const callResponse = await retell.call.retrieve(contact.callId);

//       if (callResponse) {
//         const { user_firstname, user_lastname } =
//           callResponse.retell_llm_dynamic_variables as {
//             user_firstname: string;
//             user_lastname: string;
//           };
//         let callStatus;
//         let analyzedTranscript;
//         const disconnection_reason = callResponse.disconnection_reason;
//         const isCallFailed = disconnection_reason === "dial_failed";
//         const isCallTransferred = disconnection_reason === "call_transfer";
//         // const isMachine = disconnection_reason === "voicemail_reached";
//         const isDialNoAnswer = disconnection_reason === "dial_no_answer";
//         const isCallInactivity = disconnection_reason === "inactivity";
//         const isCallAnswered =
//           disconnection_reason === "user_hangup" ||
//           disconnection_reason === "agent_hangup";

//         analyzedTranscript = await reviewTranscriptForSentiment(callResponse.transcript);
//         const isCallScheduled =
//           analyzedTranscript.message.content === "scheduled";
//         const isMachine = analyzedTranscript.message.content === "voicemail";
//         const isIVR = analyzedTranscript.message.content === "ivr";

//         if (isMachine) {
//           callStatus = callstatusenum.VOICEMAIL;
//         } else if (isIVR) {
//           callStatus = callstatusenum.IVR;
//         } else if (isCallFailed) {
//           callStatus = callstatusenum.FAILED;
//         } else if (isCallTransferred) {
//           callStatus = callstatusenum.TRANSFERRED;
//         } else if (isDialNoAnswer) {
//           callStatus = callstatusenum.NO_ANSWER;
//         } else if (isCallScheduled) {
//           callStatus = callstatusenum.SCHEDULED;
//         } else if (isCallInactivity) {
//           callStatus = callstatusenum.INACTIVITY;
//         } else if (isCallAnswered) {
//           callStatus = callstatusenum.CALLED;
//         }

//         // const analyzedTranscript = await reviewTranscript(callResponse.transcript);
//         const status = callStatus;
//         const summary = callResponse.call_analysis.call_summary;
//         const sentiment = analyzedTranscript.message.content;

//         if (user_firstname) {
//           contact.userFirstname = user_firstname || contact.userFirstname;
//           contact.userLastname = user_lastname || contact.userLastname;
//           contact.callSummary = summary;
//           contact.userSentiment = sentiment;
//           contact.callStatus = status;

//           await contact.save();
//         }
//       }
//     }

//     console.log("Contacts updated successfully.");
//   } catch (error) {
//     console.error("Error occurred:", error);
//   }
// }

export async function script() {
  try {
    // Fetch all documents from the callHistoryModel
    const results = await callHistoryModel.find({agentName:{$exists:true}});

    // Initialize a counter to track the number of matched documents
    let matchCounter = 0;

    // Prepare an array for bulk update operations on EventModel
    const bulkOpsEventModel = [];

    // Iterate over the documents in the callHistoryModel
    for (const doc of results) {
      const callId = doc.callId; // Assuming the callHistory model has a field `callId`

      // Find the corresponding document in the EventModel using callId
      const eventDoc = await EventModel.findOne({ callId });

      // If a matching document is found in the EventModel
      if (eventDoc) {
        // Increment the matchCounter
        matchCounter++;

        // Add the update operation to the bulkOps array
        bulkOpsEventModel.push({
          updateOne: {
            filter: { _id: eventDoc._id }, // Match the EventModel by its ID
            update: {
              $set: {
                retellCallStatus: doc.callStatus,
                duration: doc.durationMs,
                agentName: doc.agentName,
                timestamp: doc.endTimestamp
                // Add any other fields you want to update
              },
            },
          },
        });

        // Log the counter and the successful update
        console.log(`Matched and updated ${matchCounter}: EventModel with callId: ${callId} updated.`);
      } else {
        // Log that no matching EventModel was found for this callId
        console.log(`No matching EventModel found for callId: ${callId}`);
      }
    }

    // Execute the bulk update operation if there are any updates
    if (bulkOpsEventModel.length > 0) {
      const result = await EventModel.bulkWrite(bulkOpsEventModel);
      console.log(`Bulk update successful: ${result.modifiedCount} documents updated.`);
    } else {
      console.log("No documents to update.");
    }
  } catch (error) {
    console.log("Error in script:", error);
  }
}
