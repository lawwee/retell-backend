// import { createObjectCsvWriter } from "csv-writer";
// import { contactModel } from "../contacts/contact_model";
// import path from "path";
// import { reviewTranscript } from "../helper-fuction/transcript-review";
// import { callstatusenum } from "../types";

// export const logsToCsv = async (
//   agentId: string,
//   newlimit: number,
//   statusOption?: "Called" | "notCalled" | "vm" | "Failed",
//   sentimentOption?:
//     | "Interested"
//     | "Incomplete Call"
//     | "Scheduled"
//     | "Uninterested",
// ) => {
//   try {
//     let callStatus;

//     if (statusOption === "Called") {
//       callStatus = callstatusenum.CALLED;
//     } else if (statusOption === "notCalled") {
//       callStatus = callstatusenum.NOT_CALLED;
//     } else if (statusOption === "vm") {
//       callStatus = callstatusenum.VOICEMAIL;
//     } else if (statusOption === "Failed") {
//       callStatus = callstatusenum.FAILED;
//     }
//     const foundContacts = await contactModel
//       .find({ agentId, isDeleted: false, status: statusOption })
//       .sort({ createdAt: "desc" })
//       .populate("referenceToCallId")
//       .limit(newlimit);

//     // Extract relevant fields from found contacts
//     const contactsData = await Promise.all(
//       foundContacts.map(async (contact) => {
//         const transcript = contact.referenceToCallId?.transcript;
//         const analyzedTranscript = await reviewTranscript(transcript);

//         return {
//           firstname: contact.firstname,
//           lastname: contact.lastname,
//           email: contact.email,
//           phone: contact.phone,
//           status: contact.status,
//           transcript: transcript,
//           analyzedTranscript: analyzedTranscript?.message.content,
//           call_recording_url: contact.referenceToCallId?.recordingUrl,
//         };
//       }),
//     );

//     if (sentimentOption) {
//       const filteredContacts = contactsData.filter((contact) => {
//         switch (sentimentOption) {
//           case "Interested":
//             return contact.analyzedTranscript === "Interested";
//           case "Incomplete Call":
//             return contact.analyzedTranscript === "Incomplete Call";
//           case "Scheduled":
//             return contact.analyzedTranscript === "Scheduled";
//           case "Uninterested":
//             return contact.analyzedTranscript === "Uninterested";
//           default:
//             return true; // If statusOption is not specified, return all contacts
//         }
//       });
//     }

//     // Write contacts data to CSV file
//     const filePath = path.join(__dirname, "..", "..", "public", "logs.csv");
//     console.log("File path:", filePath); // Log file path for debugging

//     const csvWriter = createObjectCsvWriter({
//       path: filePath,
//       header: [
//         { id: "firstname", title: "FirstName" },
//         { id: "lastname", title: "LastName" },
//         { id: "email", title: "Email" },
//         { id: "phone", title: "Phone Number" },
//         { id: "status", title: "Status" },
//         { id: "transcript", title: "Transcript" },
//         { id: "call_recording_url", title: " Call Recording url" },
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

import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../contacts/contact_model";
import path from "path";
import { reviewTranscript } from "../helper-fuction/transcript-review";
import { callstatusenum } from "../types";

export const logsToCsv = async (
  agentId: string,
  newlimit: number,
  statusOption?: "Called" | "notCalled" | "vm" | "Failed",
  sentimentOption?:
    | "Interested"
    | "Incomplete Call"
    | "Scheduled"
    | "Uninterested",
) => {
  try {
    let query: { agentId: string; isDeleted: boolean; status?: string } = {
      agentId,
      isDeleted: false,
    };
    if (statusOption) {
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
