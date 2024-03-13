import cors from "cors";
import axios from "axios";
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
import { connectDb, contactModel } from "./contacts/contact_model";
import { chloeDemoLlmClient } from "./chloe_llm_openai";
import { emilyDemoLlmClient } from "./emily_llm-openai";
import { oliviaDemoLlmClient } from "./olivia_llm_openai";
import { TwilioClient } from "./twilio_api";
import { IContact, RetellRequest, callstatusenum } from "./types";
import * as Papa from "papaparse";
import fs from "fs";
import multer from "multer";
import { Worker, Queue, Job } from "bullmq";
import { scheduleJob } from "node-schedule";
import IORedis from "ioredis";

connectDb();
export class Server {
  private httpServer: HTTPServer;
  public app: expressWs.Application;
  private chloeClient: chloeDemoLlmClient;
  private emilyClient: emilyDemoLlmClient;
  private oliviaClient: oliviaDemoLlmClient;
  private retellClient: RetellClient;
  private twilioClient: TwilioClient;

  //multer for file upload
  storage = multer.diskStorage({
    destination: "public/", // Destination directory for uploaded files
    filename: function (req, file, cb) {
      cb(null, file.originalname); // Use original file name
    },
  });
  upload = multer({ storage: this.storage });
  //con
  constructor() {
    this.app = expressWs(express()).app;
    this.httpServer = createServer(this.app);
    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(express.urlencoded({ extended: true }));

    this.handleRetellLlmWebSocket();
    this.handleRegisterCallAPI();
    this.handleContactSaving();
    this.handlecontactDelete();
    this.handlecontactGet();
    this.createPhoneCall();
    this.handleContactUpdate();
    this.uploadcsvToDb();
    this.schedulemycall();
    this.usingCallendly();
    this.clearqueue();
    // this.updateCurentdb()

    // this.llmClient = new DemoLlmClient();
    this.chloeClient = new chloeDemoLlmClient();
    this.emilyClient = new emilyDemoLlmClient();
    this.oliviaClient = new oliviaDemoLlmClient();
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
        const firstname = user.firstname;
        const email = user.email;
        console.log("this is the agent id", user.agentId);
        // Start sending the begin message to signal the client is ready.

        if (user.agentId === "214e92da684138edf44368d371da764c") {
          console.log("Call started with olivia");
          this.oliviaClient.oliviaBeginMessage(ws, firstname, email);
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
              this.oliviaClient.DraftResponse(request, ws);
            } catch (err) {
              console.error("Error in parsing LLM websocket message: ", err);
              ws.close(1002, "Cannot parse incoming message.");
            }
          });
        }

        if (user.agentId === "0411eeeb12d17a340941e91a98a766d0") {
          console.log("Call started with chloe");
          this.chloeClient.chloeBeginMessage(ws, firstname, email);
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
              this.chloeClient.DraftResponse(request, ws);
            } catch (err) {
              console.error("Error in parsing LLM websocket message: ", err);
              ws.close(1002, "Cannot parse incoming message.");
            }
          });
        }
        if (user.agentId === "86f0db493888f1da69b7d46bfaecd360") {
          console.log("Call started with emily");
          this.emilyClient.emilyBeginMessage(ws, firstname, email);
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
              this.emilyClient.DraftResponse(request, ws);
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
  usingCallendly() {
    this.app.get("/callender", async (req: Request, res: Response) => {
      try {
        const apiToken = process.env.CALLENDY_API;
        const headers = {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        };
        const response = await axios.get(
          "https://api.calendly.com/event_types",
          { headers },
        );
        const eventTypes = response.data;
        res.json({ eventTypes });
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error("Failed to retrieve event types:", error);
        } else {
          console.error("Failed to retrieve event types:", error);
        }
        res.status(500).json({ error: "Failed to retrieve event types" });
      }
    });
  }
  schedulemycall() {
    this.app.post("/schedule", async (req: Request, res: Response) => {
      const { hour, minute } = req.body;
      if (!hour || !minute) {
        res.json({ message: "Please provide and hour and minute" });
      }
      const newhour = parseInt(hour);
      const newMin = parseInt(minute);
      try {
        function createPSTDate(newhour: number, newMin: number) {
          const currentDate = new Date();
          currentDate.setUTCHours(newhour - 8);
          currentDate.setUTCMinutes(newMin);
          currentDate.setUTCSeconds(0);

          return currentDate;
        }
        const newdate = createPSTDate(newhour, newMin);
        scheduleJobTrigger(newdate);
        res.status(200).json({ message: "Schedule set successfully" });
      } catch (error) {
        console.error("Error setting schedule:", error);
        res.status(500).json({ error: "Internal server error" });
      }
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

      const processPhoneCallWrapper =
        (twilioClient: TwilioClient) => async (job: Job) => {
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

      new Worker("userCallQueue", processPhoneCallWrapper(this.twilioClient), {
        connection,
        limiter: { max: 1, duration: 120000 },
        lockDuration: 5000, // 5 seconds to process the job before it can be picked up by another worker
        removeOnComplete: {
          age: 3600,
          count: 1000, // keep up to 1000 jobs
        },
        removeOnFail: {
          age: 24 * 3600, // keep up to 24 hours
        },
      });

      async function scheduleJobTrigger(oneMinuteLater: Date) {
        scheduleJob(oneMinuteLater, async () => {
          try {
            const contacts = await contactModel
              .find({
                firstname: "Nick",
                lastname: "Bernadini",
              })
              .limit(100);
            console.log(contacts);
            for (const contact of contacts) {
              await queue.add("startPhoneCall", contact);
            }
            console.log("Contacts added to the queue");
          } catch (error) {
            console.error("Error fetching contacts:", error);
          }
        });
      }
    });
  }
  clearqueue() {
    // Define a new endpoint to get total number of jobs and clear the queue
    this.app.get("/clear-queue", async (req: Request, res: Response) => {
      const redisConfig = new IORedis({
        port: 17112,
        host: "redis-17112.c325.us-east-1-4.ec2.cloud.redislabs.com",
        password: process.env.RED_PASS,
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        offlineQueue: false,
      });
      const queue = new Queue("userCallQueue", {
        connection: redisConfig,
      });

      try {
        // Get total number of jobs in the queue
        const totalJobsBeforeClear = await queue.count();
        console.log(
          `Total number of jobs before clearing: ${totalJobsBeforeClear}`,
        );

        // Clear all jobs in the queue
        await queue.drain();
        console.log("Queue cleared successfully");

        // Get total number of jobs after clearing
        const totalJobsAfterClear = await queue.count();
        console.log(
          `Total number of jobs after clearing: ${totalJobsAfterClear}`,
        );

        res.status(200).json({
          totalJobsBeforeClear,
          totalJobsAfterClear,
          message: "Queue cleared successfully",
        });
      } catch (error) {
        console.error("Error clearing queue:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
}
