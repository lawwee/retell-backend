import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../contacts/contact_model";
import path from "path";
import { callstatusenum } from "../types"; // Assuming this is the enum for call statuses
import { differenceInDays, addDays } from "date-fns"; // Using date-fns for date handling

export const logsToCsv = async (
  agentId: string,
  newlimit: number,
  startDate?: string,
  endDate?: string,
  statusOption?: "Called" | "notCalled" | "vm" | "Failed" | "All",
  sentimentOption?: any,
) => {
  try {
    let query: any = {
      agentId,
      isDeleted: false,
    };

    // Handle status option
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

  
  
    const formattedStartDate = startDate
      ? new Date(startDate).toISOString().split("T")[0]
      : null
    const formattedEndDate = endDate
      ? new Date(endDate).toISOString().split("T")[0]
      : null
    const getDatesInRange = (start: string, end: string): string[] => {
      const startDateObj = new Date(start);
      const endDateObj = new Date(end);
      const daysDiff = differenceInDays(endDateObj, startDateObj);
      const dates = [];

      for (let i = 0; i <= daysDiff; i++) {
        dates.push(addDays(startDateObj, i).toISOString().split("T")[0]);
      }
      return dates;
    };

    // Query datesCalled with $in using getDatesInRange function
    if (formattedStartDate && formattedEndDate) {
      const datesInRange = getDatesInRange(
        formattedStartDate,
        formattedEndDate,
      );
      query["datesCalled"] = { $in: datesInRange };
    } else if (formattedStartDate) {
      query["datesCalled"] = {
        $in: getDatesInRange(formattedStartDate, formattedEndDate),
      };
    }
    

    const foundContacts = await contactModel
      .find(query)
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .limit(newlimit);

    // Proceed with the rest of your code to handle filtering and CSV generation...

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
    if (error instanceof Error) {
      console.error(`Error generating CSV: ${error.message}`);
      return { error: error.message };
    } else {
      // Handle case where it's not an Error instance
      console.error("Unknown error occurred.");
      return { error: "An unknown error occurred." };
    }
  }
};
