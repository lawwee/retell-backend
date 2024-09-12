// import { createObjectCsvWriter } from "csv-writer";
// import { contactModel } from "../contacts/contact_model";
// import path from "path";
// import { reviewTranscript } from "../helper-fuction/transcript-review";
// import { callstatusenum, transcriptEnum } from "../types";

// export const logsToCsv = async (
//   agentId: string,
//   newlimit: number,
//   startDate: string,
//   endDate: string,
//   statusOption?: "Called" | "notCalled" | "vm" | "Failed" | "All",
//   sentimentOption?: any,
// ) => {
//   try {
//     let query: any = {
//       agentId,
//       isDeleted: false,
//     };

//      // Convert startDate and endDate to "YYYY-MM-DD" format
//      const formattedStartDate = startDate ? new Date(startDate).toISOString().split("T")[0] : null;
//      const formattedEndDate = endDate ? new Date(endDate).toISOString().split("T")[0] : null;

//      if (statusOption && statusOption !== "All") {
//        let callStatus;
//        if (statusOption === "Called") {
//          callStatus = callstatusenum.CALLED;
//        } else if (statusOption === "notCalled") {
//          callStatus = callstatusenum.NOT_CALLED;
//        } else if (statusOption === "vm") {
//          callStatus = callstatusenum.VOICEMAIL;
//        } else if (statusOption === "Failed") {
//          callStatus = callstatusenum.FAILED;
//        }
//        query.status = callStatus;
//      }

//      if (formattedStartDate && formattedEndDate) {
//        query["datesCalled"] = {
//          $gte: formattedStartDate,
//          $lte: formattedEndDate,
//        };
//      } else if (formattedStartDate) {
//        query["datesCalled"] = { $gte: formattedStartDate };
//      } else if (formattedEndDate) {
//        query["datesCalled"] = { $lte: formattedEndDate };
//      }
//     const foundContacts = await contactModel
//       .find(query)
//       .sort({ createdAt: "desc" })
//       .populate("referenceToCallId")
//       .limit(newlimit);

//     console.log(query);
//     console.log(foundContacts);

//     const contactsData = await Promise.all(
//       foundContacts.map(async (contact) => {
//         const transcript = contact.referenceToCallId?.transcript;
//         const analyzedTranscript =
//           contact.referenceToCallId?.analyzedTranscript;
//         return {
//           firstname: contact.firstname,
//           lastname: contact.lastname,
//           email: contact.email,
//           phone: contact.phone,
//           status: contact.status,
//           transcript: transcript,
//           analyzedTranscript: analyzedTranscript,
//           call_recording_url: contact.referenceToCallId?.recordingUrl,
//         };
//       }),
//     );

//     let filteredContacts: any = [];

//     contactsData.forEach((contact: any) => {
//       if (!sentimentOption || contact.analyzedTranscript === sentimentOption) {
//         if (
//           sentimentOption === "Uninterested" &&
//           contact.status === "call-connected"
//         ) {
//           filteredContacts.push(contact);
//         } else if (
//           sentimentOption !== "Uninterested" &&
//           !(
//             sentimentOption === "Interested" &&
//             contact.status === "called-NA-VM"
//           )
//         ) {
//           filteredContacts.push(contact);
//         }
//       }
//     });

//     const filePath = path.join(__dirname, "..", "..", "public", "logs.csv");

//     const csvWriter = createObjectCsvWriter({
//       path: filePath,
//       header: [
//         { id: "firstname", title: "firstname" },
//         { id: "lastname", title: "lastname" },
//         { id: "email", title: "email" },
//         { id: "phone", title: "phone" },
//         { id: "status", title: "status" },
//         { id: "transcript", title: "transcript" },
//         { id: "call_recording_url", title: "call_recording_url" },
//         { id: "analyzedTranscript", title: "analyzedTranscript" },
//       ],
//     });
//     await csvWriter.writeRecords(filteredContacts);
//     console.log("CSV file logs.csv has been written successfully");
//     return filePath;
//   } catch (error) {
//     console.error(`Error retrieving contacts: ${error}`);
//     return error;
//   }
// };

// import { createObjectCsvWriter } from "csv-writer";
// import { contactModel } from "../contacts/contact_model";
// import path from "path";
// import { callstatusenum, transcriptEnum } from "../types";

// export const logsToCsv = async (
//   agentId: string,
//   newlimit: number,
//   startDate: string,
//   endDate: string,
//   statusOption?: "Called" | "notCalled" | "vm" | "Failed" | "All",
//   sentimentOption?: any
// ) => {
//   try {
//     // Validate agentId and newlimit
//     if (!agentId) {
//       throw new Error("Agent ID is required.");
//     }

//     if (!Number.isInteger(newlimit) || newlimit <= 0) {
//       throw new Error("The 'limit' parameter must be a positive integer.");
//     }

//     // Validate date input
//     const isValidDate = (dateStr: string) => !isNaN(new Date(dateStr).getTime());
//     if (startDate && !isValidDate(startDate)) {
//       throw new Error("Invalid start date format.");
//     }

//     if (endDate && !isValidDate(endDate)) {
//       throw new Error("Invalid end date format.");
//     }

//     // Convert startDate and endDate to "YYYY-MM-DD" format
//     const formattedStartDate = startDate
//       ? new Date(startDate).toISOString().split("T")[0]
//       : null;
//     const formattedEndDate = endDate
//       ? new Date(endDate).toISOString().split("T")[0]
//       : null;

//     let query: any = {
//       agentId,
//       isDeleted: false,
//     };

//     // Status option validation
//     if (statusOption && statusOption !== "All") {
//       const statusOptions = ["Called", "notCalled", "vm", "Failed", "All"];
//       if (!statusOptions.includes(statusOption)) {
//         throw new Error(
//           `Invalid status option provided. Expected one of: ${statusOptions.join(
//             ", "
//           )}`
//         );
//       }

//       let callStatus;
//       if (statusOption === "Called") {
//         callStatus = callstatusenum.CALLED;
//       } else if (statusOption === "notCalled") {
//         callStatus = callstatusenum.NOT_CALLED;
//       } else if (statusOption === "vm") {
//         callStatus = callstatusenum.VOICEMAIL;
//       } else if (statusOption === "Failed") {
//         callStatus = callstatusenum.FAILED;
//       }
//       query.status = callStatus;
//     }

//     // Add date range to query
//     if (formattedStartDate && formattedEndDate) {
//       query["datesCalled"] = {
//         $gte: formattedStartDate,
//         $lte: formattedEndDate,
//       };
//     } else if (formattedStartDate) {
//       query["datesCalled"] = { $gte: formattedStartDate };
//     } else if (formattedEndDate) {
//       query["datesCalled"] = { $lte: formattedEndDate };
//     }

//     // Fetch contacts
//     const foundContacts = await contactModel
//       .find(query)
//       .sort({ createdAt: "desc" })
//       .populate("referenceToCallId")
//       .limit(newlimit);

//     if (foundContacts.length === 0) {
//       throw new Error("No contacts found with the given criteria.");
//     }

//     const contactsData = await Promise.all(
//       foundContacts.map(async (contact) => {
//         const transcript = contact.referenceToCallId?.transcript;
//         const analyzedTranscript = contact.referenceToCallId?.analyzedTranscript;
//         return {
//           firstname: contact.firstname,
//           lastname: contact.lastname,
//           email: contact.email,
//           phone: contact.phone,
//           status: contact.status,
//           transcript: transcript,
//           analyzedTranscript: analyzedTranscript,
//           call_recording_url: contact.referenceToCallId?.recordingUrl,
//         };
//       })
//     );

//     // Filter contacts based on sentimentOption
//     let filteredContacts: any = [];

//     contactsData.forEach((contact: any) => {
//       if (!sentimentOption || contact.analyzedTranscript === sentimentOption) {
//         if (
//           sentimentOption === "Uninterested" &&
//           contact.status === "call-connected"
//         ) {
//           filteredContacts.push(contact);
//         } else if (
//           sentimentOption !== "Uninterested" &&
//           !(sentimentOption === "Interested" && contact.status === "called-NA-VM")
//         ) {
//           filteredContacts.push(contact);
//         }
//       }
//     });

//     if (filteredContacts.length === 0) {
//       throw new Error("No contacts match the given sentiment or status.");
//     }

//     const filePath = path.join(__dirname, "..", "..", "public", "logs.csv");

//     // Write filtered contacts to CSV
//     const csvWriter = createObjectCsvWriter({
//       path: filePath,
//       header: [
//         { id: "firstname", title: "firstname" },
//         { id: "lastname", title: "lastname" },
//         { id: "email", title: "email" },
//         { id: "phone", title: "phone" },
//         { id: "status", title: "status" },
//         { id: "transcript", title: "transcript" },
//         { id: "call_recording_url", title: "call_recording_url" },
//         { id: "analyzedTranscript", title: "analyzedTranscript" },
//       ],
//     });

//     await csvWriter.writeRecords(filteredContacts);
//     console.log("CSV file logs.csv has been written successfully");

//     return filePath;
//   } catch (error) {
//     if (error instanceof Error) {
//       console.error(`Error generating CSV: ${error.message}`);
//       return { error: error.message };
//     } else {
//       // Handle case where it's not an Error instance
//       console.error("Unknown error occurred.");
//       return { error: "An unknown error occurred." };
//     }
//   }
// };
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

    // Handle date ranges
    const today = new Date().toISOString().split("T")[0]; // Today's date in "YYYY-MM-DD"
    const formattedStartDate = startDate
      ? new Date(startDate).toISOString().split("T")[0]
      : today;
    const formattedEndDate = endDate
      ? new Date(endDate).toISOString().split("T")[0]
      : today;
    // Function to get all dates between startDate and endDate (inclusive)
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
    console.log(query);

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
