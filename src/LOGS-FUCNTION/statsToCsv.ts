import { createObjectCsvWriter } from "csv-writer";
import { contactModel } from "../contacts/contact_model";
import path from "path"
export const statsToCsv = async (date: string) => {
    try {
        const agentIds = [
          "214e92da684138edf44368d371da764c",
          "0411eeeb12d17a340941e91a98a766d0",
          "86f0db493888f1da69b7d46bfaecd360",
        ]; // Array of agent IDs
        const dailyStats = await contactModel
          .find({
            datesCalled: { $in: [date] },
            agentId: { $in: agentIds },
            isDeleted: { $ne: true },
          })
          .sort({ createdAt: "desc" })
          .populate("referenceToCallId");
        //   .populate("referenceToCallId");
        // Extract relevant fields from found contacts
        const contactsData = dailyStats.map((contact) => ({
          name: contact.firstname,
          email: contact.email,
          phone: contact.phone,
          status: contact.status,
          transcript: contact.referenceToCallId?.transcript || "",
          call_recording_url: contact.referenceToCallId.recordingUrl,
        }));
        // Write contacts data to CSV file
        const filePath = path.join(__dirname, "..", "..", "public", "stats.csv");
        console.log("File path:", filePath); // Log file path for debugging

        const csvWriter = createObjectCsvWriter({
          path: filePath,
          header: [
            { id: "name", title: "Name" },
            { id: "email", title: "Email" },
            { id: "phone", title: "Phone Number" },
            { id: "status", title: "Status" },
            { id: "transcript", title: "Transcript" },
            { id: "call_recording_url", title: "Call_Recording_Url" },
          ],
        });

        await csvWriter.writeRecords(contactsData);
        console.log("CSV file logs.csv has been written successfully");
        return filePath
      } catch (error) {
        console.error(error);
        return `error occured during csv: ${error}`
      }
}