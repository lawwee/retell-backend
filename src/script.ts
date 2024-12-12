import { contactModel, EventModel } from "./contacts/contact_model";
import {
  reviewCallback,
  reviewTranscript,
} from "./helper-fuction/transcript-review";
import { format } from "date-fns";
import OpenAI from "openai";
import { callSentimentenum, callstatusenum } from "./utils/types";
import callHistoryModel from "./contacts/history_model";
import Retell from "retell-sdk";
import { DateTime } from "luxon";
import { DailyStatsModel } from "./contacts/call_log";
import { resourceUsage } from "process";
const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});

// import { EventModel } from "./contacts/contact_model";
// import callHistoryModel from "./contacts/history_model";
// import { callSentimentenum } from "./utils/types";

// export async function script() {
//   try {
//     const contacts = await contactModel.find({
//       tag: "tnp-test-list",
//       dial_status: { $ne: "not-called" },
//     });

//     for (const contact of contacts) {
//       console.log(contact.callId);
//       const callid = contact.callId.toString();
//       const callResponse = await retell.call.retrieve(callid);

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

//         analyzedTranscript = await reviewTranscript(callResponse.transcript);
//         const isCallScheduled =
//           analyzedTranscript.message.content === "scheduled";
//         const isMachine = analyzedTranscript.message.content === "voicemail";
//         const isIVR = analyzedTranscript.message.content === "ivr";
//         const isDNC = analyzedTranscript.message.content === "dnc";

//         let statsUpdate: any = { $inc: {} };
//         statsUpdate.$inc.totalCalls = 1;
//         statsUpdate.$inc.totalCallDuration = (callResponse as any).duration_ms;
//         if (isMachine) {
//           statsUpdate.$inc.totalAnsweredByVm = 1;
//           callStatus = callstatusenum.VOICEMAIL;
//         } else if (isIVR) {
//           statsUpdate.$inc.totalAnsweredByIVR = 1;
//           callStatus = callstatusenum.IVR;
//         } else if (isCallScheduled) {
//           statsUpdate.$inc.totalAppointment = 1;
//           callStatus = callstatusenum.SCHEDULED;
//         } else if (isCallFailed) {
//           statsUpdate.$inc.totalFailed = 1;
//           callStatus = callstatusenum.FAILED;
//         } else if (isCallTransferred) {
//           statsUpdate.$inc.totalTransffered = 1;
//           callStatus = callstatusenum.TRANSFERRED;
//         } else if (isDialNoAnswer) {
//           statsUpdate.$inc.totalDialNoAnswer = 1;
//           callStatus = callstatusenum.NO_ANSWER;
//         } else if (isCallInactivity) {
//           statsUpdate.$inc.totalCallInactivity = 1;
//           callStatus = callstatusenum.INACTIVITY;
//         } else if (isCallAnswered) {
//           statsUpdate.$inc.totalCallAnswered = 1;

//           callStatus = callstatusenum.CALLED;
//         }

//         let analyzedTranscriptForSentiment;
//         analyzedTranscriptForSentiment = await reviewTranscript(
//           callResponse.transcript,
//         );
//         const isScheduled =
//           analyzedTranscriptForSentiment.message.content === "scheduled";
//         const isDNCs = analyzedTranscriptForSentiment.message.content === "dnc";
//         const isCall_Back =
//           analyzedTranscriptForSentiment.message.content === "call-back";
//         const isNeutral =
//           callResponse.call_analysis.user_sentiment === "Neutral";
//         const isUnknown =
//           callResponse.call_analysis.user_sentiment === "Unknown";
//         const isPositive =
//           callResponse.call_analysis.user_sentiment === "Positive";
//         const isNegative =
//           callResponse.call_analysis.user_sentiment === "Negative";

//         let sentimentStatus;
//         if (isScheduled) {
//           sentimentStatus = callSentimentenum.SCHEDULED;
//         } else if (isCall_Back) {
//           sentimentStatus = callSentimentenum.CALLBACK;
//         } else if (isDNCs) {
//           sentimentStatus = callSentimentenum.DNC;
//         } else if (isNeutral) {
//           sentimentStatus = callSentimentenum.NEUTRAL;
//         } else if (isPositive) {
//           sentimentStatus = callSentimentenum.POSITIVE;
//         } else if (isNegative) {
//           sentimentStatus = callSentimentenum.NEGATIVE;
//         } else if (isUnknown) {
//           sentimentStatus = callSentimentenum.UNKNOWN;
//         }

//         // const analyzedTranscript = await reviewTranscript(callResponse.transcript);
//         const status = callStatus;
//         const summary = callResponse.call_analysis.call_summary;
//         const sentiment = analyzedTranscript.message.content;

//         function convertMsToHourMinSec(ms: number): string {
//           const totalSeconds = Math.floor(ms / 1000);
//           const hours = Math.floor(totalSeconds / 3600);
//           const minutes = Math.floor((totalSeconds % 3600) / 60);
//           const seconds = totalSeconds % 60;

//           return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
//             2,
//             "0",
//           )}:${String(seconds).padStart(2, "0")}`;
//         }

//         let agentNameEnum;
//         if (callResponse.agent_id === "agent_32a895d5bc1ab924ef8eb6992f") {
//           agentNameEnum = "ARS";
//         } else if (
//           callResponse.agent_id === "agent_e503fb8dd8e5c7534918801979"
//         ) {
//           agentNameEnum = "LQR";
//         } else if (
//           callResponse.agent_id === "agent_155d747175559aa33eee83a976"
//         ) {
//           agentNameEnum = "SDR";
//         } else if (
//           callResponse.agent_id === "214e92da684138edf44368d371da764c"
//         ) {
//           agentNameEnum = "TVAG";
//         } else if (
//           callResponse.agent_id === "agent_07ff7f6c39540e4e71a5c71385"
//         ) {
//           agentNameEnum = "DMM";
//         } else if (
//           callResponse.agent_id === "agent_e38445b7ca6a51d392bb9b5807"
//         ) {
//           agentNameEnum = "TNP";
//         } else if (callResponse.agent_id === "........") {
//           agentNameEnum = "DME";
//         }
//         // const todays = new Date();
//         // todays.setHours(0, 0, 0, 0);
//         // const todayString = todays.toISOString().split("T")[0];
//         // const today = new Date();
//         // const year = today.getFullYear();
//         // const month = String(today.getMonth() + 1).padStart(2, "0");
//         // const day = String(today.getDate()).padStart(2, "0");
//         // const hours = String(today.getHours()).padStart(2, "0");
//         // const minutes = String(today.getMinutes()).padStart(2, "0");

//         // const todayStringWithTime = `${year}-${month}-${day}`;
//         // const time = `${hours}:${minutes}`;
//         const isoString = (contact as any).createdAt;

//         // Example ISO string

//         // Create a Date object from the ISO string
//         const date = new Date(isoString);

//         // Convert to PST (America/Los_Angeles) using Intl.DateTimeFormat
//         const options = { timeZone: "America/Los_Angeles", hour12: false };

//         // Format date to yyyy-MM-dd
//         const formattedDate = new Intl.DateTimeFormat("en-CA", {
//           ...options,
//           year: "numeric",
//           month: "2-digit",
//           day: "2-digit",
//         })
//           .format(date)
//           .replace(/\//g, "-"); // Replace slashes with dashes

//         // Format time to HH:mm
//         const formattedTime = new Intl.DateTimeFormat("en-US", {
//           ...options,
//           hour: "2-digit",
//           minute: "2-digit",
//         }).format(date);

//         // Ensure the time is formatted correctly to HH:mm
//         const timeParts = formattedTime.split(":");
//         const finalFormattedTime = `${timeParts[0]}:${timeParts[1].padStart(
//           2,
//           "0",
//         )}`; // Ensure minutes are always two digits

//         console.log(`Formatted Date: ${formattedDate}`);
//         console.log(`Formatted Time: ${finalFormattedTime}`);

//         const callData = {
//           callId: callResponse.call_id,
//           agentId: callResponse.agent_id,
//           userFirstname:
//             callResponse.retell_llm_dynamic_variables?.user_firstname || null,
//           userLastname:
//             callResponse.retell_llm_dynamic_variables?.user_lastname || null,
//           userEmail:
//             callResponse.retell_llm_dynamic_variables?.user_email || null,
//           recordingUrl: callResponse.recording_url || null,
//           disconnectionReason: disconnection_reason || null,
//           callStatus: callResponse.call_status,
//           startTimestamp: callResponse.start_timestamp || null,
//           endTimestamp: callResponse.end_timestamp || null,
//           durationMs:
//             convertMsToHourMinSec(
//               callResponse.end_timestamp - callResponse.start_timestamp,
//             ) || 0,
//           transcript: callResponse.transcript || null,
//           transcriptObject: callResponse.transcript_object || [],
//           transcriptWithToolCalls:
//             callResponse.transcript_with_tool_calls || [],
//           publicLogUrl: callResponse.public_log_url || null,
//           callType: callResponse.call_type || null,
//           customAnalysisData: callResponse.call_analysis,
//           fromNumber: (callResponse as any).from_number || null,
//           toNumber: (callResponse as any).to_number || null,
//           direction: (callResponse as any).direction || null,
//           agentName: agentNameEnum,
//           date: formattedDate,
//           address:
//             callResponse.retell_llm_dynamic_variables?.user_address || null,
//           callSummary: callResponse.call_analysis.call_summary,
//           userSentiment: sentimentStatus,
//         };
//         await callHistoryModel.findOneAndUpdate(
//           { callId: callResponse.agent_id, agentId: callResponse.agent_id },
//           { $set: callData },
//           { upsert: true, returnOriginal: false },
//         );

//         const callbackdate = await reviewCallback(callResponse.transcript);

//         const newDuration = convertMsToHourMinSec(
//           (callResponse as any).duration_ms,
//         );
//         const callEndedUpdateData = {
//           callId: callResponse.call_id,
//           agentId: callResponse.agent_id,
//           recordingUrl: callResponse.recording_url,
//           callDuration: newDuration,
//           disconnectionReason: disconnection_reason,
//           callBackDate: callbackdate,
//           retellCallStatus: callResponse.call_status,
//           agentName: agentNameEnum,
//           duration:
//             convertMsToHourMinSec(
//               callResponse.end_timestamp - callResponse.start_timestamp,
//             ) || 0,
//           timestamp: callResponse.end_timestamp,
//           transcript: callResponse.transcript,
//           retellCallSummary: callResponse.call_analysis.call_summary,
//           analyzedTranscript: sentimentStatus,
//           userSentiment: sentimentStatus,
//         };

//         const results = await EventModel.findOneAndUpdate(
//           { callId: callResponse.call_id, agentId: callResponse.agent_id },
//           { $set: callEndedUpdateData },
//           { upsert: true, returnOriginal: false },
//         );

//         const statsResults = await DailyStatsModel.findOneAndUpdate(
//           {
//             day: formattedDate,
//             agentId: callResponse.agent_id,
//             jobProcessedBy: callResponse.retell_llm_dynamic_variables.job_id,
//           },
//           statsUpdate,
//           { upsert: true, returnOriginal: false },
//         );

//         const linkToCallLogModelId = statsResults ? statsResults._id : null;
//         const resultForUserUpdate = await contactModel.findOneAndUpdate(
//           { callId: callResponse.call_id, agentId: callResponse.agent_id },
//           {
//             dial_status: callStatus,
//             $push: { datesCalled: formattedDate },
//             referenceToCallId: results._id,
//             timesCalled: formattedTime,
//             linktocallLogModel: linkToCallLogModelId,
//           },
//         );
//       }
//     }

//     console.log("Contacts updated successfully.");
//   } catch (error) {
//     console.error("Error occurred:", error);
//   }
// }

// export async function script() {
//   try {
//     const contacts = await callHistoryModel.find({userFirstname:{$exists:false}}).sort({createdAt: -1}).limit(5000)
    
//         function convertMsToHourMinSec(ms: number): string {
//           const totalSeconds = Math.floor(ms / 1000);
//           const hours = Math.floor(totalSeconds / 3600);
//           const minutes = Math.floor((totalSeconds % 3600) / 60);
//           const seconds = totalSeconds % 60;

//           return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
//             2,
//             "0",
//           )}:${String(seconds).padStart(2, "0")}`;
//         }
//     for(const contact of contacts){
     
//       const result = await retell.call.retrieve(contact.callId)
//       console.log(result.call_id)
//       const data = {
//         userFirstname: result.retell_llm_dynamic_variables.user_firstname,
//         userLastname: result.retell_llm_dynamic_variables.user_lastname,
//         userEmail: result.retell_llm_dynamic_variables.user_email,
//         callSummary: result.call_analysis.call_summary,
//         durationMs: convertMsToHourMinSec(result.end_timestamp - result.start_timestamp) || 0,
//         recordingUrl: result.recording_url,
//         userSentiment: result.call_analysis.user_sentiment,
//       }

//       await callHistoryModel.findOneAndUpdate({callId:result.call_id}, {$set:data})
//     }
//   } catch (error) {
    
//   }
  
// }
export async function script() {
  try {
    const batchSize = 100; // Define the size of each batch
    let contacts;

    do {
      contacts = await callHistoryModel
        .find({ userFirstname: { $exists: false },  agentId:"214e92da684138edf44368d371da764c" })
        .sort({ createdAt: -1 })
        .limit(batchSize);

      // If no contacts are returned, break the loop
      if (contacts.length === 0) break;

      const bulkOps = contacts.map(contact => {
        return retell.call.retrieve(contact.callId)
          .then(result => {
            console.log(`Processing contact with call ID: ${result.call_id}`); // Log for each contact processed
            
            return {
              updateOne: {
                filter: { callId: result.call_id },
                update: {
                  $set: {
                    userFirstname: result.retell_llm_dynamic_variables.user_firstname,
                    userLastname: result.retell_llm_dynamic_variables.user_lastname,
                    userEmail: result.retell_llm_dynamic_variables.user_email,
                    callSummary: result.call_analysis.call_summary,
                    durationMs: convertMsToHourMinSec(result.end_timestamp - result.start_timestamp) || 0,
                    recordingUrl: result.recording_url,
                    userSentiment: result.call_analysis.user_sentiment,
                  },
                },
              },
            };
          })
          .catch(error => {
            console.error(`Error retrieving data for contact with call ID ${contact.callId}:`, error);
            return null; // Return null for failed operations
          });
      });

      // Wait for all promises to resolve
      const operations = await Promise.all(bulkOps);
      // Filter out any null operations (failed operations)
      const validOperations = operations.filter(op => op !== null);

      // Execute the bulk write operation if there are valid operations
      if (validOperations.length > 0) {
        await callHistoryModel.bulkWrite(validOperations);
      }
      
    } while (contacts.length === batchSize);

  } catch (error) {
    console.error("Error in batch processing:", error);
  }
}

// Helper function to convert milliseconds to HH:mm:ss
function convertMsToHourMinSec(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
