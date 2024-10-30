// import { contactModel } from "./contacts/contact_model";
import { createObjectCsvWriter } from 'csv-writer';
import { contactModel } from './contacts/contact_model';

export async function script() {
  try {
    // Step 1: Aggregate to find duplicate phone numbers across agents, excluding deleted contacts
    const duplicates = await contactModel.aggregate([
      {
        $match: { isDeleted: false } // Filter to include only non-deleted contacts
      },
      {
        $group: {
          _id: "$phone",
          count: { $sum: 1 },
          duplicates: { 
            $push: { 
              _id: "$_id",
              firstname: "$firstname",
              lastname: "$lastname",
              email: "$email",
              agentId: "$agentId",
              datesCalled: "$datesCalled",
              referenceToCallId: "$referenceToCallId"
            }
          }
        }
      },
      {
        $match: { count: { $gt: 1 } } // Filter to include only duplicate phone numbers
      }
    ]);

    // Step 2: Flatten duplicates for further processing
    const flattenedDuplicates = duplicates.flatMap((duplicate: any) =>
      duplicate.duplicates.map((doc: any) => ({
        ...doc,
        phone: duplicate._id // Include the phone number in each document
      }))
    );

    // Step 3: Populate referenceToCallId with disconnectionReason, analyzedTranscript, and transcript
    const populatedDuplicates = await contactModel.populate(flattenedDuplicates, {
      path: 'referenceToCallId',
      select: 'disconnectionReason analyzedTranscript transcript',
    });

    // Step 4: Prepare CSV writer
    const csvWriter = createObjectCsvWriter({
      path: './duplicates.csv', // Specify the path for your CSV file
      header: [
        { id: 'phone', title: 'Phone' },
        { id: 'firstname', title: 'First Name' },
        { id: 'lastname', title: 'Last Name' },
        { id: 'email', title: 'Email' },
        { id: 'agentId', title: 'Agent ID' },
        { id: 'datesCalled', title: 'Dates Called' },
        { id: 'disconnectionReason', title: 'Disconnection Reason' },
        { id: 'analyzedTranscript', title: 'Analyzed Transcript' },
        { id: 'transcript', title: 'Transcript' },
        // Add more headers for any other fields you’re exporting
      ]
    });

    // Step 5: Flatten and format the data for CSV
    const records = populatedDuplicates.map((doc: any) => {
      const ref = doc.referenceToCallId || {};
      return {
        phone: doc.phone,
        firstname: doc.firstname,
        lastname: doc.lastname,
        email: doc.email,
        agentId: doc.agentId,
        datesCalled: doc.datesCalled ? doc.datesCalled.join(', ') : '',
        disconnectionReason: ref.disconnectionReason || '',
        analyzedTranscript: ref.analyzedTranscript || '',
        transcript: ref.transcript || ''
      };
    });

    // Step 6: Write data to CSV
    await csvWriter.writeRecords(records);
    console.log("Duplicate records exported to duplicates.csv."); 

    const idsToDelete = flattenedDuplicates.map((doc: any) => doc._id); 
    if (idsToDelete.length > 0) {
      await contactModel.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`Deleted ${idsToDelete.length} duplicate contacts.`);
    } else {
      console.log("No contacts to delete.");
    }

  } catch (error) {
    console.error("Error exporting duplicates to CSV:", error);
  }
}
