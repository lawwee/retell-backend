import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../contacts/contact_model";
import path from "path";
import { reviewTranscript } from "../helper-fuction/transcript-review";
import { callstatusenum } from "../types";

export const statsToCsv = async (startDate: string, endDate: string) => {
  try {
    const agentIds = [
      "214e92da684138edf44368d371da764c",
      "0411eeeb12d17a340941e91a98a766d0",
      "86f0db493888f1da69b7d46bfaecd360",
    ];

    const dailyStats = await contactModel
      .find({
        $and: [
          { agentId: { $in: agentIds } },
          { isDeleted: false },
          {
            $and: [
              {
                
                "datesCalled": { $gte: startDate }
              },
              {
                // Check if any date in the array is less than or equal to the end date
                "datesCalled": { $lte: endDate }
              }
            ]
          }
        ],
      })
      .sort({ createdAt: "desc" })
      .populate("referenceToCallId");
      console.log(dailyStats)

    const contactsData = await Promise.all(dailyStats.map(async (contact) => {
      const transcript = contact.referenceToCallId?.transcript;
      // const analyzedTranscript = await reviewTranscript(transcript);
      return {
        firstname: contact.firstname,
        lastname:contact.lastname,
        email: contact.email,
        phone: contact.phone,
        status: contact.status,
        transcript: transcript,
        // analyzedTranscript: analyzedTranscript.message.content,
        call_recording_url: contact.referenceToCallId.recordingUrl,
      };
    }));

    // Write contacts data to CSV file
    const filePath = path.join(__dirname, "..", "..", "public", "stats.csv");
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: "firstname", title: "FirstName" },
        { id: "lastname", title: "LastName" },
        { id: "email", title: "Email" },
        { id: "phone", title: "Phone Number" },
        { id: "status", title: "Status" },
        { id: "transcript", title: "Transcript" },
        { id: "call_recording_url", title: "Call_Recording_Url" },
      ],
    });

    await csvWriter.writeRecords(contactsData);
    console.log("CSV file stats.csv has been written successfully");
    return filePath;
  } catch (error) {
    console.error("Error occurred during CSV creation:", error);
    return `Error occurred during CSV creation: ${error}`;
  }
};
