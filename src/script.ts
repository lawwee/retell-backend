import callHistoryModel from "./contacts/history_model";
import Retell from "retell-sdk";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY,
});

export async function script() {
  try {
    // Fetch the first 1000 contacts from callHistoryModel in descending order by creation date
    const contacts = await callHistoryModel.find().sort({ createdAt: -1 }).limit(5000).exec();

    let processedCount = 0; // Initialize a counter for processed contacts

    // Process each contact
    for (const contact of contacts) {
      try {
        console.log(`Processing contact with callId: ${contact.callId}`); // Log the callId

        // Retrieve call details from Retell
        const callResponse = await retell.call.retrieve(contact.callId);

        // Check if callResponse is valid
        if (callResponse) {
          const { user_firstname, user_lastname } = callResponse.retell_llm_dynamic_variables as {
            user_firstname: string;
            user_lastname: string;
          };

          const status = callResponse.call_status;
          const summary = callResponse.call_analysis.call_summary;
          const sentiment = callResponse.call_analysis.user_sentiment;

          if (user_firstname) {
            // Update the contact's fields
            contact.userFirstname = user_firstname || contact.userFirstname;
            contact.userLastname = user_lastname || contact.userLastname;
            contact.callSummary = summary;
            contact.userSentiment = sentiment;
            contact.callStatus = status;

            // Save the updated contact
            await contact.save();
            processedCount++; // Increment the counter
            console.log(`Processed contact ${processedCount}: ${contact.callId}`); // Log processed count
          }
        }
      } catch (contactError) {
        console.error(`Error processing contact with callId ${contact.callId}:`, contactError);
        // Skip to the next contact
      }
    }

    console.log(`Total contacts processed successfully: ${processedCount}`);
  } catch (error) {
    console.error('Error occurred while fetching contacts:', error);
  }
}