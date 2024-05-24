import { contactModel, jobModel } from "../contacts/contact_model";
import Retell from "retell-sdk";
import { TwilioClient } from "../twilio_api";
import { jobstatus } from "../types";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});
const twilioClient = new TwilioClient(retellClient);
export const searchAndRecallContacts = async (
  contactLimit: number,
  agentId: string,
  fromNumber: string,
  jobId: string,
) => {
  try {
    let contactStatusArray = ["called-NA-VM", "ringing"];
    let contacts = await contactModel
      .find({
        agentId,
        status: { $in: contactStatusArray },
        isDeleted: { $ne: true },
      })
      .limit(contactLimit)
      .sort({ createdAt: "desc" });

    for (const contact of contacts) {
      try {
        const job = await jobModel.findOne({ jobId });
        if (!job || job.shouldContinueProcessing !== true) {
          console.log("Job processing stopped.");
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
          const callRegister = await retellClient.call.register({
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
      await new Promise((resolve) => setTimeout(resolve, 10000));
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
