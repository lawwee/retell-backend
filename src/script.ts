
// Import required modules
import mongoose from 'mongoose';
import axios from 'axios';
import { createObjectCsvWriter } from 'csv-writer';
import { contactModel, EventModel } from './contacts/contact_model';


// Retell API configuration
const RETELL_API_URL = 'https://retell.api.url'; // Replace with actual Retell API URL
const RETELL_API_KEY = 'your_retell_api_key'; // Replace with your Retell API key

// Function to call Retell API
async function getRetellCallData(callId:String) {
  try {
    const response = await axios.get(`${RETELL_API_URL}/calls/${callId}`, {
      headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching call data for callId ${callId}:`, error);
    return null;
  }
}

// CSV Writer setup (optional, for logging results)
const csvWriter = createObjectCsvWriter({
  path: 'contacts_with_summary.csv',
  header: [
    { id: 'firstname', title: 'Firstname' },
    { id: 'lastname', title: 'Lastname' },
    { id: 'email', title: 'Email' },
    { id: 'callSummary', title: 'Retell Call Summary' },
  ],
});

// Main script function
export async function script() {
  try {
    
    // Find contacts marked as deleted
    const foundContacts = await contactModel
      .find({ isDeleted: true })
      .populate('referenceToCallId');

    const contactSummaries = [];

    // Process each found contact
    for (const contact of foundContacts) {
      const callId = contact.callId;

      // Retrieve call data from Retell API
      if (callId) {
        const retellData = await getRetellCallData(callId);
        if (retellData && retellData.call_analysis) {
          const callSummary = retellData.call_analysis.call_summary;

          // Update retellCallSummary in the transcript model
          if (contact.referenceToCallId) {
            await EventModel.findByIdAndUpdate(
              contact.referenceToCallId._id,
              { retellCallSummary: callSummary }
            );

            console.log(`Updated call summary for contact ${contact.firstname} ${contact.lastname}`);
          }

          // Prepare data for CSV logging
          contactSummaries.push({  callSummary: callSummary,
          });
        }
      }
    }

    // Write results to CSV (optional)
    await csvWriter.writeRecords(contactSummaries);
    console.log('Contacts and call summaries exported to CSV.');

  } catch (error) {
    console.error('Error processing contacts:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
  }
}
