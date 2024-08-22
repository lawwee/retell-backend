import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../contacts/contact_model";
import path from "path";
import { reviewTranscript } from "../helper-fuction/transcript-review";
import { callstatusenum, transcriptEnum } from "../types";

export const logsToCsv = async (
  agentId: string,
  newlimit: number,
  startDate: string,
  endDate: string,
  statusOption?: "Called" | "notCalled" | "vm" | "Failed" | "All",
  sentimentOption?: any,
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
      }
      query.status = callStatus;
    }

    if (startDate) {
      query["datesCalled"] = {
        $gte: startDate,
      };
    }

    if (endDate) {
      query["datesCalled"] = {
        $lte: endDate,
      };
    }
    const foundContacts = await contactModel
      .find(query)
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .limit(newlimit);

    console.log(query);
    console.log(foundContacts);

    const contactsData = await Promise.all(
      foundContacts.map(async (contact) => {
        const transcript = contact.referenceToCallId?.transcript;
        const analyzedTranscript =
          contact.referenceToCallId?.analyzedTranscript;
        return {
          firstname: contact.firstname,
          lastname: contact.lastname,
          email: contact.email,
          phone: contact.phone,
          status: contact.status,
          transcript: transcript,
          analyzedTranscript: analyzedTranscript,
          call_recording_url: contact.referenceToCallId?.recordingUrl,
        };
      }),
    );

    let filteredContacts: any = [];

    // contactsData.forEach((contact: any) => {
    //   if (!sentimentOption || contact.analyzedTranscript === sentimentOption) {

    //     if (sentimentOption === "Uninterested" && contact.status === "call-connected") {
    //       filteredContacts.push(contact);
    //     } else if (sentimentOption !== "Uninterested") {
    //       filteredContacts.push(contact);
    //     }
    //   }
    // });

    contactsData.forEach((contact: any) => {
      if (!sentimentOption || contact.analyzedTranscript === sentimentOption) {
        if (
          sentimentOption === "Uninterested" &&
          contact.status === "call-connected"
        ) {
          filteredContacts.push(contact);
        } else if (
          sentimentOption !== "Uninterested" &&
          !(
            sentimentOption === "Interested" &&
            contact.status === "called-NA-VM"
          )
        ) {
          filteredContacts.push(contact);
        }
      }
    });

    const filePath = path.join(__dirname, "..", "..", "public", "logs.csv");

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: "firstname", title: "firstname" },
        { id: "lastname", title: "lastname" },
        { id: "email", title: "email" },
        { id: "phone", title: "phone" },
        { id: "status", title: "status" },
        { id: "transcript", title: "transcript" },
        { id: "call_recording_url", title: "call_recording_url" },
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
