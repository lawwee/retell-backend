import { contactModel, jobModel } from "../contacts/contact_model";
import { v4 as uuidv4 } from "uuid";
import { callstatusenum, jobstatus } from "../utils/types";
import schedule from "node-schedule";
import Retell from "retell-sdk";
import moment from "moment-timezone";
//import { searchAndRecallContacts } from "./searchAndRecallContact";
import { DailyStatsModel } from "../contacts/call_log";
import { formatPhoneNumber } from "../helper-fuction/formatter";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});

export const scheduleCronJob = async (
  scheduledTimePST: Date,
  agentId: string,
  limit: string,
  fromNumber: string,
  formattedDate: string,
  lowerCaseTag?: string,
) => {
  const jobId = uuidv4();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayString = today.toISOString().split("T")[0];

  try {
    await DailyStatsModel.create({
      day: todayString,
      agentId: agentId,
      jobProcessedBy: jobId,
    });
    const existingJob = await jobModel.findOne({
      agentId,
      tagProcessedFor: lowerCaseTag,
      callstatus: { $in: [jobstatus.ON_CALL, jobstatus.QUEUED] },
      shouldContinueProcessing: true,
    });
  
    if (existingJob) {
      console.log(`A job is already running for agent: ${agentId} and tag: ${lowerCaseTag}.`);
      return { message: "Job already running", jobId: existingJob.jobId };
    }
    await jobModel.create({
      callstatus: jobstatus.QUEUED,
      jobId,
      agentId,
      scheduledTime: formattedDate,
      shouldContinueProcessing: true,
      tagProcessedFor:lowerCaseTag
    });

    const contactLimit = parseInt(limit);
    const contacts = await contactModel
      .find({
        agentId,
        status: callstatusenum.NOT_CALLED,
        isDeleted: false,
        ...(lowerCaseTag ? { tag: lowerCaseTag } : {}),
      })
      .limit(contactLimit)
      .sort({ createdAt: "desc" });

    const job = schedule.scheduleJob(jobId, scheduledTimePST, async () => {
      try {
        let currentJob = await jobModel.findOneAndUpdate(
          { jobId },
          { callstatus: jobstatus.ON_CALL },
          { new: true },
        );

        const currentDate = moment().tz("America/Los_Angeles");
        const currentHour = currentDate.hours();

        for (const contact of contacts) {
          // Fetch the latest job state in each iteration
          currentJob = await jobModel.findOne({ jobId });

          // Time constraint check
          if (currentHour < 8 || currentHour >= 15) {
            await jobModel.findOneAndUpdate(
              { jobId },
              { callstatus: "cancelled", shouldContinueProcessing: false },
            );
            console.log("Job processing stopped due to time constraints.");
            break;
          }

          // Check if the job should stop processing
          if (!currentJob || currentJob.shouldContinueProcessing === false) {
            console.log("Job processing stopped by user flag.");
            await jobModel.findOneAndUpdate(
              { jobId },
              { callstatus: "cancelled", shouldContinueProcessing: false },
            );
            break;
          }

          const postdata = {
            fromNumber,
            toNumber: contact.phone,
            userId: contact._id.toString(),
            agentId,
          };

          try {
            // const newToNumber = formatPhoneNumber(postdata.toNumber);
            const callRegister = await retellClient.call.register({
              agent_id: agentId,
              audio_encoding: "s16le",
              audio_websocket_protocol: "twilio",
              sample_rate: 24000,
              end_call_after_silence_ms: 15000,
            });

            const registerCallResponse2 = await retellClient.call.create({
              from_number: fromNumber,
              to_number: formatPhoneNumber(postdata.toNumber),
              override_agent_id: agentId,
              drop_call_if_machine_detected: true,
              retell_llm_dynamic_variables: {
                user_firstname: contact.firstname,
                user_email: contact.email,
                user_lasname: contact.lastname,
                job_id: jobId,
              },
            });

            await contactModel.findByIdAndUpdate(contact._id, {
              callId: registerCallResponse2.call_id,
              $push: { jobProcessedWithId: jobId },
              isusercalled: true,
            });

            await jobModel.findOneAndUpdate(
              { jobId },
              { $inc: { processedContacts: 1 } },
            );
            console.log(`Call successful for contact: ${contact.firstname}`);

            // // Wait for 2 seconds between calls
            // await new Promise((resolve) => setTimeout(resolve, 3000));

            // const updatedContact = await contactModel.findOne({
            //   $or: [
            //     { callId: registerCallResponse2.call_id },
            //     { _id: contact._id.toString() },
            //   ],
            // });
            // if (updatedContact?.status === "dial_no_answer") {
            //   console.log(
            //     `User ${contact.firstname} didn't answer, calling again...`,
            //   );

            //   const retryCallResponse = await retellClient.call.create({
            //     from_number: fromNumber,
            //     to_number: formatPhoneNumber(postdata.toNumber),
            //     override_agent_id: agentId,
            //     drop_call_if_machine_detected: true,
            //     retell_llm_dynamic_variables: {
            //       user_firstname: contact.firstname,
            //       user_email: contact.email,
            //     },
            //   });

            //   await contactModel.findByIdAndUpdate(contact._id, {
            //     callId: retryCallResponse.call_id,
            //   });

            //   console.log(
            //     `Retry call initiated for contact: ${contact.firstname}`,
            //   );
            // } else {
            //   console.log(
            //     `User ${contact.firstname} answered or the status changed, skipping recall.`,
            //   );
            // }
          } catch (error) {
            console.log("Error during call processing:", error);
          }

        
          await new Promise((resolve) => setTimeout(resolve, 4000));
        }

        // console.log("Contacts processed, starting recall...");
        // await searchAndRecallContacts(
        //   contactLimit,
        //   agentId,
        //   fromNumber,
        //   jobId,
        //   lowerCaseTag,
        // );
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
