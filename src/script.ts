import { contactModel, EventModel } from "./contacts/contact_model";
import { reviewTranscript } from "./helper-fuction/transcript-review";

export async function updateAnalyzedTranscriptForContacts(): Promise<void> {
    try {
    
      const contacts = await contactModel.find({ agentId:"agent_7cc8f816b0fd2c020037ec31b5", isDeleted: false })
        .populate("referenceToCallId")
        .exec();
      for (const contact of contacts) {
        console.log(contact)
        const referenceToCallId = contact.referenceToCallId as any; 
        if (referenceToCallId && referenceToCallId.transcript) {
        
          const analyzedTranscript = await reviewTranscript(referenceToCallId.transcript);
          await EventModel.findByIdAndUpdate(referenceToCallId._id, {
            analyzedTranscript:analyzedTranscript.message.content,
          });
        }
      }
      console.log("Analyzed transcript updated for all contacts.");
    } catch (error) {
      console.error("Error updating analyzed transcript:", error);
    }
  }