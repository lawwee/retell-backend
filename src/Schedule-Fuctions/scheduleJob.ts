import { contactModel, jobModel } from "../contacts/contact_model";
import { v4 as uuidv4 } from "uuid";
import { jobstatus } from "../types";
import schedule from "node-schedule";
import { TwilioClient } from "../twilio_api";
import Retell from "retell-sdk";
import { searchAndRecallContacts } from "./searchAndRecallContact";
import moment from "moment-timezone";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});
const twilioClient = new TwilioClient(retellClient);

export const scheduleCronJob = async (
  scheduledTimePST: Date,
  agentId: string,
  limit: string,
  fromNumber: string,
  formattedDate: string,
) => {
  const jobId = uuidv4();
  try {
    // Create a new job entry in the database
    await jobModel.create({
      callstatus: jobstatus.QUEUED,
      jobId,
      agentId,
      scheduledTime: formattedDate,
      shouldContinueProcessing: true,
    });
    const contactLimit = parseInt(limit);
    const contacts = await contactModel
      .find({ agentId, status: "not called", isDeleted: { $ne: true } })
      .limit(contactLimit)
      .sort({ createdAt: "desc" });
    const job = schedule.scheduleJob(jobId, scheduledTimePST, async () => {
      try {
        await jobModel.findOneAndUpdate(
          { jobId },
          { callstatus: jobstatus.ON_CALL },
        );
        for (const contact of contacts) {
          try {
            const job = await jobModel.findOne({ jobId });
            const currentDate = moment().tz("America/Los_Angeles");
            const currentHour = currentDate.hours();
            if (currentHour < 8 || currentHour >= 15) {
              console.log("Job processing stopped due to time constraints.");
              await jobModel.findOneAndUpdate(
                { jobId },
                { callstatus: "cancelled" },
              );
              return; // Exit the job execution
            }
            if (!job || job.shouldContinueProcessing !== true) {
              console.log("Job processing stopped.");
              await jobModel.findOneAndUpdate(
                { jobId },
                { callstatus: "cancelled" },
              );
              break;
            }
            const postdata = {
              fromNumber,
              toNumber: contact.phone,
              userId: contact._id.toString(),
              agentId,
            };
            // await twilioClient.RegisterPhoneAgent(fromNumber, agentId, postdata.userId);
            // await twilioClient.CreatePhoneCall(
            //   postdata.fromNumber,
            //   postdata.toNumber,
            //   postdata.agentId,
            //   postdata.userId,
            // );
            try {
              await retellClient.call.register({
                agent_id: agentId,
                audio_encoding: "s16le",
                audio_websocket_protocol: "twilio",
                sample_rate: 24000,
                end_call_after_silence_ms: 15000,
              });
              const registerCallResponse2 = await retellClient.call.create({
                from_number: fromNumber,
                to_number: postdata.toNumber,
                override_agent_id: agentId,
                drop_call_if_machine_detected: true,
                retell_llm_dynamic_variables: {
                  firstname: contact.firstname,
                  email: contact.email,
                },
              });
              await contactModel.findByIdAndUpdate(contact._id, {
                callId: registerCallResponse2.call_id,
              });
            } catch (error) {
              console.log("This is the error:", error);
              await contactModel.findByIdAndUpdate(postdata.userId, {
                status: "call-failed",
              });
            }
            console.log(
              `Axios call successful for contact: ${contact.firstname}`,
            );
            await jobModel.findOneAndUpdate(
              { jobId },
              { $inc: { processedContacts: 1 } },
            );
          } catch (error) {
            console.error(
              `Error processing contact ${contact.firstname}: ${
                (error as Error).message || "Unknown error"
              }`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 8000));
        }
        console.log("Contacts processed will start recall");
        await searchAndRecallContacts(contactLimit, agentId, fromNumber, jobId);
      } catch (error) {
        console.error(
          `Error querying contacts: ${
            (error as Error).message || "Unknown error"
          }`,
        );
      }
    });

    console.log(
      `Job scheduled with ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}\n, scheduled time: ${scheduledTimePST}`,
    );
    return { jobId, scheduledTime: scheduledTimePST, contacts };
  } catch (error) {
    console.error("Error scheduling job:", error);
    throw error;
  }
};
