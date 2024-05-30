import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../contacts/contact_model";
import path from "path";
import { reviewTranscript } from "../helper-fuction/transcript-review";
import { callstatusenum } from "../types";
export const logsToCsv = async (
  agentId: string,
  newlimit: number,
  statusOption?: "called" | "notcalled" | "vm" | "failed",
) => {
  try {
    let callStatus;

    if (statusOption === "called") {
      callStatus = callstatusenum.CALLED;
    } else if (statusOption === "notcalled") {
      callStatus = callstatusenum.NOT_CALLED;
    } else if (statusOption === "vm") {
      callStatus = callstatusenum.VOICEMAIL;
    } else if (statusOption === "failed") {
      callStatus = callstatusenum.FAILED;
    }
    const foundContacts = await contactModel
      .find({ agentId, isDeleted: false, status: callStatus })
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .limit(newlimit);

    // Extract relevant fields from found contacts
    const contactsData = await Promise.all(
      foundContacts.map(async (contact) => {
        const transcript = contact.referenceToCallId?.transcript;
        // const analyzedTranscript = await reviewTranscript(transcript);
        return {
          firstname: contact.firstname,
          lastname: contact.lastname,
          email: contact.email,
          phone: contact.phone,
          status: contact.status,
          transcript: transcript,
          // analyzedTranscript: analyzedTranscript.message.content,
          call_recording_url: contact.referenceToCallId.recordingUrl,
        };
      }),
    );

    // Write contacts data to CSV file
    const filePath = path.join(__dirname, "..", "..", "public", "logs.csv");
    console.log("File path:", filePath); // Log file path for debugging

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: "firstname", title: "FirstName" },
        { id: "lastname", title: "LastName" },
        { id: "email", title: "Email" },
        { id: "phone", title: "Phone Number" },
        { id: "status", title: "Status" },
        { id: "transcript", title: "Transcript" },
        { id: "call_recording_url", title: " Call Recording url" },
      ],
    });
    await csvWriter.writeRecords(contactsData);
    console.log("CSV file logs.csv has been written successfully");
    return filePath;
  } catch (error) {
    console.error(`Error retrieving contacts: ${error}`);
    return error;
  }
};
