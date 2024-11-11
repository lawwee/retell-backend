import { contactModel, EventModel } from "./contacts/contact_model";
import { reviewTranscript } from "./helper-fuction/transcript-review";

export async function script() {
  try {
    // Fetch contacts that are not marked as deleted and populate `referenceToCallId`
    const contacts = await contactModel.find({ isDeleted: false }).populate("referenceToCallId");
    
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
        const reviewedTranscript = await reviewTranscript(contact.referenceToCallId.transcript);

        // Update EventModel with the reviewed transcript
        const result = await EventModel.findOneAndUpdate(
          { callId: contact.referenceToCallId.callId },
          { analyzedTranscript: reviewedTranscript },
          { new: true } // Return the updated document
        );

        // Log the updated result
        if (result) {
          console.log(`Updated EventModel for callId ${contact.referenceToCallId.callId} with analyzedTranscript.`);
        } else {
          console.log(`EventModel not found for callId ${contact.referenceToCallId.callId} - update skipped.`);
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
