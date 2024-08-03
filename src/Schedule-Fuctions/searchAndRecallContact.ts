import { contactModel, jobModel } from "../contacts/contact_model";
import Retell from "retell-sdk";
import { TwilioClient } from "../twilio_api";
import { jobstatus } from "../types";
import moment from "moment-timezone";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});
const twilioClient = new TwilioClient(retellClient);
export const searchAndRecallContacts = async (
  contactLimit: number,
  agentId: string,
  fromNumber: string,
  jobId: string,
  lowerCaseTag?: string,
) => {
  try {
    let contactStatusArray = ["called-NA-VM", "ringing", "on call"];
    const contacts = await contactModel
      .find({
        agentId,
        status: { $in: contactStatusArray },
        isDeleted: { $ne: true },
        tag:lowerCaseTag ? lowerCaseTag : ""
      })
      .limit(contactLimit)
      .sort({ createdAt: "desc" });

    for (const contact of contacts) {
      try {
        const job = await jobModel.findOne({ jobId });
        const currentDate = moment().tz("America/Los_Angeles");
        const currentHour = currentDate.hours();
        if (currentHour < 8 || currentHour >= 15) {
          console.log("Job processing stopped due to time constraints.");
          await jobModel.findOneAndUpdate(
            { jobId },
            { callstatus: "cancelled", shouldContinueProcessing: false },
          );
          return; // Exit the job execution
        }

        if (!job || job.shouldContinueProcessing !== true) {
          await jobModel.findOneAndUpdate(
            { jobId },
            { callstatus: "cancelled" },
          );
          console.log("Job processing stopped.");
          break;
        }
        const postdata = {
          fromNumber,
          toNumber: contact.phone,
          userId: contact._id.toString(),
          agentId,
        };
        function formatPhoneNumber(phoneNumber:any) {
          // Remove any existing "+" and non-numeric characters
          const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
          return `+1${digitsOnly}`
      }
      const newToNumber = formatPhoneNumber(postdata.toNumber)
        // await twilioClient.RegisterPhoneAgent(fromNumber, agentId, postdata.userId);
        // await twilioClient.CreatePhoneCall(
        //   postdata.fromNumber,
        //   postdata.toNumber,
        //   postdata.agentId,
        //   postdata.userId,
        // );
        try {
          const callRegister = await retellClient.call.register({
            agent_id: agentId,
            audio_encoding: "s16le",
            audio_websocket_protocol: "twilio",
            sample_rate: 24000,
            end_call_after_silence_ms: 15000,
          });
          const registerCallResponse2 = await retellClient.call.create({
            from_number: fromNumber,
            to_number: newToNumber,
            override_agent_id: agentId,
            drop_call_if_machine_detected: true,
            retell_llm_dynamic_variables: {
              user_firstname: contact.firstname,
              user_email: contact.email,
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
          `Axios call successful for recalled contact: ${contact.firstname}`,
        );
        await jobModel.findOneAndUpdate(
          { jobId },
          { $inc: { processedContactsForRedial: 1 } },
        );
      } catch (error) {
        const errorMessage = (error as Error).message || "Unknown error";
        console.error(
          `Error processing recalled contact ${contact.firstname}: ${errorMessage}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 8000));
    }
    await jobModel.findOneAndUpdate(
      { jobId },
      { callstatus: jobstatus.CALLED },
    );
    console.log("Recalled contacts finished processing");
  } catch (error) {
    console.error("Error searching and recalling contacts:", error);
  }
};
