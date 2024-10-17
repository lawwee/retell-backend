import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../contacts/contact_model";
import path from "path";
import { callstatusenum } from "../types"; 
import { differenceInDays, addDays } from "date-fns"; 

export const logsToCsv = async (
  agentId: string,
  newlimit: number,
  startDate?: string,
  endDate?: string,
  statusOption?: "Called" | "notCalled" | "vm" | "Failed" | "All",
  sentimentOption?: "Not-Interested" | "Scheduled" | "Call-Back" | "Incomplete" | "Interested" | "Voicemail" | "All"
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
      : null;
    const formattedEndDate = endDate
      ? new Date(endDate).toISOString().split("T")[0]
      : null;

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

    // Filter by date range
    if (formattedStartDate && formattedEndDate) {
      const datesInRange = getDatesInRange(formattedStartDate, formattedEndDate);
      query["datesCalled"] = { $in: datesInRange };
    } else if (formattedStartDate) {
      query["datesCalled"] = formattedStartDate; // Single start date without range
    }

    console.log(query)
    const foundContacts = await contactModel
      .find(query)
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId")
      .limit(newlimit);

      console.log(foundContacts)
    // Combine mapping and filtering for efficiency
    const contactsData = await Promise.all(
      foundContacts.filter((contact) => {
        // Filter based on sentiment option
        if (sentimentOption) {
          switch (sentimentOption) {
            case "Not-Interested":
              return contact.status === "call-connected" && contact.referenceToCallId?.analyzedTranscript === "Not-Interested";
            case "Scheduled":
              return contact.referenceToCallId?.analyzedTranscript === "Scheduled";
            case "Call-Back":
              return contact.referenceToCallId?.analyzedTranscript === "Call-Back";
            case "Incomplete":
              return contact.referenceToCallId?.analyzedTranscript === "Incomplete";
            case "Interested":
              return contact.referenceToCallId?.analyzedTranscript === "Interested" && contact.status !== "connected-voicemail";
            case "Voicemail":
              return contact.status === "connected-voicemail";
            default:
              return true;
          }
        }
        return true; // Return all if no sentiment filter
      }).map(async (contact) => {
        const transcript = contact.referenceToCallId?.transcript;
        const analyzedTranscript = contact.referenceToCallId?.analyzedTranscript;
        const lastDateCalled = contact.datesCalled?.length > 0 
          ? contact.datesCalled[contact.datesCalled.length - 1] 
          : null; 
        return {
          firstname: contact.firstname,
          lastname: contact.lastname,
          email: contact.email,
          phone: contact.phone,
          status: contact.status,
          transcript: transcript,
          analyzedTranscript: analyzedTranscript,
          call_recording_url: contact.referenceToCallId?.recordingUrl,
          last_date_called: lastDateCalled
        };
      })
    );

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
        { id: "last_date_called", title: "last_date_called" },
      ],
    });
    await csvWriter.writeRecords(contactsData);
    console.log("CSV file logs.csv has been written successfully");
    return filePath;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error generating CSV: ${error.message}`);
      return { error: error.message };
    } else {
      console.error("Unknown error occurred.");
      return { error: "An unknown error occurred." };
    }
  }
};
