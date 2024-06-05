

import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../contacts/contact_model";
import path from "path";
import { reviewTranscript } from "../helper-fuction/transcript-review";
import { callstatusenum } from "../types";

export const logsToCsv = async (
  agentId: string,
  newlimit: number,
  startDate: string,
  endDate:string,
  statusOption?: "Called" | "notCalled" | "vm" | "Failed"| "All",
  sentimentOption?:
    | "Interested"
    | "Incomplete Call"
    | "Scheduled"
    | "Uninterested"
    | "Call back"
) => {
  try {
    let query: any = {
      agentId,
      isDeleted: false,
    };
    if (statusOption && statusOption !== "All") {
      let callStatus;
      if (statusOption === "Called") {
        callStatus = callstatusenum.CALLED;
      } else if (statusOption === "notCalled") {
        callStatus = callstatusenum.NOT_CALLED;
      } else if (statusOption === "vm") {
        callStatus = callstatusenum.VOICEMAIL;
      } else if (statusOption === "Failed") {
        callStatus = callstatusenum.FAILED;
      } else if  (statusOption === "All"){
        callStatus = null
      }
      query.status = callStatus;
  }
  if (startDate && endDate) {
    query["datesCalled"] = {
      $gte: startDate,
      $lte: endDate,
    };
  }
    const foundContacts = await contactModel
      .find(query)
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .limit(newlimit);

    const contactsData = await Promise.all(
      foundContacts.map(async (contact) => {
        const transcript = contact.referenceToCallId?.transcript;
        const analyzedTranscript = await reviewTranscript(transcript);
        return {
          firstname: contact.firstname,
          lastname: contact.lastname,
          email: contact.email,
          phone: contact.phone,
          status: contact.status,
          transcript: transcript,
          analyzedTranscript: analyzedTranscript?.message.content,
          call_recording_url: contact.referenceToCallId?.recordingUrl,
        };
      }),
    );

    let filteredContacts = contactsData;
    if (sentimentOption) {
      filteredContacts = contactsData.filter((contact) => {
        switch (sentimentOption) {
          case "Interested":
            return contact.analyzedTranscript === "Interested";
          case "Incomplete Call":
            return contact.analyzedTranscript === "Incomplete Call";
          case "Scheduled":
            return contact.analyzedTranscript === "Scheduled";
          case "Uninterested":
            return contact.analyzedTranscript === "Uninterested";
          case "Call back":
            return contact.analyzedTranscript === "Call back";
          default:
            return true; 
        }
      });
    }
    const filePath = path.join(__dirname, "..", "..", "public", "logs.csv");
    console.log("File path:", filePath); 

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
        { id: "analyzedTranscript", title: "analyzedTranscript" },
      ],
    });
    await csvWriter.writeRecords(filteredContacts);
    console.log("CSV file logs.csv has been written successfully");
    return filePath;
  } catch (error) {
    console.error(`Error retrieving contacts: ${error}`);
    return error;
  }
};
