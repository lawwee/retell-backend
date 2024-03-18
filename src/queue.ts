import { contactModel } from "./contacts/contact_model";
import axios from "axios";
import cron from "cron";
import { CronJob } from "cron";

let job: CronJob | null = null;

export function scheduleCronJob(scheduledTimePST: string, agentId:string) {
  let job = new CronJob(
    scheduledTimePST,
    async () => {
      try {
        const batchSize = 100;
        let skip = 0;
        let contacts = await contactModel
          .find({
            firstname: "Nick",
            lastname: "Bernadini",
            agentId: "86f0db493888f1da69b7d46bfaecd360",
          })
          .limit(batchSize)
          .skip(skip);

        while (contacts.length > 0) {
          for (const contact of contacts) {
            try {
              const postdata = {
                fromNumber: "+17257268989",
                toNumber: contact.phone,
                userId: contact._id,
              };
              // Await the axios call inside the loop
              const response = await axios.post(
                `https://4b08-102-89-44-194.ngrok-free.app/create-phone-call/${agentId}`,
                postdata,
              );
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
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }

          skip += batchSize;
          contacts = await contactModel.find({ firstname: "Nick", lastname: "Bernadini" }).limit(batchSize).skip(skip);
        }
      } catch (error) {
        console.error(
          `Error querying contacts: ${
            (error as Error).message || "Unknown error"
          }`,
        );
      }
    },
    null,
    true,
    "America/Los_Angeles",
  );
  job.start();
}

export function cancelCronJob() {
  if (job) {
    job.stop();
    console.log("Cron job cancelled successfully.");
  } else {
    console.log("No cron job to cancel.");
  }
}
