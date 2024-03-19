import { contactModel, jobModel } from "./contacts/contact_model";
import axios from "axios";
import mongoose from "mongoose";
import { CronJob } from "cron";
import { v4 as uuidv4 } from "uuid";
import { jobstatus } from "./types";

let job: CronJob | null = null;

export async function scheduleCronJob(
  scheduledTimePST: string,
  agentId: string,
  limit: string,
) {
  const jobId = uuidv4();
  await jobModel.create({ callstatus: jobstatus.QUEUED, jobId });
  job = new CronJob(
    scheduledTimePST,
    async () => {
      try {
        await jobModel.findOneAndUpdate(
          { callId: jobId },
          { callstatus: jobstatus.ON_CALL },
        );
        const totalContacts = parseInt(limit); // Total number of contacts to be processed
        const batchSize = 100; // Batch size for each query
        let processedContacts = 0; // Counter for processed contacts

        // Retrieve contacts from the database
        let contacts = await contactModel
          .find({ firstname: "Nick", lastname:"Bernardini",agentId })
          .limit(totalContacts); // Limit the number of contacts retrieved by the totalContacts value
          console.log("the number of contact is", contacts)
        // Loop over the retrieved contacts
        for (const contact of contacts) {
          try {
            const postdata = {
              fromNumber: "+17252552434",
              toNumber: contact.phone,
              userId: contact._id,
            };
            // Await the axios call inside the loop
            await axios.post(
              `https://retell-backend-yy86.onrender.com/create-phone-call/${agentId}`,
              postdata,
            );
            // await axios.post(
            //   `https://523e-102-89-47-26.ngrok-free.app/create-phone-call/${agentId}`,
            //   postdata,
            // );
            console.log(
              `Axios call successful for contact: ${contact.firstname}`,
            );
          } catch (error) {
            const errorMessage = (error as Error).message || "Unknown error";
            console.error(
              `Error processing contact ${contact.firstname}: ${errorMessage}`,
            );
          }
          // Wait for 10 seconds before processing the next contact
          await new Promise((resolve) => setTimeout(resolve, 30000));
          processedContacts++; // Increment the processed contacts counter

          // If all contacts have been processed, stop the loop
          if (processedContacts >= contacts.length) {
            break;
          }
        }

        // Stop the job after processing all contacts
        job.stop();
        console.log("Cron job stopped successfully.");
        // Check if the job is really stopped
        if (!job.running) {
          console.log("Cron job is stopped.");
          await jobModel.findOneAndUpdate(
            { callId: jobId },
            { callstatus: jobstatus.CALLED },
          );
        } else {
          console.log("Cron job is still running.");
        }

        // Call the function to search the DB for people who were called but didn't answer and recall them
        await searchAndRecallContacts(processedContacts, agentId); // Pass the actual number of processed contacts
      } catch (error) {
        console.error(
          `Error querying contacts: ${
            (error as Error).message || "Unknown error"
          }`,
        );
      }
    },
    null,
    true, // The job will run repeatedly
    "America/Los_Angeles",
  );
  job.start();
  console.log("this is the job object", job);
  return { jobId, scheduledTime: scheduledTimePST };
}

export function cancelCronJob() {
  if (job) {
    job.stop();
    console.log("Cron job cancelled successfully.");
  } else {
    console.log("No cron job to cancel.");
  }
}

async function searchAndRecallContacts(limit: number, agentId: string) {
  try {
    const batchSize = 100; // Batch size for each query
    let processedContacts = 0; // Counter for processed contacts

    // Retrieve recalled contacts from the database
    let recalledContacts = await contactModel
      .find({ firstname: "Nick", lastname:"Bernardini", agentId })
      .limit(limit);

    // Loop over the recalled contacts
    for (const contact of recalledContacts) {
      try {
        const postdata = {
          fromNumber: "+17252552434",
          toNumber: contact.phone,
          userId: contact._id,
        };
        // Await the axios call inside the loop
        await axios.post(
          `https://retell-backend-yy86.onrender.com/create-phone-call/${agentId}`,
          postdata,
        );
        console.log(
          `Axios call successful for recalled contact: ${contact.firstname}`,
        );
      } catch (error) {
        const errorMessage = (error as Error).message || "Unknown error";
        console.error(
          `Error processing recalled contact ${contact.firstname}: ${errorMessage}`,
        );
      }
      // Wait for 30 seconds before processing the next contact
      await new Promise((resolve) => setTimeout(resolve, 30000));
      processedContacts++; // Increment the processed contacts counter

      // If all contacts have been processed or the limit has been reached, stop the loop
      if (
        processedContacts >= recalledContacts.length ||
        processedContacts >= limit
      ) {
        break;
      }
    }

    console.log("Recalled contacts processed:", processedContacts);
  } catch (error) {
    console.error("Error searching and recalling contacts:", error);
  }
}
