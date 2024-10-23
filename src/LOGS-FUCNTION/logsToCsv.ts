import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../contacts/contact_model";
import path from "path";
import { callstatusenum } from "../types";
import { differenceInDays, addDays } from "date-fns";
 

export const logsToCsv = async (
  agentId: string,
  newlimit?: number, 
  startDate?: string,
  endDate?: string,
  statusOption?: "Called" | "notCalled" | "vm" | "Failed" | "All",
  sentimentOption?:
    | "Not-Interested"
    | "Scheduled"
    | "Call-Back"
    | "Incomplete"
    | "Interested"
    | "Voicemail"
    | "All",
) => {
  try {
    let query: any = {
      isDeleted: false,
    };

    if (agentId) {
      query.agentId = agentId;
    }

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
      const datesInRange = getDatesInRange(
        formattedStartDate,
        formattedEndDate,
      );
      query["datesCalled"] = { $in: datesInRange };
    } else if (formattedStartDate) {
      query["datesCalled"] = formattedStartDate;
    }
    
    let contactQuery = contactModel
      .find(query)
      .sort({ createdAt: "desc" })
      .select("firstname lastname email phone status referenceToCallId datesCalled")
      .populate("referenceToCallId", "transcript analyzedTranscript recordingUrl")

    // Conditionally add limit if provided
    if (newlimit && Number.isInteger(newlimit) && newlimit > 0) {
      contactQuery = contactQuery.limit(newlimit);
    }

    const foundContacts = await contactQuery.exec();


    const contactsData = await Promise.all(
      foundContacts
        .filter((contact) => {
          if (sentimentOption) {
            switch (sentimentOption) {
              case "Not-Interested":
                return contact.referenceToCallId?.analyzedTranscript === "Not-Interested";
              case "Scheduled":
                return contact.referenceToCallId?.analyzedTranscript === "Scheduled";
              case "Call-Back":
                return contact.referenceToCallId?.analyzedTranscript === "Call-Back";
              case "Incomplete":
                return contact.referenceToCallId?.analyzedTranscript === "Incomplete";
              case "Interested":
                return (
                  contact.referenceToCallId?.analyzedTranscript === "Interested" &&
                  contact.status !== "connected-voicemail"
                );
              case "Voicemail":
                return contact.status === "connected-voicemail";
              default:
                return true;
            }
          }
          return true; 
        })
        .map(async (contact) => {
          const transcript = contact.referenceToCallId?.transcript;
          const analyzedTranscript = contact.referenceToCallId?.analyzedTranscript;
          const lastDateCalled =
            contact.datesCalled?.length > 0
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
            last_date_called: lastDateCalled,
          };
        }),
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
    console.log(contactsData)
    await csvWriter.writeRecords(contactsData);
    console.log("CSV file logs.csv has been written successfully");
    return filePath;
  } catch (error) {
    console.error(`Error generating CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { error: error instanceof Error ? error.message : "An unknown error occurred." };
  }
};
