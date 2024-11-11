import { contactModel, EventModel } from "./contacts/contact_model";
import { reviewCallback, reviewTranscript } from "./helper-fuction/transcript-review";
import { format } from "date-fns";
import OpenAI from "openai";
import { callstatusenum } from "./utils/types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_APIKEY,
});

export async function script() {
  try {
    // Fetch contacts that are not marked as deleted and populate `referenceToCallId`
    const contacts = await contactModel.find({ isDeleted: false, status: callstatusenum.VOICEMAIL }).populate("referenceToCallId");

    console.log(`Fetched ${contacts.length} contacts for processing.`);

    for (const contact of contacts) {
      try {
        // Check if referenceToCallId or transcript exists
        if (!contact.referenceToCallId || !contact.referenceToCallId.transcript) {
          console.log(`Skipping contact ${contact._id} - missing referenceToCallId or transcript.`);
          continue;
        }

        // Review the transcript
        console.log(`Reviewing transcript for contact ${contact._id}`);
        // const reviewedTranscript = await reviewTranscript(contact.referenceToCallId.transcript);
        // const finalTranscript = reviewedTranscript.message.content;

        // Pass the transcript to decide if it's AM/VM or IVR
        const ivrOrVmResponse = await decideIVRorVM(contact.referenceToCallId.transcript);
        
        // Determine the status to update based on the IVR/VM response
        let updatedStatus: string;
        if (ivrOrVmResponse === "AM/VM") {
          updatedStatus = callstatusenum.VOICEMAIL;
        } else if (ivrOrVmResponse === "IVR") {
          updatedStatus = callstatusenum.IVR;
        } else {
          console.log(`Unrecognized response from decideIVRorVM for contact ${contact._id}. Skipping status update.`);
          continue;  // Skip this contact if the response is not recognized
        }

        console.log(updatedStatus)
        // Prepare the update data
        const updateData = { status: updatedStatus };
        

        // Update the contact model with the new status
        const result = await contactModel.findOneAndUpdate(
          { _id: contact._id }, // Match by contact _id
          updateData,
          { new: true } // Return the updated document
        );

        // Log the update result
        if (result) {
          console.log(`Updated status for contact ${contact._id} to ${updatedStatus}.`);
        } else {
          console.log(`Contact not found for update: ${contact._id}.`);
        }

      } catch (innerError) {
        console.error(`Error processing contact ${contact._id}:`, innerError);
      }
    }

    console.log("Processing complete for all contacts.");

  } catch (error) {
    console.error("Error fetching contacts or updating EventModel:", error);
  }
}

export const decideIVRorVM = async (transcript: string): Promise<string> => {
  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `Here's a transcript of a call message. Based on the content, identify whether this is an AM/VM (Answering Machine/Voice Mail) or an IVR (Interactive Voice Response) system. Only respond with the category: 'AM/VM' or 'IVR'. Transcript: ${transcript}`
        },
      ],
      model: "gpt-4o-mini",
    });

    const extractedResponse = completion.choices[0].message.content.trim();

    // Return 'AM/VM' or 'IVR' based on the extracted response
    return extractedResponse;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error("Failed to analyze transcript");
  }
};
