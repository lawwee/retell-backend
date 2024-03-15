import IORedis from "ioredis";
import { Worker, Queue, Job } from "bullmq";
import scheduler from "node-schedule";
import { contactModel } from "./contacts/contact_model";
import axios from "axios";

const connection = new IORedis({
  port: 17112,
  host: "redis-17112.c325.us-east-1-4.ec2.cloud.redislabs.com",
  password: process.env.RED_PASS,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  offlineQueue: false,
});

const queue = new Queue("userCallQueue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

const queue2 = new Queue("processPhonecall2", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

const processPhonecall1 = async (job: Job) => {
  const data = job.data;
  const { phone, agentId, _id } = data;
  const fromNumber = "+17257268989";
  try {
    // Start processing call
    const postData = { fromNumber, toNumber: phone, userId: _id };
    await axios.post(
      `https://retell-backend.onrender.com/create-phone-call/${agentId}`,
      postData,
    );
    console.log("Call initiated successfully.");
  } catch (error) {
    console.error(`Error calling phone number :`, error);
    throw error;
  }
};
const processPhonecall2 = async (job: Job) => {
  const { agentId } = job.data;
  const fromNumber = "+17257268989";
        try {
          const calledNotAnsweredContacts = await contactModel.find({
            agentId: agentId,
            status: "called-NA-VM",
            isDeleted: { $ne: true },
          });
          for (const contact of calledNotAnsweredContacts) {
            const postData = {
              fromNumber,
              toNumber: contact.phone,
              userId: contact._id,
            };
            await axios.post(
              `https://retell-backend.onrender.com/create-phone-call/${agentId}`,
              postData,
            );
            console.log("Processing contact for Worker 2:", contact);
          }
        } catch (error) {
          console.error("Error fetching contacts:", error);
        }
};

const worker1 = new Worker("userCallQueue", processPhonecall1, {
  connection,
  limiter: { max: 1, duration: 10000 },
  lockDuration: 5000,
  removeOnComplete: {
    age: 3600,
    count: 1000,
  },
  removeOnFail: {
    age: 24 * 3600, // keep up to 24 hours
  },
});

const worker2 = new Worker("processPhonecall2", processPhonecall2, {
  connection,
  limiter: { max: 1, duration: 20000 },
  lockDuration: 5000,
  removeOnComplete: {
    age: 3600,
    count: 1000,
  },
  removeOnFail: {
    age: 24 * 3600,
  },
});
worker2.pause();

worker1.on("completed", async () => {
  console.log("Worker 1 completed all jobs. Starting Worker 2.");
  worker2.resume(); // Resume Worker 2
});

export async function scheduleJobTrigger(rule: any, agentId: any, limit: any) {
  scheduler.scheduleJob(rule, async () => {
    try {
      console.log("agent Id got", agentId);
      const contacts = await contactModel
        .find({
          agentId,
          status: "not called",
          isDeleted: { $ne: true },
        })
        .limit(limit);
      for (const contact of contacts) {
        await queue.add("startPhoneCall", contact);
      }
      console.log("Contacts added to the queue");
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  });
}
export async function scheduleJobTrigger2(agentId: string) {
  try {
    await queue2.add("startPhoneCall2", agentId);
  } catch (error) {
    console.error("Error fetching contacts:", error);
  }
}
export async function clearAllScheduledJobs() {
  await scheduler.gracefulShutdown()
}
