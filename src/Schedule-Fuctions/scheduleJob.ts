import { contactModel, jobModel } from "../contacts/contact_model";
import { v4 as uuidv4 } from "uuid";
import { jobstatus } from "../types";
import schedule from "node-schedule";
// import { TwilioClient } from "../twilio_api";
import Retell from "retell-sdk";
import { searchAndRecallContacts } from "./searchAndRecallContact";
import moment from "moment-timezone";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});
// const twilioClient = new TwilioClient(retellClient);

// // export const scheduleCronJob = async (
// //   scheduledTimePST: Date,
// //   agentId: string,
// //   limit: string,
// //   fromNumber: string,
// //   formattedDate: string,
// //   lowerCaseTag?: string,
// // ) => {
// //   const jobId = uuidv4();
// //   try {
// //     await jobModel.create({
// //       callstatus: jobstatus.QUEUED,
// //       jobId,
// //       agentId,
// //       scheduledTime: formattedDate,
// //       shouldContinueProcessing: true,
// //     });
// //     const contactLimit = parseInt(limit);
// //     const contacts = await contactModel
// //       .find({
// //         agentId,
// //         status: "not called",
// //         isDeleted: { $ne: true },
// //         tag: lowerCaseTag ? lowerCaseTag : "",
// //       })
// //       .limit(contactLimit)
// //       .sort({ createdAt: "desc" });

// //     const job = schedule.scheduleJob(jobId, scheduledTimePST, async () => {
// //       try {
// //         await jobModel.findOneAndUpdate(
// //           { jobId },
// //           { callstatus: jobstatus.ON_CALL },
// //         );
// //         for (const contact of contacts) {
// //           try {
// //             const job = await jobModel.findOne({ jobId });
// //             const currentDate = moment().tz("America/Los_Angeles");
// //             const currentHour = currentDate.hours();
// //             if (currentHour < 8 || currentHour >= 15) {
// //               console.log("Job processing stopped due to time constraints.");
// //               await jobModel.findOneAndUpdate(
// //                 { jobId },
// //                 { callstatus: "cancelled", shouldContinueProcessing: false },
// //               );
// //               return; // Exit the job execution
// //             }
// //             if (!job || job.shouldContinueProcessing !== true) {
// //               console.log("Job processing stopped.");
// //               await jobModel.findOneAndUpdate(
// //                 { jobId },
// //                 { callstatus: "cancelled", shouldContinueProcessing: false },
// //               );
// //               break;
// //             }
// //             const postdata = {
// //               fromNumber,
// //               toNumber: contact.phone,
// //               userId: contact._id.toString(),
// //               agentId,
// //             };

// //             function formatPhoneNumber(phoneNumber: string) {
// //               let digitsOnly = phoneNumber.replace(/[^0-9]/g, "");

// //               if (phoneNumber.startsWith("+1")) {
// //                 return `+${digitsOnly}`;
// //               }

// //               return `+1${digitsOnly}`;
// //             }

// //             // await twilioClient.RegisterPhoneAgent(fromNumber, agentId, postdata.userId);
// //             // await twilioClient.CreatePhoneCall(
// //             //   postdata.fromNumber,
// //             //   postdata.userId,
// //             // );
// //             try {
// //               await retellClient.call.register({
// //                 agent_id: agentId,
// //                 audio_encoding: "s16le",
// //                 audio_websocket_protocol: "twilio",
// //                 sample_rate: 24000,
// //                 end_call_after_silence_ms: 15000,
// //               });
// //               const newToNumber = formatPhoneNumber(postdata.toNumber);
// //               const registerCallResponse2 = await retellClient.call.create({
// //                 from_number: fromNumber,
// //                 to_number: newToNumber,
// //                 override_agent_id: agentId,
// //                 drop_call_if_machine_detected: true,
// //                 retell_llm_dynamic_variables: {
// //                   firstname: contact.firstname,
// //                   email: contact.email,
// //                 },
// //               });
// //               await contactModel.findByIdAndUpdate(contact._id, {
// //                 callId: registerCallResponse2.call_id,
// //                 $push: { jobProcessedWithId: jobId },
// //               });
// //             } catch (error) {
// //               console.log("This is the error:", error);
// //               await contactModel.findByIdAndUpdate(postdata.userId, {
// //                 status: "call-failed",
// //               });
// //             }
// //             console.log(
// //               `Axios call successful for contact: ${contact.firstname}`,
// //             );
// //             await jobModel.findOneAndUpdate(
// //               { jobId },
// //               { $inc: { processedContacts: 1 } },
// //             );
// //           } catch (error) {
// //             console.error(
// //               `Error processing contact ${contact.firstname}: ${
// //                 (error as Error).message || "Unknown error"
// //               }`,
// //             );
// //           }
// //           await new Promise((resolve) => setTimeout(resolve, 3000));
// //         }
// //         console.log("Contacts processed will start recall");
// //         await searchAndRecallContacts(
// //           contactLimit,
// //           agentId,
// //           fromNumber,
// //           jobId,
// //           lowerCaseTag,
// //         );
// //       } catch (error) {
// //         console.error(
// //           `Error querying contacts: ${
// //             (error as Error).message || "Unknown error"
// //           }`,
// //         );
// //       }
// //     });

// //     console.log(
// //       `Job scheduled with ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}\n, scheduled time: ${scheduledTimePST}`,
// //     );
// //     return { jobId, scheduledTime: scheduledTimePST, contacts };
// //   } catch (error) {
// //     console.error("Error scheduling job:", error);
// //     throw error;
// //   }
// // };

export const scheduleCronJob = async (
  scheduledTimePST: Date,
  agentId: string,
  limit: string,
  fromNumber: string,
  formattedDate: string,
  lowerCaseTag?: string,
) => {
  const jobId = uuidv4();
  function formatPhoneNumber(phoneNumber: string) {
    let digitsOnly = phoneNumber.replace(/[^0-9]/g, "");

    if (phoneNumber.startsWith("+1")) {
      return `+${digitsOnly}`;
    }

    return `+1${digitsOnly}`;
  }
  try {
    await jobModel.create({
      callstatus: jobstatus.QUEUED,
      jobId,
      agentId,
      scheduledTime: formattedDate,
      shouldContinueProcessing: true,
    });

    const contactLimit = parseInt(limit);
    const contacts = await contactModel
      .find({
        agentId,
        status: "not called",
        isDeleted: { $ne: true },
        ...(lowerCaseTag ? { tag: lowerCaseTag } : {}),
      })
      .limit(contactLimit)
      .sort({ createdAt: "desc" });

    const job = schedule.scheduleJob(jobId, scheduledTimePST, async () => {
      try {
        let job = await jobModel.findOneAndUpdate(
          { jobId },
          { callstatus: jobstatus.ON_CALL },
          { new: true },
        );

        const currentDate = moment().tz("America/Los_Angeles");
        const currentHour = currentDate.hours();

        if (currentHour < 8 || currentHour >= 15) {
          await jobModel.findOneAndUpdate(
            { jobId },
            { callstatus: "cancelled", shouldContinueProcessing: false },
          );
          console.log("Job processing stopped due to time constraints.");
          return;
        }

        const bulkOperations = contacts.map((contact) => {
          return async () => {
            if (!job || !job.shouldContinueProcessing) {
              console.log("Job processing stopped.");
              await jobModel.findOneAndUpdate(
                { jobId },
                { callstatus: "cancelled", shouldContinueProcessing: false },
              );
              return;
            }

            const postdata = {
              fromNumber,
              toNumber: contact.phone,
              userId: contact._id.toString(),
              agentId,
            };

            try {
              const newToNumber = formatPhoneNumber(postdata.toNumber);
              await retellClient.call.registerPhoneCall({
                agent_id: agentId,
                from_number: fromNumber,
                to_number: newToNumber,
                retell_llm_dynamic_variables: {
                  user_firstname: contact.firstname,
                  user_email: contact.email,
                },
              });

              const registerCallResponse2 =
                await retellClient.call.createPhoneCall({
                  from_number: fromNumber,
                  to_number: newToNumber,
                  override_agent_id: agentId,
                  retell_llm_dynamic_variables: {
                    user_firstname: contact.firstname,
                    user_email: contact.email,
                  },
                });

              await contactModel.findByIdAndUpdate(contact._id, {
                callId: registerCallResponse2.call_id,
                $push: { jobProcessedWithId: jobId },
              });

              await jobModel.findOneAndUpdate(
                { jobId },
                { $inc: { processedContacts: 1 } },
              );

              console.log(`Call successful for contact: ${contact.firstname}`);
            } catch (error) {
              console.log("Error during call processing:", error);
              await contactModel.findByIdAndUpdate(contact._id, {
                status: "call-failed",
              });
            }
          };
        });

        for (const operation of bulkOperations) {
          await operation();
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }

        console.log("Contacts processed, starting recall...");
        await searchAndRecallContacts(
          contactLimit,
          agentId,
          fromNumber,
          jobId,
          lowerCaseTag,
        );
      } catch (error) {
        console.error("Error in job processing:", error);
      }
    });

    console.log(
      `Job scheduled with ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}`,
    );
    return { jobId, scheduledTime: scheduledTimePST, contacts };
  } catch (error) {
    console.error("Error scheduling job:", error);
    throw error;
  }
};

// export const scheduleCronJob = async (
//   scheduledTimePST: Date,
//   agentId: string,
//   limit: string,
//   fromNumber: string,
//   formattedDate: string,
//   lowerCaseTag?: string,
// ) => {
//   const jobId = uuidv4();

//   function formatPhoneNumber(phoneNumber: string) {
//     let digitsOnly = phoneNumber.replace(/[^0-9]/g, "");

//     if (phoneNumber.startsWith("+1")) {
//       return `+${digitsOnly}`;
//     }

//     return `+1${digitsOnly}`;
//   }

//   try {
//     await jobModel.create({
//       callstatus: jobstatus.QUEUED,
//       jobId,
//       agentId,
//       scheduledTime: formattedDate,
//       shouldContinueProcessing: true,
//     });

//     const contactLimit = parseInt(limit);
//     const contacts = await contactModel
//       .find({
//         agentId,
//         status: "not called",
//         isDeleted: { $ne: true },
//         ...(lowerCaseTag ? { tag: lowerCaseTag } : {}),
//       })
//       .limit(contactLimit)
//       .sort({ createdAt: "desc" });

//     const job = schedule.scheduleJob(jobId, scheduledTimePST, async () => {
//       try {
//         let job = await jobModel.findOneAndUpdate(
//           { jobId },
//           { callstatus: jobstatus.ON_CALL },
//           { new: true },
//         );

//         const currentDate = moment().tz("America/Los_Angeles");
//         const currentHour = currentDate.hours();

//         if (currentHour < 8 || currentHour >= 15) {
//           await jobModel.findOneAndUpdate(
//             { jobId },
//             { callstatus: "cancelled", shouldContinueProcessing: false },
//           );
//           console.log("Job processing stopped due to time constraints.");
//           return;
//         }

//         const bulkOperations = contacts.map((contact) => {
//           return async () => {
//             if (!job || !job.shouldContinueProcessing) {
//               console.log("Job processing stopped.");
//               await jobModel.findOneAndUpdate(
//                 { jobId },
//                 { callstatus: "cancelled", shouldContinueProcessing: false },
//               );
//               return;
//             }

//             const postdata = {
//               fromNumber,
//               toNumber: contact.phone,
//               userId: contact._id.toString(),
//               agentId,
//             };

//             try {
//               await retellClient.call.register({
//                 agent_id: agentId,
//                 audio_encoding: "s16le",
//                 audio_websocket_protocol: "twilio",
//                 sample_rate: 24000,
//                 end_call_after_silence_ms: 15000,
//               });

//               const newToNumber = formatPhoneNumber(postdata.toNumber);
//               const registerCallResponse2 = await retellClient.call.create({
//                 from_number: fromNumber,
//                 to_number: newToNumber,
//                 override_agent_id: agentId,
//                 drop_call_if_machine_detected: true,
//                 retell_llm_dynamic_variables: {
//                   firstname: contact.firstname,
//                   email: contact.email,
//                 },
//               });

//               await contactModel.findByIdAndUpdate(contact._id, {
//                 callId: registerCallResponse2.call_id,
//                 $push: { jobProcessedWithId: jobId },
//               });

//               await jobModel.findOneAndUpdate(
//                 { jobId },
//                 { $inc: { processedContacts: 1 } },
//               );

//               console.log(`Call successful for contact: ${contact.firstname}`);

//               // Wait for 4 seconds before checking the user's status
//               await new Promise((resolve) => setTimeout(resolve, 4000));

//               const updatedContact = await contactModel.findOne({
//                 $or: [
//                   { callId: registerCallResponse2.call_id },
//                   { _id: contact._id.toString() },
//                 ],
//               });

//               if (updatedContact?.status === 'dial_no_answer') {
//                 console.log(
//                   `User ${contact.firstname} didn't answer, calling again...`,
//                 );

//                 const retryCallResponse = await retellClient.call.create({
//                   from_number: fromNumber,
//                   to_number: newToNumber,
//                   override_agent_id: agentId,
//                   drop_call_if_machine_detected: true,
//                   retell_llm_dynamic_variables: {
//                     firstname: contact.firstname,
//                     email: contact.email,
//                   },
//                 });

//                 await contactModel.findByIdAndUpdate(contact._id, {
//                   callId: retryCallResponse.call_id,
//                 });

//                 console.log(`Retry call initiated for contact: ${contact.firstname}`);
//               } else {
//                 console.log(`User ${contact.firstname} answered or the status changed, skipping recall.`);
//               }
//             } catch (error) {
//               console.log("Error during call processing:", error);
//               await contactModel.findByIdAndUpdate(contact._id, {
//                 status: "call-failed",
//               });
//             }
//           };
//         });

//         for (const operation of bulkOperations) {
//           await operation();
//           await new Promise((resolve) => setTimeout(resolve, 10000));
//         }

//         console.log("Contacts processed, starting recall...");
//         await searchAndRecallContacts(
//           contactLimit,
//           agentId,
//           fromNumber,
//           jobId,
//           lowerCaseTag,
//         );
//       } catch (error) {
//         console.error("Error in job processing:", error);
//       }
//     });

//     console.log(
//       `Job scheduled with ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}`,
//     );
//     return { jobId, scheduledTime: scheduledTimePST, contacts };
//   } catch (error) {
//     console.error("Error scheduling job:", error);
//     throw error;
//   }
// };
