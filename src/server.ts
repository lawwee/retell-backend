import cors from "cors";
import express, { Request, Response } from "express";
import expressWs from "express-ws";
import { Server as HTTPServer, createServer } from "http";
import { RawData, WebSocket } from "ws";
import { RetellClient } from "retell-sdk";
import {
  AudioEncoding,
  AudioWebsocketProtocol,
} from "retell-sdk/models/components";
import {
  createContact,
  deleteOneContact,
  getAllContact,
  updateOneContact,
} from "./contacts/contact_controller";
import {
  connectDb,
  contactModel,
  jobModel,
  EventModel,
} from "./contacts/contact_model";
import { TwilioClient } from "./twilio_api";
import { IContact, RetellRequest, callstatusenum, jobstatus } from "./types";
import * as Papa from "papaparse";
import fs from "fs";
import multer from "multer";
import moment from "moment-timezone";
import { chloeDemoLlmClient } from "./chloe_llm_openai";
import { ethanDemoLlmClient } from "./ethan_llm_openai";
import { danielDemoLlmClient } from "./daniel_llm-openai";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import schedule from "node-schedule";
// import { testFunctionCallingLlmClient } from "./llm_azure_openai_func_call";
import { createObjectCsvWriter } from "csv-writer";
import path from "path";
process.env.TZ = "America/Los_Angeles";

connectDb();
console.log("connected")
import SmeeClient from "smee-client";
import { katherineDemoLlmClient } from "./be+well_llm_openai";
import { testFunctionCallingLlmClient } from "./llm_openai_func_call";
export class Server {
  private httpServer: HTTPServer;
  public app: expressWs.Application;
  private retellClient: RetellClient;
  private twilioClient: TwilioClient;
  storage = multer.diskStorage({
    destination: "public/", // Destination directory for uploaded files
    filename: function (req, file, cb) {
      cb(null, file.originalname); // Use original file name
    },
  });
  upload = multer({ storage: this.storage });
  constructor() {
    this.app = expressWs(express()).app;
    this.httpServer = createServer(this.app);
    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, "public")));

    this.handleRetellLlmWebSocket();
    this.handleRegisterCallAPI();
    this.handleContactSaving();
    this.handlecontactDelete();
    this.handlecontactGet();
    this.createPhoneCall();
    this.handleContactUpdate();
    this.uploadcsvToDb();
    this.schedulemycall();
    this.cleardb();
    this.getjobstatus();
    this.updateStatus();
    this.getTimefromcallendly();
    this.getCallLogs();
    this.stopSpecificSchedule();
    this.getAllJobSchedule();
    this.getTranscriptAfterCallEnded();
    this.getAllJob();
    this.getoneuser();
    this.stopSpecificJob();
    this.deleteAll();
    this.logsToCsv();
    this.updatereference();
    // this.stopSpecificJob();

    this.retellClient = new RetellClient({
      apiKey: process.env.RETELL_API_KEY,
    });

    this.twilioClient = new TwilioClient();
    this.twilioClient.ListenTwilioVoiceWebhook(this.app);
  }

  listen(port: number): void {
    this.app.listen(port);
    console.log("Listening on " + port);
  }
  smee = new SmeeClient({
    source: "https://smee.io/gRkyib7zF2UwwFV",
    target: "https://retell-backend-yy86.onrender.com/webhook",
    logger: console,
  });
  events = this.smee.start();

  handleRegisterCallAPI() {
    this.app.post(
      "/register-call-on-your-server",
      async (req: Request, res: Response) => {
        // Extract agentId from request body; apiKey should be securely stored and not passed from the client
        const { agentId, id } = req.body;

        try {
          const callResponse = await this.retellClient.registerCall({
            agentId: agentId,
            audioWebsocketProtocol: AudioWebsocketProtocol.Web,
            audioEncoding: AudioEncoding.S16le,
            sampleRate: 24000,
          });
          // Send back the successful response to the client
          res.json(callResponse.callDetail);
        } catch (error) {
          console.error("Error registering call:", error);
          // Send an error response back to the client
          res.status(500).json({ error: "Failed to register call" });
        }
      },
    );
  }
  
  handleRetellLlmWebSocket() {
    this.app.ws(
      "/llm-websocket/:call_id",
      async (ws: WebSocket, req: Request) => {
        const callId = req.params.call_id;
        console.log("Handle llm ws for: ", callId);
        const user = await contactModel.findOne({ callId });

        if (user.agentId === "214e92da684138edf44368d371da764c") {
          console.log("Call started with ethan/ olivia");
          const oclient = new ethanDemoLlmClient();
          oclient.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: callstatusenum.CALLED },
            );
            console.error("Closing llm ws for: ", callId);
          });
          ws.on("message", async (data: RawData, isBinary: boolean) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: "on call" },
            );
            console.log(data.toString());
            if (isBinary) {
              console.error("Got binary message instead of text in websocket.");
              ws.close(1002, "Cannot find corresponding Retell LLM.");
            }
            try {
              const request: RetellRequest = JSON.parse(data.toString());
              oclient.DraftResponse(request, ws);
            } catch (err) {
              console.error("Error in parsing LLM websocket message: ", err);
              ws.close(1002, "Cannot parse incoming message.");
            }
          });
        }

        if (user.agentId === "0411eeeb12d17a340941e91a98a766d0") {
          console.log("Call started with chloe");
          const client = new testFunctionCallingLlmClient();
          client.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: callstatusenum.CALLED },
            );
            console.error("Closing llm ws for: ", callId);
          });
          ws.on("message", async (data: RawData, isBinary: boolean) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: "on call" },
            );
            console.log(data.toString());
            if (isBinary) {
              console.error("Got binary message instead of text in websocket.");
              ws.close(1002, "Cannot find corresponding Retell LLM.");
            }
            try {
              const request: RetellRequest = JSON.parse(data.toString());
              client.DraftResponse(request, ws);
            } catch (err) {
              console.error("Error in parsing LLM websocket message: ", err);
              ws.close(1002, "Cannot parse incoming message.");
            }
          });
        }

        if (user.agentId === "86f0db493888f1da69b7d46bfaecd360") {
          console.log("Call started with daniel/emily");
          const client = new danielDemoLlmClient();
          client.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: callstatusenum.CALLED },
            );
            console.error("Closing llm ws for: ", callId);
          });
          ws.on("message", async (data: RawData, isBinary: boolean) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: "on call" },
            );
            console.log(data.toString());
            if (isBinary) {
              console.error("Got binary message instead of text in websocket.");
              ws.close(1002, "Cannot find corresponding Retell LLM.");
            }
            try {
              const request: RetellRequest = JSON.parse(data.toString());
              client.DraftResponse(request, ws);
            } catch (err) {
              console.error("Error in parsing LLM websocket message: ", err);
              ws.close(1002, "Cannot parse incoming message.");
            }
          });
        }
        
        if (user.agentId === "40878d8bd2d1a6fea9756ae2368bab6e") {
          console.log("Call started with katherine");
          const oclient = new katherineDemoLlmClient();
          oclient.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: callstatusenum.CALLED },
            );
            console.error("Closing llm ws for: ", callId);
          });
          ws.on("message", async (data: RawData, isBinary: boolean) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: "on call" },
            );
            console.log(data.toString());
            if (isBinary) {
              console.error("Got binary message instead of text in websocket.");
              ws.close(1002, "Cannot find corresponding Retell LLM.");
            }
            try {
              const request: RetellRequest = JSON.parse(data.toString());
              oclient.DraftResponse(request, ws);
            } catch (err) {
              console.error("Error in parsing LLM websocket message: ", err);
              ws.close(1002, "Cannot parse incoming message.");
            }
          });
        }
      },
    );
  }

  handleContactSaving() {
    this.app.post("/users/create", async (req: Request, res: Response) => {
      const { firstname, lastname, email, phone, agentId } = req.body;
      try {
        const result = await createContact(
          firstname,
          lastname,
          email,
          phone,
          agentId,
        );
        res.json({ result });
      } catch (error) {}
    });
  }

  handlecontactGet() {
    this.app.get("/users/:agentId", async (req: Request, res: Response) => {
      const agentId = req.params.agentId;
      try {
        const result = await getAllContact(agentId);
        res.json({ result });
      } catch (error) {}
    });
  }

  handlecontactDelete() {
    this.app.patch("/users/delete", async (req: Request, res: Response) => {
      const { id } = req.body;
      try {
        const result = await deleteOneContact(id);
        res.json({ result });
      } catch (error) {}
    });
  }

  handleContactUpdate() {
    this.app.patch("/users/update", async (req: Request, res: Response) => {
      try {
        const { id, fields } = req.body;
        if (!fields) {
          return res
            .status(400)
            .json({ error: "No fields to update provided." });
        }
        const result = await updateOneContact(id, fields);
        res.json({ result });
      } catch (error) {
        console.log(error);
        res
          .status(500)
          .json({ error: "An error occurred while updating contact." });
      }
    });
  }

  createPhoneCall() {
    this.app.post(
      "/create-phone-call/:agentId",
      async (req: Request, res: Response) => {
        const { fromNumber, toNumber, userId } = req.body;
        const agentId = req.params.agentId;
        if (!agentId || !fromNumber || !toNumber || !userId) {
          return res.json({ status: "error", message: "Invalid request" });
        }
        try {
          await this.twilioClient.RegisterPhoneAgent(fromNumber, agentId);
          const result = await this.twilioClient.CreatePhoneCall(
            fromNumber,
            toNumber,
            agentId,
            userId,
          );
          res.json({ result });
        } catch (error) {
          console.log(error);
          res.json({
            status: "error",
            message: "Error while creating phone call",
          });
        }
      },
    );
  }

  uploadcsvToDb() {
    this.app.post(
      "/upload/:agentId",
      this.upload.single("csvFile"),
      async (req: Request, res: Response) => {
        try {
          if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
          }
          const csvFile = req.file;
          const csvData = fs.readFileSync(csvFile.path, "utf8");
          Papa.parse(csvData, {
            header: true,
            complete: async (results) => {
              const jsonArrayObj: IContact[] = results.data as IContact[];
              const insertedUsers = [];
              const agentId = req.params.agentId;
              for (const user of jsonArrayObj) {
                // Check if a user with the same email exists for any agent
                const existingUser = await contactModel.findOne({
                  email: user.email,
                });
                if (!existingUser) {
                  // If user doesn't exist for any agent, insert them
                  const userWithAgentId = { ...user, agentId };
                  const insertedUser = await contactModel.create(
                    userWithAgentId,
                  );
                  insertedUsers.push(insertedUser);
                } else {
                  // If user exists, check if it's associated with the current agent
                  if (existingUser.agentId !== agentId) {
                    // If not associated with the current agent, insert them
                    const userWithAgentId = { ...user, agentId };
                    const insertedUser = await contactModel.create(
                      userWithAgentId,
                    );
                    insertedUsers.push(insertedUser);
                  }
                }
              }
              console.log("Upload successful");
              console.log("Inserted users:", insertedUsers);
              res
                .status(200)
                .json({ message: "Upload successful", insertedUsers });
            },
            error: (err: Error) => {
              console.error("Error parsing CSV:", err);
              res.status(500).json({ message: "Failed to parse CSV data" });
            },
          });
        } catch (err) {
          console.error("Error:", err);
          res
            .status(500)
            .json({ message: "Failed to upload CSV data to database" });
        }
      },
    );
  }

  cleardb() {
    this.app.delete("/cleardb", async (req: Request, res: Response) => {
      const { agentId } = req.body;
      console.log(agentId);
      const result = await contactModel.deleteMany({ agentId });
      res.send(`db cleared sucesffully: ${result}`);
    });
  }

  getjobstatus() {
    this.app.post("/schedules/status", async (req: Request, res: Response) => {
      const { jobId } = req.body;
      const result = await jobModel.findOne({ jobId });
      res.json({ result });
    });
  }

  getAllJobSchedule() {
    this.app.get("/schedules/get", async (req: Request, res: Response) => {
      const result = await jobModel.find().sort({ createdAt: "desc" });
      res.json({ result });
    });
  }
  updateStatus() {
    this.app.post(
      "/users/status/reset",
      async (req: Request, res: Response) => {
        const { agentId } = req.body;
        const result = await contactModel.updateMany(
          { agentId },
          { status: "not called" },
        );
        res.json({ result });
      },
    );
  }
  schedulemycall() {
    this.app.post("/schedule", async (req: Request, res: Response) => {
      const { hour, minute, agentId, limit, fromNumber } = req.body;

      // Create a new Date object for the scheduled time in PST timezone
      const scheduledTimePST = moment
        .tz("America/Los_Angeles")
        .set({
          hour,
          minute,
          second: 0,
          millisecond: 0,
        })
        .toDate();

      // Format the date as per the required format (YYYY-MM-DDTHH:mm:ss)
      const formattedDate = moment(scheduledTimePST).format(
        "YYYY-MM-DDTHH:mm:ss",
      );

      // Schedule the job and get jobId and scheduledTime
      const { jobId, scheduledTime } = await this.scheduleCronJob(
        scheduledTimePST,
        agentId,
        limit,
        fromNumber,
        formattedDate,
      );

      // Send response with jobId and scheduledTime
      res.send({ jobId, scheduledTime });
    });
  }

  async scheduleCronJob(
    scheduledTimePST: Date,
    agentId: string,
    limit: string,
    fromNumber: string,
    formattedDate: string,
  ) {
    const jobId = uuidv4();
    try {
      // Create a new job entry in the database
      await jobModel.create({
        callstatus: jobstatus.QUEUED,
        jobId,
        agentId,
        scheduledTime: formattedDate,
        shouldContinueProcessing: true,
      });

      // Start the job
      const job = schedule.scheduleJob(jobId, scheduledTimePST, async () => {
        try {
          // Update the job status to indicate that it's in progress
          await jobModel.findOneAndUpdate(
            { jobId },
            { callstatus: jobstatus.ON_CALL },
          );
          const contactLimit = parseInt(limit);
          let processedContacts = 0;
          const contacts = await contactModel
            .find({ agentId, status: "not called", isDeleted: { $ne: true } })
            .limit(contactLimit)
            .sort({ createdAt: "desc" });

          // Loop through contacts
          for (const contact of contacts) {
            try {
              // Check if processing should be stopped
              const job = await jobModel.findOne({ jobId });
              if (!job || job.shouldContinueProcessing !== true) {
                console.log("Job processing stopped.");
                break;
              }
              const postdata = {
                fromNumber,
                toNumber: contact.phone,
                userId: contact._id.toString(),
                agentId,
              };
              await this.twilioClient.RegisterPhoneAgent(fromNumber, agentId);
              await this.twilioClient.CreatePhoneCall(
                postdata.fromNumber,
                postdata.toNumber,
                postdata.agentId,
                postdata.userId,
              );
              console.log(
                `Axios call successful for contact: ${contact.firstname}`,
              );
            } catch (error) {
              console.error(
                `Error processing contact ${contact.firstname}: ${
                  (error as Error).message || "Unknown error"
                }`,
              );
            }

            // Wait for a specified time before processing the next contact
            await new Promise((resolve) => setTimeout(resolve, 10000));
            await jobModel.findOneAndUpdate(
              { jobId },
              { $inc: { processedContacts: 1 } },
            );
            processedContacts++;
          }
          console.log("Contacts processed:", processedContacts);
          // Call function to search and recall contacts if needed
          await this.searchAndRecallContacts(
            contactLimit,
            agentId,
            fromNumber,
            jobId,
          );
        } catch (error) {
          console.error(
            `Error querying contacts: ${
              (error as Error).message || "Unknown error"
            }`,
          );
        }
      });

      console.log(
        `Job scheduled with ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}\n, scheduled time: ${scheduledTimePST}`,
      );

      return { jobId, scheduledTime: scheduledTimePST };
    } catch (error) {
      console.error("Error scheduling job:", error);
      throw error; // Throw error for handling in the caller function
    }
  }

  async searchAndRecallContacts(
    contactLimit: number,
    agentId: string,
    fromNumber: string,
    jobId: string,
  ) {
    try {
      let processedContacts = 0;
      let contacts = await contactModel
        .find({ agentId, status: "called-NA-VM", isDeleted: { $ne: true } })
        .limit(contactLimit)
        .sort({ createdAt: "desc" });
      for (const contact of contacts) {
        try {
          const job = await jobModel.findOne({ jobId });
          if (!job || job.shouldContinueProcessing !== true) {
            console.log("Job processing stopped.");
            break;
          }
          const postdata = {
            fromNumber,
            toNumber: contact.phone,
            userId: contact._id.toString(),
            agentId,
          };
          await this.twilioClient.RegisterPhoneAgent(fromNumber, agentId);
          await this.twilioClient.CreatePhoneCall(
            postdata.fromNumber,
            postdata.toNumber,
            postdata.agentId,
            postdata.userId,
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
        await new Promise((resolve) => setTimeout(resolve, 10000));
        await jobModel.findOneAndUpdate(
          { jobId },
          { $inc: { processedContactsForRedial: 1 } },
        );
        processedContacts++;
      }
      console.log("Recalled contacts processed:", processedContacts);
    } catch (error) {
      console.error("Error searching and recalling contacts:", error);
    }
  }

  stopSpecificJob() {
    this.app.post("/stop-job", async (req: Request, res: Response) => {
      try {
        const { jobId } = req.body;
        if (!jobId) {
          console.log("No jobId provided.");
          return res.status(400).send("No jobId provided.");
        }
        const job = await jobModel.findOneAndUpdate(
          { jobId },
          { shouldContinueProcessing: false, callstatus: jobstatus.CANCELLED },
        );

        if (!job) {
          console.log("No job found with the provided jobId:", jobId);
          return res.status(404).send("No job found with the provided jobId.");
        }
        console.log(`Processing stopped for job ${jobId}.`);
        return res.send("Processing stopped for job.");
      } catch (error: any) {
        console.error("Error stopping job:", error);
        return res
          .status(500)
          .send("Error stopping job: " + (error.message || error));
      }
    });
  }

  stopSpecificSchedule() {
    this.app.post("/cancel-schedule", async (req: Request, res: Response) => {
      const { jobId } = req.body;
      const scheduledJobs = schedule.scheduledJobs;

      if (!jobId) {
        return res.status(404).send(`Please provide an ID`);
      }
      // Check if the specified job exists
      if (!scheduledJobs.hasOwnProperty(jobId)) {
        return res.status(404).send(`Job with ID ${jobId} not found.`);
      }
      const isCancelled = schedule.cancelJob(jobId);
      if (isCancelled) {
        await jobModel.findOneAndUpdate(
          { jobId },
          { callstatus: jobstatus.CANCELLED },
        );
        res.send(`Job with ID ${jobId} cancelled successfully.`);
      } else {
        res.status(500).send(`Failed to cancel job with ID ${jobId}.`);
      }
    });
  }

  getAllJob() {
    this.app.get("/get-jobs", async (req: Request, res: Response) => {
      const scheduledJobs = schedule.scheduledJobs;
      let responseString = ""; // Initialize an empty string to accumulate job details

      for (const jobId in scheduledJobs) {
        if (scheduledJobs.hasOwnProperty(jobId)) {
          const job = scheduledJobs[jobId];
          responseString += `Job ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}\n`;
        }
      }

      // Send the accumulated job details as the response
      res.send({ responseString });
    });
  }

  getCallLogs() {
    this.app.get("/call-logs", async (req: Request, res: Response) => {
      const { agentId } = req.body;
      const result = await jobModel.find({ agentId });
      res.json({ result });
    });
  }

  getTimefromcallendly() {
    this.app.get("/calender", async (req: Request, res: Response) => {
      try {
        const response = await axios.get(
          `https://api.calendly.com/user_availability_schedules`,
          {
            params: {
              user: process.env.CALLENDY_URI,
            },
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.CALLENDY_API}`,
            },
          },
        );

        const availableTimesMap: { [day: string]: string[] } = {};

        response.data.collection.forEach((schedule: any) => {
          schedule.rules.forEach((rule: any) => {
            if (rule.intervals && rule.intervals.length > 0) {
              rule.intervals.forEach((interval: any) => {
                const { from } = interval; // Destructure from
                const [hour, minute] = from.split(":").map(Number); // Extract hour and minute

                // Convert 24-hour format to 12-hour format
                const period = hour >= 12 ? "pm" : "am";
                const formattedHour = (hour % 12 || 12).toString(); // Convert hour to 12-hour format

                const formattedMinute = minute.toString().padStart(2, "0"); // Add leading zero if minute < 10

                const formattedTime = `${formattedHour}:${formattedMinute}${period}`;

                if (!availableTimesMap[rule.wday]) {
                  availableTimesMap[rule.wday] = [formattedTime];
                } else {
                  availableTimesMap[rule.wday].push(formattedTime);
                }
              });
            }
          });
        });

        let content = "";

        Object.keys(availableTimesMap).forEach((day: string) => {
          const times = availableTimesMap[day];
          const timeString = times.join(" or ");
          content += `${day} at ${timeString}, `;
        });

        // Remove trailing comma and space
        content = content.slice(0, -2);
        console.log(content);
        res.send(content);
      } catch (error) {
        console.error(
          "Error fetching availability schedules from Calendly:",
          error,
        );
        res.send("Error fetching availability schedules from Calendly");
      }
    });
  }

  async getTranscriptAfterCallEnded() {
    this.app.post("/webhook", async (request: Request, response: Response) => {
      const payload = request.body;
      // const signatureVerified = this.verifyRetellWebhookSignature(request);
      // if (!signatureVerified) {
      //   // If signature verification fails, log an error and return a 401 Unauthorized response
      //   console.error("Retell webhook signature verification failed.");
      //   return response.status(401).json({ error: "Unauthorized" });
      // }
      try {
        if (payload.event === "call_ended") {
          const { event, call_id, transcript } = payload.data;

          // Perform custom actions with the transcript, timestamps, etc.
          console.log("Event", event);
          console.log(transcript);
          const result = await EventModel.create({
            event: payload.event,
            transcript,
            callId: call_id,
          });
          const result2 = await contactModel.findOneAndUpdate(
            { callId: call_id },
            { referenceToCallId: result._id },
          );
          // Respond with acknowledgment
          response.json({ Result: "Transcript saved to DB" });
        } else {
          // For other event types, if any, you can add corresponding logic here
          console.log("Received event type:", payload.event);
          response.json({ received: false, error: "Unsupported event type" });
        }
      } catch (error) {
        console.log(error);
      }
    });
  }

  getoneuser() {
    this.app.post("/getone", async (request: Request, response: Response) => {
      const { callId } = request.body;
      const result = await contactModel
        .findOne({ callId })
        .populate("referenceToCallId");
      console.log(result);
      response.send(result);
    });
  }

  deleteAll() {
    this.app.patch("/deleteAll", async (req: Request, res: Response) => {
      const { agentId } = req.body;
      const result = await contactModel.updateMany(
        { agentId },
        { isDeleted: true },
      );
      res.send(result);
    });
  }

  logsToCsv() {
    this.app.post("/get-logs", async (req: Request, res: Response) => {
      const { agentId, limit } = req.body;
      const newlimit = parseInt(limit);
      try {
        const foundContacts = await contactModel
          .find({ agentId, isDeleted: { $ne: true } })
          .sort({ createdAt: "desc" })
          .populate("referenceToCallId")
          .limit(newlimit);

        // Extract relevant fields from found contacts
        const contactsData = foundContacts.map((contact) => ({
          name: contact.firstname,
          email: contact.email,
          phone: contact.phone,
          status: contact.status,
          transcript: contact.referenceToCallId?.transcript || "",
        }));

        // Write contacts data to CSV file
        const filePath = path.join(__dirname, "..", "public", "logs.csv");
        console.log("File path:", filePath); // Log file path for debugging

        const csvWriter = createObjectCsvWriter({
          path: filePath,
          header: [
            { id: "name", title: "Name" },
            { id: "email", title: "Email" },
            { id: "phone", title: "Phone Number" },
            { id: "status", title: "Status" },
            { id: "transcript", title: "Transcript" },
          ],
        });

        await csvWriter.writeRecords(contactsData);
        console.log("CSV file logs.csv has been written successfully");

        // Check if the file exists synchronously
        if (fs.existsSync(filePath)) {
          // Set the response headers to trigger file download
          res.setHeader("Content-Disposition", "attachment; filename=logs.csv");
          res.setHeader("Content-Type", "text/csv");

          // Create a read stream from the CSV file and pipe it to the response
          const fileStream = fs.createReadStream(filePath);
          fileStream.pipe(res);
        } else {
          console.error("CSV file does not exist");
          res.status(404).send("CSV file not found");
        }
      } catch (error) {
        console.error(`Error retrieving contacts: ${error}`);
        res.status(500).send(`Error retrieving contacts: ${error}`);
      }
    });
  }

  updatereference() {
    this.app.get("/updates", async () => {
      try {
        // Update documents where referenceToCallId is missing
        await contactModel.updateMany(
          { referenceToCallId: { $exists: false } },
          {
            $set: {
              referenceToCallId: null,
            },
          },
        );

        console.log("Documents updated successfully");
      } catch (error) {
        console.error("Error updating documents:", error);
        throw error; // Throw the error to handle it in the caller function
      }
    });
  }
}
