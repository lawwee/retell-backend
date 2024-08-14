process.env.TZ = "America/Los_Angeles";
import cors from "cors";
import express, { Request, Response } from "express";
import expressWs from "express-ws";
import https, {
  Server as HTTPSServer,
  createServer as httpsCreateServer,
} from "https";
import { Server as HTTPServer, createServer as httpCreateServer } from "http";
import { RawData, WebSocket } from "ws";
import { Retell } from "retell-sdk";
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
import axios from "axios";
import argon2 from "argon2";
import { TwilioClient } from "./twilio_api";
import { createClient } from "redis";
import {
  CustomLlmRequest,
  CustomLlmResponse,
  DateOption,
  DaysToBeProcessedEnum,
  Ilogs,
} from "./types";
import { IContact, RetellRequest, callstatusenum, jobstatus } from "./types";
import * as Papa from "papaparse";
import fs from "fs";
import multer from "multer";
import moment from "moment-timezone";
import { chloeDemoLlmClient } from "./VA-GROUP-LLM/chloe_llm_openai";
import { ethanDemoLlmClient } from "./VA-GROUP-LLM/ethan_llm_openai";
import { danielDemoLlmClient } from "./VA-GROUP-LLM/daniel_llm-openai";
import schedule from "node-schedule";
import path from "path";
import SmeeClient from "smee-client";
import { DailyStatsModel } from "./contacts/call_log";
import { logsToCsv } from "./LOGS-FUCNTION/logsToCsv";
import { statsToCsv } from "./LOGS-FUCNTION/statsToCsv";
import { scheduleCronJob } from "./Schedule-Fuctions/scheduleJob";
import OpenAI from "openai";
import { testDemoLlmClient } from "./TEST-LLM/llm_openai_func_call";
import { reviewTranscript } from "./helper-fuction/transcript-review";
import jwt from "jsonwebtoken";
import { unknownagent } from "./TVAG-LLM/unknowagent";
import { redisClient, redisConnection } from "./utils/redis";
import { userModel } from "./users/userModel";
import authmiddleware from "./middleware/protect";
import { isAdmin } from "./middleware/isAdmin";
import mongoose from "mongoose";

connectDb();
const smee = new SmeeClient({
  source: "https://smee.io/gRkyib7zF2UwwFV",
  target: "https://intuitiveagents.io/webhook",
  logger: console,
});
smee.start();
redisConnection();

export class Server {
  public app: expressWs.Application;
  private httpServer: HTTPServer;
  private retellClient: Retell;
  private twilioClient: TwilioClient;
  private client: OpenAI;
  storage = multer.diskStorage({
    destination: "public/",
    filename: function (req, file, cb) {
      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop();
      const newFilename = `${file.originalname
        .split(".")
        .slice(0, -1)
        .join(".")}_${timestamp}.${fileExtension}`;

      cb(null, newFilename);
    },
  });

  upload = multer({ storage: this.storage });
  constructor() {
    this.app = expressWs(express()).app;
    this.app.use(express.json());
    this.app.use(
      cors({
        origin: "*",
      }),
    );
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, "public")));
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_APIKEY,
    });

    this.getFullStat();
    this.handleRetellLlmWebSocket();
    this.getAllDbTags();
    this.handleContactSaving();
    this.handlecontactDelete();
    this.handlecontactGet();
    this.createPhoneCall();
    this.handleContactUpdate();
    this.uploadcsvToDb();
    this.schedulemycall();
    this.getjobstatus();
    this.resetAgentStatus();
    this.getCallLogs();
    this.stopSpecificSchedule();
    this.getAllJobSchedule();
    this.getAllJob();
    this.stopSpecificJob();
    this.deleteAll();
    this.logsToCsv();
    this.statsForAgent();
    this.peopleStatsLog();
    this.peopleStatToCsv();
    this.createPhoneCall2();
    this.searchForUser();
    this.getTranscriptAfterCallEnded();
    this.searchForvagroup();
    this.batchDeleteUser();
    this.getNotCalledUsersAndDelete();
    this.signUpUser();
    this.loginAdmin();
    this.loginUser();
    this.returnContactsFromStats();
    this.testingMake();
    this.testingCalendly();
    this.syncStatWithMake()
    // this.script()

    this.retellClient = new Retell({
      apiKey: process.env.RETELL_API_KEY,
    });

    this.twilioClient = new TwilioClient(this.retellClient);
    this.twilioClient.ListenTwilioVoiceWebhook(this.app);
  }
  listen(port: number): void {
    this.app.listen(port);
    console.log("Listening on " + port);
  }
  handleRetellLlmWebSocket() {
    this.app.ws(
      "/llm-websocket/:call_id",
      async (ws: WebSocket, req: Request) => {
        const callId = req.params.call_id;
        const user = await contactModel.findOne({ callId });
        const config: CustomLlmResponse = {
          response_type: "config",
          config: {
            auto_reconnect: true,
            call_details: true,
          },
        };
        ws.send(JSON.stringify(config));
        if (user.agentId === "214e92da684138edf44368d371da764c") {
          console.log("Call started with ethan/ olivia");
          const client = new ethanDemoLlmClient();
          client.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            console.error("Closing llm ws for: ", callId);
          });
          ws.on("message", async (data: RawData, isBinary: boolean) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: "on call" },
            );
            if (isBinary) {
              console.error("Got binary message instead of text in websocket.");
              ws.close(1002, "Cannot find corresponding Retell LLM.");
            }
            const request: CustomLlmRequest = JSON.parse(data.toString());
            // There are 5 types of interaction_type: call_details, pingpong, update_only, response_required, and reminder_required.
            // Not all of them need to be handled, only response_required and reminder_required.
            if (request.interaction_type === "ping_pong") {
              let pingpongResponse: CustomLlmResponse = {
                response_type: "ping_pong",
                timestamp: request.timestamp,
              };
              ws.send(JSON.stringify(pingpongResponse));
            } else if (request.interaction_type === "call_details") {
              // print call detailes
            } else if (request.interaction_type === "update_only") {
              // process live transcript update if needed
            } else if (
              request.interaction_type === "reminder_required" ||
              request.interaction_type === "response_required"
            ) {
              client.DraftResponse(request, ws);
            }
          });
        }

        if (user.agentId === "0411eeeb12d17a340941e91a98a766d0") {
          console.log("Call started with chloe");
          const client = new chloeDemoLlmClient();
          client.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            console.error("Closing llm ws for: ", callId);
          });
          ws.on("message", async (data: RawData, isBinary: boolean) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: "on call" },
            );
            if (isBinary) {
              console.error("Got binary message instead of text in websocket.");
              ws.close(1002, "Cannot find corresponding Retell LLM.");
            }
            const request: CustomLlmRequest = JSON.parse(data.toString());
            // There are 5 types of interaction_type: call_details, pingpong, update_only, response_required, and reminder_required.
            // Not all of them need to be handled, only response_required and reminder_required.
            if (request.interaction_type === "ping_pong") {
              let pingpongResponse: CustomLlmResponse = {
                response_type: "ping_pong",
                timestamp: request.timestamp,
              };
              ws.send(JSON.stringify(pingpongResponse));
            } else if (request.interaction_type === "call_details") {
              // print call detailes
            } else if (request.interaction_type === "update_only") {
              // process live transcript update if needed
            } else if (
              request.interaction_type === "reminder_required" ||
              request.interaction_type === "response_required"
            ) {
              client.DraftResponse(request, ws);
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
            console.error("Closing llm ws for: ", callId);
          });
          ws.on("message", async (data: RawData, isBinary: boolean) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: "on call" },
            );

            if (isBinary) {
              console.error("Got binary message instead of text in websocket.");
              ws.close(1002, "Cannot find corresponding Retell LLM.");
            }
            const request: CustomLlmRequest = JSON.parse(data.toString());
            // There are 5 types of interaction_type: call_details, pingpong, update_only, response_required, and reminder_required.
            // Not all of them need to be handled, only response_required and reminder_required.
            if (request.interaction_type === "ping_pong") {
              let pingpongResponse: CustomLlmResponse = {
                response_type: "ping_pong",
                timestamp: request.timestamp,
              };
              ws.send(JSON.stringify(pingpongResponse));
            } else if (request.interaction_type === "call_details") {
              // print call detailes
            } else if (request.interaction_type === "update_only") {
              // process live transcript update if needed
            } else if (
              request.interaction_type === "reminder_required" ||
              request.interaction_type === "response_required"
            ) {
              client.DraftResponse(request, ws);
            }
          });
        }

        if (user.agentId === "40878d8bd2d1a6fea9756ae2368bab6e") {
          console.log("Call started with kathrine");
          const client = new danielDemoLlmClient();
          client.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            console.error("Closing llm ws for: ", callId);
          });
          ws.on("message", async (data: RawData, isBinary: boolean) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: "on call" },
            );

            if (isBinary) {
              console.error("Got binary message instead of text in websocket.");
              ws.close(1002, "Cannot find corresponding Retell LLM.");
            }
            const request: CustomLlmRequest = JSON.parse(data.toString());
            // There are 5 types of interaction_type: call_details, pingpong, update_only, response_required, and reminder_required.
            // Not all of them need to be handled, only response_required and reminder_required.
            if (request.interaction_type === "ping_pong") {
              let pingpongResponse: CustomLlmResponse = {
                response_type: "ping_pong",
                timestamp: request.timestamp,
              };
              ws.send(JSON.stringify(pingpongResponse));
            } else if (request.interaction_type === "call_details") {
              // print call detailes
            } else if (request.interaction_type === "update_only") {
              // process live transcript update if needed
            } else if (
              request.interaction_type === "reminder_required" ||
              request.interaction_type === "response_required"
            ) {
              client.DraftResponse(request, ws);
            }
          });
        }

        if (user.agentId === "1000") {
          console.log("Call started with new agent");
          const client = new unknownagent();
          client.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            console.error("Closing llm ws for: ", callId);
          });
          ws.on("message", async (data: RawData, isBinary: boolean) => {
            await contactModel.findOneAndUpdate(
              { callId },
              { status: "on call" },
            );
            if (isBinary) {
              console.error("Got binary message instead of text in websocket.");
              ws.close(1002, "Cannot find corresponding Retell LLM.");
            }
            const request: CustomLlmRequest = JSON.parse(data.toString());
            // There are 5 types of interaction_type: call_details, pingpong, update_only, response_required, and reminder_required.
            // Not all of them need to be handled, only response_required and reminder_required.
            if (request.interaction_type === "ping_pong") {
              let pingpongResponse: CustomLlmResponse = {
                response_type: "ping_pong",
                timestamp: request.timestamp,
              };
              ws.send(JSON.stringify(pingpongResponse));
            } else if (request.interaction_type === "call_details") {
              // print call detailes
            } else if (request.interaction_type === "update_only") {
              // process live transcript update if needed
            } else if (
              request.interaction_type === "reminder_required" ||
              request.interaction_type === "response_required"
            ) {
              client.DraftResponse(request, ws);
            }
          });
        }
      },
    );
  }
  createPhoneCall2() {
    this.app.post(
      "/create-llm-phone-call",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        const { fromNumber, toNumber, userId, agentId } = req.body;
        const result = await contactModel.findById(userId);
        console.log(fromNumber, toNumber, userId, agentId);
        try {
          const callRegister = await this.retellClient.call.register({
            agent_id: agentId,
            audio_encoding: "s16le",
            audio_websocket_protocol: "twilio",
            sample_rate: 24000,
            end_call_after_silence_ms: 15000,
          });
          const registerCallResponse2 = await this.retellClient.call.create({
            from_number: fromNumber,
            to_number: toNumber,
            override_agent_id: agentId,
            drop_call_if_machine_detected: true,
            retell_llm_dynamic_variables: {
              firstname: result.firstname,
              email: result.email,
            },
          });
          await contactModel.findByIdAndUpdate(userId, {
            callId: registerCallResponse2.call_id,
          });
          res.send({ callCreation: registerCallResponse2, callRegister });
        } catch (error) {
          console.log("This is the error:", error);
        }
      },
    );
  }
  handleContactSaving() {
    this.app.post(
      "/users/create",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        const {
          firstname,
          lastname,
          email,
          phone,
          agentId,
          tag,
          dayToBeProcessed,
        } = req.body;

        const lowerCaseTags = typeof tag === "string" ? tag.toLowerCase() : "";
        try {
          const result = await createContact(
            firstname,
            lastname,
            email,
            phone,
            agentId,
            lowerCaseTags,
            dayToBeProcessed,
          );
          res.json({ result });
        } catch (error) {
          console.log(error);
        }
      },
    );
  }

  handlecontactGet() {
    this.app.post("/users/:agentId", async (req: Request, res: Response) => {
      const agentId = req.params.agentId;
      const { page, limit, dateOption } = req.body;
      const newPage = parseInt(page);
      const newLimit = parseInt(limit);

      // Validate dateOption
      let validDateOption: DateOption;

      // Validate dateOption
      if (dateOption) {
        if (!Object.values(DateOption).includes(dateOption)) {
          return res.status(400).json({ error: "Invalid date option" });
        }
        validDateOption = dateOption as DateOption;
      } else {
        validDateOption = DateOption.LAST_SCHEDULE;
      }

      try {
        const result = await getAllContact(
          agentId,
          newPage,
          newLimit,
          validDateOption,
        );
        res.json({ result });
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
  }
  handlecontactDelete() {
    this.app.patch(
      "/users/delete",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        const { id } = req.body;
        try {
          const result = await deleteOneContact(id);
          res.json({ result });
        } catch (error) {
          console.log(error);
        }
      },
    );
  }
  handleContactUpdate() {
    this.app.patch(
      "/users/update",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
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
      },
    );
  }
  createPhoneCall() {
    this.app.post(
      "/create-phone-call/:agentId",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        const { fromNumber, toNumber, userId } = req.body;
        const agentId = req.params.agentId;
        if (!agentId || !fromNumber || !toNumber || !userId) {
          return res.json({ status: "error", message: "Invalid request" });
        }
        function formatPhoneNumber(phoneNumber: string) {
          // Remove any existing "+" and non-numeric characters
          let digitsOnly = phoneNumber.replace(/[^0-9]/g, "");

          // Check if the phone number starts with "1" (after the "+" is removed)
          if (phoneNumber.startsWith("+1")) {
            return `+${digitsOnly}`;
          }

          // Add "+1" prefix if it doesn't already start with "1"
          return `+1${digitsOnly}`;
        }
        const newToNumber = formatPhoneNumber(toNumber);
        try {
          await this.twilioClient.RegisterPhoneAgent(
            fromNumber,
            agentId,
            userId,
          );
          const result = await this.twilioClient.CreatePhoneCall(
            fromNumber,
            newToNumber,
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
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
          }

          const csvFile = req.file;
          const day = req.query.day;
          const tag = req.query.tag;
          const lowerCaseTag = typeof tag === "string" ? tag.toLowerCase() : "";
          const csvData = fs.readFileSync(csvFile.path, "utf8");

          Papa.parse(csvData, {
            header: true,
            complete: async (results) => {
              const jsonArrayObj: IContact[] = results.data as IContact[];
              const agentId = req.params.agentId;
              let uploadedNumber = 0;
              let duplicateCount = 0;
              const failedUsers: {
                email?: string;
                firstname?: string;
                phone?: string;
              }[] = [];
              const successfulUsers: {
                email: string;
                firstname: string;
                phone: string;
              }[] = [];

              function formatPhoneNumber(phoneNumber: string) {
                let digitsOnly = phoneNumber.replace(/[^0-9]/g, "");

                if (phoneNumber.startsWith("+1")) {
                  return `+${digitsOnly}`;
                }
                return `+1${digitsOnly}`;
              }

              // Extract emails and agentId for batch checking
              const emailsAndAgentIds = jsonArrayObj.map((user) => ({
                email: user.email,
                agentId: agentId,
              }));

              // Check existing users in batch
              const existingUsers = await contactModel
                .find({
                  $or: emailsAndAgentIds,
                })
                .select("email agentId")
                .session(session);

              const existingUsersSet = new Set(
                existingUsers.map((user) => `${user.email}-${user.agentId}`),
              );

              for (const user of jsonArrayObj) {
                if (user.firstname && user.phone && user.email) {
                  const userKey = `${user.email}-${agentId}`;
                  if (!existingUsersSet.has(userKey)) {
                    const userWithAgentId = {
                      ...user,
                      phone: formatPhoneNumber(user.phone),
                      dayToBeProcessed: day,
                      agentId,
                      tag: lowerCaseTag,
                    };
                    successfulUsers.push(userWithAgentId);
                    uploadedNumber++;
                  } else {
                    duplicateCount++;
                  }
                } else {
                  failedUsers.push({
                    email: user.email || undefined,
                    firstname: user.firstname || undefined,
                    phone: user.phone || undefined,
                  });
                }
              }

              if (successfulUsers.length > 0) {
                await contactModel.insertMany(successfulUsers, { session });
              }

              await session.commitTransaction();
              session.endSession();

              res.status(200).json({
                message: `Upload successful, contacts uploaded: ${uploadedNumber}, duplicates found: ${duplicateCount}`,
                failedUsers: failedUsers.filter(
                  (user) => user.email || user.firstname || user.phone,
                ), // Remove empty objects
              });
            },
            error: async (err: Error) => {
              console.error("Error parsing CSV:", err);
              await session.abortTransaction();
              session.endSession();
              res.status(500).json({ message: "Failed to parse CSV data" });
            },
          });
        } catch (err) {
          console.error("Error:", err);
          await session.abortTransaction();
          session.endSession();
          res
            .status(500)
            .json({ message: "Failed to upload CSV data to database" });
        }
      },
    );
  }

  getjobstatus() {
    this.app.post(
      "/schedules/status",
      authmiddleware,
      async (req: Request, res: Response) => {
        const { jobId } = req.body;
        const result = await jobModel.findOne({ jobId });
        res.json({ result });
      },
    );
  }
  getAllJobSchedule() {
    this.app.get(
      "/schedules/get",
      authmiddleware,
      async (req: Request, res: Response) => {
        const result = await jobModel.find().sort({ createdAt: "desc" });
        res.json({ result });
      },
    );
  }
  resetAgentStatus() {
    this.app.post(
      "/users/status/reset",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        const { agentId } = req.body;
        const result = await contactModel.updateMany(
          { agentId },
          { status: "not called", answeredByVM: false },
        );
        res.json({ result });
      },
    );
  }
  schedulemycall() {
    this.app.post(
      "/schedule",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        const { hour, minute, agentId, limit, fromNumber, tag } = req.body;

        const scheduledTimePST = moment
          .tz("America/Los_Angeles")
          .set({
            hour,
            minute,
            second: 0,
            millisecond: 0,
          })
          .toDate();
        const formattedDate = moment(scheduledTimePST).format(
          "YYYY-MM-DDTHH:mm:ss",
        );
        if (!tag) {
          return res.send("Please provide a tag");
        }

        const lowerCaseTag = tag.toLowerCase();
        const { jobId, scheduledTime, contacts } = await scheduleCronJob(
          scheduledTimePST,
          agentId,
          limit,
          fromNumber,
          formattedDate,
          lowerCaseTag,
        );
        res.send({ jobId, scheduledTime, contacts });
      },
    );
  }
  stopSpecificJob() {
    this.app.post(
      "/stop-job",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        try {
          const { jobId } = req.body;
          if (!jobId) {
            console.log("No jobId provided.");
            return res.status(400).send("No jobId provided.");
          }
          const job = await jobModel.findOneAndUpdate(
            { jobId },
            {
              shouldContinueProcessing: false,
              callstatus: jobstatus.CANCELLED,
            },
          );

          if (!job) {
            console.log("No job found with the provided jobId:", jobId);
            return res
              .status(404)
              .send("No job found with the provided jobId.");
          }
          console.log(`Processing stopped for job ${jobId}.`);
          return res.send("Processing stopped for job.");
        } catch (error: any) {
          console.error("Error stopping job:", error);
          return res
            .status(500)
            .send("Error stopping job: " + (error.message || error));
        }
      },
    );
  }
  stopSpecificSchedule() {
    this.app.post(
      "/cancel-schedule",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
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
            {
              callstatus: jobstatus.CANCELLED,
              shouldContinueProcessing: false,
            },
          );
          res.send(`Job with ID ${jobId} cancelled successfully.`);
        } else {
          res.status(500).send(`Failed to cancel job with ID ${jobId}.`);
        }
      },
    );
  }

  getAllJob() {
    this.app.get(
      "/get-jobs",
      authmiddleware,
      async (req: Request, res: Response) => {
        const scheduledJobs = schedule.scheduledJobs;
        let responseString = "";
        for (const jobId in scheduledJobs) {
          if (scheduledJobs.hasOwnProperty(jobId)) {
            const job = scheduledJobs[jobId];
            responseString += `Job ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}\n`;
          }
        }
        res.send({ responseString });
      },
    );
  }

  getCallLogs() {
    this.app.post(
      "/call-logs",
      authmiddleware,
      async (req: Request, res: Response) => {
        const { agentId } = req.body;
        const result = await jobModel.find({ agentId });
        res.json({ result });
      },
    );
  }

  async getTranscriptAfterCallEnded() {
    this.app.post("/webhook", async (request: Request, response: Response) => {
      const payload = request.body;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split("T")[0];
      const webhookRedisKey = `${payload.event}_${payload.data.call_id}`;
      const lockTTL = 300;
      const lockAcquired = await redisClient.set(webhookRedisKey, "locked", {
        NX: true,
        PX: lockTTL,
      });
      if (!lockAcquired) {
        return;
      }
      try {
        if (payload.event === "call_started") {
          console.log(`call started for: ${payload.data.call_id}`);
          await this.handleCallStarted(payload.data);
        } else if (
          payload.event === "call_ended" ||
          payload.event === "call_analyzed"
        ) {
          await this.handleCallEndedOrAnalyzed(payload, todayString);
          await redisClient.del(webhookRedisKey);
        }
      } catch (error) {
        console.log(error);
      }
    });
  }

  async handleCallStarted(data: any) {
    const { call_id, agent_id } = data;
    await contactModel.findOneAndUpdate(
      { callId: call_id, agentId: agent_id },
      { status: callstatusenum.IN_PROGRESS },
    );
  }

  async handleCallEndedOrAnalyzed(payload: any, todayString: any) {
    const {
      call_id,
      transcript,
      recording_url,
      agent_id,
      disconnection_reason,
      call_analysis,
    } = payload.data;
    const analyzedTranscript = await reviewTranscript(transcript);
    const isCallFailed = disconnection_reason === "dial_failed";
    const isCallTransferred = disconnection_reason === "call_transfer";
    const isMachine = call_analysis && call_analysis.in_voicemail == true;
    const isDialNoAnswer = disconnection_reason === "dial_no_answer";
    const updateData = {
      callId: call_id,
      recordingUrl: recording_url,
      transcript: transcript,
      disconnectionReason: disconnection_reason,
      analyzedTranscript: analyzedTranscript.message.content,
      ...(call_analysis && {
        retellCallSummary: call_analysis.call_summary,
        userSentiment: call_analysis.user_sentiment,
        agentSemtiment: call_analysis.agent_sentiment,
      }),
    };

    const results = await EventModel.create(updateData);

    let callStatus;
    let statsUpdate: any = {
      $inc: {
        totalCalls: 1,
      },
    };

    if (isMachine) {
      statsUpdate.$inc.totalAnsweredByVm = 1;
      callStatus = callstatusenum.VOICEMAIL;
    } else if (isCallFailed) {
      statsUpdate.$inc.totalFailed = 1;
      callStatus = callstatusenum.FAILED;
    } else if (isCallTransferred) {
      statsUpdate.$inc.totalTransferred = 1;
      callStatus = callstatusenum.TRANSFERRED;
    } else if (analyzedTranscript.message.content === "Scheduled") {
      statsUpdate.$inc.totalAppointment = 1;
      callStatus = callstatusenum.SCHEDULED;
    } else if (isDialNoAnswer) {
      callStatus = "dial_no_answer";
    } else {
      callStatus = callstatusenum.CALLED;
    }

    const statsResults = await DailyStatsModel.findOneAndUpdate(
      { day: todayString, agentId: agent_id },
      statsUpdate,
      { upsert: true, returnOriginal: false },
    );

    const linkToCallLogModelId = statsResults ? statsResults._id : null;
    await contactModel.findOneAndUpdate(
      { callId: call_id },
      {
        status: callStatus,
        $push: { datesCalled: todayString },
        referenceToCallId: results._id,
        linktocallLogModel: linkToCallLogModelId,
      },
    );
  }

  deleteAll() {
    this.app.patch(
      "/deleteAll",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        const { agentId } = req.body;
        const result = await contactModel.updateMany(
          { agentId },
          { isDeleted: true },
        );
        res.send(result);
      },
    );
  }

  logsToCsv() {
    this.app.post(
      "/call-logs-csv",
      authmiddleware,
      async (req: Request, res: Response) => {
        try {
          const {
            agentId,
            startDate,
            endDate,
            limit,
            statusOption,
            sentimentOption,
          } = req.body;
          const newlimit = parseInt(limit);
          const result = await logsToCsv(
            agentId,
            newlimit,
            startDate,
            endDate,
            statusOption,
            sentimentOption,
          );
          if (typeof result === "string") {
            const filePath: string = result;
            if (fs.existsSync(filePath)) {
              res.setHeader(
                "Content-Disposition",
                "attachment; filename=logs.csv",
              );
              res.setHeader("Content-Type", "text/csv");
              const fileStream = fs.createReadStream(filePath);
              fileStream.pipe(res);
            } else {
              console.error("CSV file does not exist");
              res.status(404).send("CSV file not found");
            }
          } else {
            console.error(`Error retrieving contacts: ${result}`);
            res.status(500).send(`Error retrieving contacts: ${result}`);
          }
        } catch (error) {
          console.error(`Error retrieving contacts: ${error}`);
          res.status(500).send(`Error retrieving contacts: ${error}`);
        }
      },
    );
  }

  statsForAgent() {
    this.app.post(
      "/get-stats",
      authmiddleware,
      async (req: Request, res: Response) => {
        try {
          const { startDate, endDate, agentIds } = req.body;
          if (!startDate || !endDate) {
            throw new Error("Date is missing in the request body");
          }
          const totalCallsTransffered = await contactModel.aggregate([
            {
              $match: {
                agentId: { $in: agentIds },
                isDeleted: { $ne: true },
                datesCalled: { $gte: startDate, $lte: endDate },
              },
            },
            {
              $lookup: {
                from: "transcripts",
                localField: "referenceToCallId",
                foreignField: "_id",
                as: "callDetails",
              },
            },
            {
              $match: {
                "callDetails.disconnectionReason": "call_transfer",
              },
            },
            {
              $count: "result",
            },
          ]);
          const totalAppointment = await contactModel.aggregate([
            {
              $match: {
                agentId: { $in: agentIds },
                isDeleted: { $ne: true },
                datesCalled: { $gte: startDate, $lte: endDate },
              },
            },
            {
              $lookup: {
                from: "transcripts",
                localField: "referenceToCallId",
                foreignField: "_id",
                as: "callDetails",
              },
            },
            {
              $match: {
                "callDetails.analyzedTranscript": "Scheduled",
              },
            },
            {
              $count: "result",
            },
          ]);
          const totalNotCalledForAgents = await contactModel.countDocuments({
            agentId: { $in: agentIds },
            isDeleted: false,
            status: callstatusenum.NOT_CALLED,
          });
          const totalAnsweredByVm = await contactModel.countDocuments({
            agentId: { $in: agentIds },
            isDeleted: false,
            datesCalled: { $gte: startDate, $lte: endDate },
            status: callstatusenum.VOICEMAIL,
          });
          const TotalCalls = await contactModel.countDocuments({
            agentId: { $in: agentIds },
            isDeleted: false,
            datesCalled: { $gte: startDate, $lte: endDate },
            status: {
              $in: [
                callstatusenum.CALLED,
                callstatusenum.VOICEMAIL,
                callstatusenum.FAILED,
              ],
            },
          });
          const TotalAnsweredCall = await contactModel.countDocuments({
            agentId: { $in: agentIds },
            isDeleted: false,
            status: callstatusenum.CALLED,
            datesCalled: { $gte: startDate, $lte: endDate },
          });
          const totalContactForAgents = await contactModel.countDocuments({
            agentId: { $in: agentIds },
            isDeleted: false,
          });
          res.send({
            TotalAnsweredCall,
            TotalCalls,
            totalCallsTransffered:
              totalCallsTransffered.length > 0
                ? totalCallsTransffered[0].result
                : 0,
            totalAppointment:
              totalAppointment.length > 0 ? totalAppointment[0].result : 0,
            totalNotCalledForAgents,
            totalAnsweredByVm,
            totalContactForAgents,
          });
        } catch (error) {
          console.error("Error fetching daily stats:", error);
          res.status(500).json({ message: "Internal server error" });
        }
      },
    );
  }

  peopleStatsLog() {
    this.app.post(
      "/get-metadata",
      authmiddleware,
      async (req: Request, res: Response) => {
        try {
          const { startDate, endDate, limit, page } = req.body;
          const newLimit = parseInt(limit);
          const newPage = parseInt(page);
          const agentIds = [
            "214e92da684138edf44368d371da764c",
            "0411eeeb12d17a340941e91a98a766d0",
            "86f0db493888f1da69b7d46bfaecd360",
          ];

          const skip = (newPage - 1) * newLimit;

          // Constructing the query for the date range
          const dailyStats = await contactModel
            .find({
              $and: [
                { agentId: { $in: agentIds } },
                { isDeleted: false },
                {
                  $and: [
                    {
                      datesCalled: { $gte: startDate },
                    },
                    {
                      // Check if any date in the array is less than or equal to the end date
                      datesCalled: { $lte: endDate },
                    },
                  ],
                },
              ],
            })
            .populate("referenceToCallId")
            .limit(newLimit)
            .skip(skip);

          const totalCount = await contactModel.countDocuments({
            $and: [
              { agentId: { $in: agentIds } },
              { isDeleted: false },
              {
                $and: [
                  {
                    datesCalled: { $gte: startDate },
                  },
                  {
                    // Check if any date in the array is less than or equal to the end date
                    datesCalled: { $lte: endDate },
                  },
                ],
              },
            ],
          });

          const totalPages = Math.ceil(totalCount / newLimit);
          res.json({ totalCount, totalPages, dailyStats });
        } catch (error) {
          console.log(error);
          res.status(500).json({ error: "Internal Server Error" });
        }
      },
    );
  }

  peopleStatToCsv() {
    this.app.post("/get-metadata-csv", authmiddleware, async (req, res) => {
      try {
        const { startDate, endDate, agentIds } = req.body;
        const result = await statsToCsv(startDate, endDate, agentIds);
        if (typeof result === "string") {
          const filePath: string = result;
          if (fs.existsSync(filePath)) {
            res.setHeader(
              "Content-Disposition",
              "attachment; filename=logs.csv",
            );
            res.setHeader("Content-Type", "text/csv");
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
          } else {
            console.error("CSV file does not exist");
            res.status(404).send("CSV file not found");
          }
        } else {
          console.error(`Error retrieving contacts: ${result}`);
          res.status(500).send(`Error retrieving contacts: ${result}`);
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
  searchForvagroup() {
    this.app.post(
      "/search-logs",
      authmiddleware,
      async (req: Request, res: Response) => {
        const { searchTerm, agentIds } = req.body;
        if (!searchTerm || !agentIds) {
          return res
            .status(400)
            .json({ error: "Search term or agent ids is required" });
        }
        const isValidEmail = (email: string) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email);
        };

        try {
          const searchTerms = searchTerm
            .split(",")
            .map((term: string) => term.trim());
          const firstTermIsEmail = isValidEmail(searchTerms[0]);

          const searchForTerm = async (
            term: string,
            searchByEmail: boolean,
          ) => {
            const query = {
              agentId: { $in: agentIds },
              isDeleted: false,
              $or: searchByEmail
                ? [{ email: { $regex: term, $options: "i" } }]
                : [
                    { firstname: { $regex: term, $options: "i" } },
                    { lastname: { $regex: term, $options: "i" } },
                    { phone: { $regex: term, $options: "i" } },
                    { email: { $regex: term, $options: "i" } },
                  ],
            };
            console.log(query);
            return await contactModel.find(query).populate("referenceToCallId");
          };

          let allResults: any[] = [];

          for (const term of searchTerms) {
            const results = await searchForTerm(term, firstTermIsEmail);
            allResults = allResults.concat(results);
          }

          res.json(allResults);
        } catch (error) {
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );
  }

  searchForUser() {
    this.app.post("/search", async (req: Request, res: Response) => {
      const {
        searchTerm = "",
        startDate,
        endDate,
        statusOption,
        sentimentOption,
        agentId,
        tag,
      } = req.body;

      if (!agentId) {
        return res
          .status(400)
          .json({ error: "Search term or agent Ids is required" });
      }

      try {
        const isValidEmail = (email: string) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email.trim());
        };
        const searchTerms = searchTerm
          .split(",")
          .map((term: string) => term.trim());
        const firstTermIsEmail = isValidEmail(searchTerms[0]);

        const searchForTerm = async (term: string, searchByEmail: boolean) => {
          const query: any = {
            agentId,
            isDeleted: false,
            $or: searchByEmail
              ? [{ email: { $regex: term, $options: "i" } }]
              : [
                  { firstname: { $regex: term, $options: "i" } },
                  { lastname: { $regex: term, $options: "i" } },
                  { phone: { $regex: term, $options: "i" } },
                  { email: { $regex: term, $options: "i" } },
                ],
          };

          const formatDateToDB = (dateString: any) => {
            const date = new Date(dateString);
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, "0"); // Months are 0-based
            const day = String(date.getUTCDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
          };

          if (startDate || endDate) {
            query["datesCalled"] = {};
            if (startDate) {
              query["datesCalled"]["$gte"] = formatDateToDB(startDate);
            }
            if (endDate) {
              query["datesCalled"]["$lte"] = formatDateToDB(endDate);
            }
          }

          if (tag) {
            query["tag"] = tag;
          }

          if (statusOption && statusOption !== "All") {
            let callStatus;

            if (statusOption === "call-transferred") {
              const pipeline: any[] = [
                {
                  $match: {
                    agentId,
                    isDeleted: { $ne: true },
                  },
                },
                {
                  $lookup: {
                    from: "transcripts",
                    localField: "referenceToCallId",
                    foreignField: "_id",
                    as: "callDetails",
                  },
                },
                {
                  $match: {
                    "callDetails.disconnectionReason": "call_transfer",
                  },
                },
              ];

              if (startDate && endDate) {
                pipeline.push({
                  $match: {
                    datesCalled: {
                      $gte: startDate,
                      $lte: endDate,
                    },
                  },
                });
              }

              const totalCallsTransferred = await contactModel.aggregate(
                pipeline,
              );

              return totalCallsTransferred;
            } else {
              // Handle other status options
              switch (statusOption.toLowerCase()) {
                case "call-connected":
                  callStatus = callstatusenum.CALLED;
                  break;
                case "not-called":
                  callStatus = callstatusenum.NOT_CALLED;
                  break;
                case "called-na-vm":
                  callStatus = callstatusenum.VOICEMAIL;
                  break;
                case "call-failed":
                  callStatus = callstatusenum.FAILED;
                  break;
                default:
                  // Return empty array if statusOption doesn't match any known options
                  return [];
              }

              query["status"] = callStatus;
            }
          }

          return await contactModel.find(query).populate("referenceToCallId");
        };

        let allResults: any[] = [];

        for (const term of searchTerms) {
          const results = await searchForTerm(term, firstTermIsEmail);
          allResults = allResults.concat(results);
        }
        let sentimentStatus:
          | "Uninterested"
          | "Call back"
          | "Interested"
          | "Scheduled"
          | "Voicemail"
          | "Incomplete call"
          | undefined;

        if (
          sentimentOption === "Uninterested" ||
          sentimentOption === "uninterested"
        ) {
          sentimentStatus = "Uninterested";
        } else if (
          sentimentOption === "Interested" ||
          sentimentOption === "interested"
        ) {
          sentimentStatus = "Interested";
        } else if (
          sentimentOption === "Scheduled" ||
          sentimentOption === "scheduled"
        ) {
          sentimentStatus = "Scheduled";
        } else if (
          sentimentOption === "Voicemail" ||
          sentimentOption === "voicemail"
        ) {
          sentimentStatus = "Voicemail";
        } else if (
          sentimentOption === "incomplete-call" ||
          sentimentOption === "Incomplete-Call"
        ) {
          sentimentStatus = "Incomplete call";
        } else if (
          sentimentOption === "call-back" ||
          sentimentOption === "Call-Back"
        ) {
          sentimentStatus = "Call back";
        }

        if (!sentimentOption) {
          res.json(allResults);
        } else {
          const filteredResults = allResults.filter((contact) => {
            const analyzedTranscript =
              contact.referenceToCallId?.analyzedTranscript;
            return analyzedTranscript && analyzedTranscript === sentimentStatus;
          });
          res.json(filteredResults);
        }
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }

  batchDeleteUser() {
    this.app.post(
      "/batch-delete-users",
      authmiddleware,
      async (req: Request, res: Response) => {
        const { contactsToDelete } = req.body;

        if (
          !contactsToDelete ||
          !Array.isArray(contactsToDelete) ||
          contactsToDelete.length === 0
        ) {
          return res.status(400).json({
            error: "Invalid input. An array of contact IDs is required.",
          });
        }

        try {
          const result = await contactModel.updateMany(
            { _id: { $in: contactsToDelete } },
            { $set: { isDeleted: true } },
          );

          if (result.modifiedCount === 0) {
            return res
              .status(200)
              .json({ message: "No contacts found to update." });
          }

          res.json({ message: "Contacts sucefully deleted.", result });
        } catch (error) {
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );
  }
  getNotCalledUsersAndDelete() {
    this.app.post(
      "/delete-uncalled",
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        try {
          const { agentId } = req.body;
          if (!agentId) {
            throw new Error("Please provide an agent ID");
          }
          const result = await contactModel.updateMany(
            { agentId, status: "not called" },
            { isDeleted: true },
          );
          res.json({
            message: "Deleted All contacts that are not called",
            result,
          });
        } catch (error) {
          console.log(error);
        }
      },
    );
  }
  loginUser() {
    this.app.post("/user/login", async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        if (!username || !password) {
          return res.status(400).json({ message: "Provide the login details" });
        }

        const userInDb = await userModel.findOne({ username });
        if (!userInDb) {
          return res.status(400).json({ message: "Invalid login credentials" });
        }
        const verifyPassword = await argon2.verify(
          userInDb.passwordHash,
          password,
        );
        if (!verifyPassword) {
          return res.status(400).json({ message: "Incorrect password" });
        }
        const token = jwt.sign(
          { userId: userInDb._id, isAdmin: userInDb.isAdmin },
          process.env.JWT_SECRET,
          { expiresIn: "1d" },
        );
        res.json({
          payload: {
            message: "Logged in succefully",
            token,
            username: userInDb.username,
            userId: userInDb._id,
            group: userInDb.group,
          },
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error happened during login" });
      }
    });
  }

  loginAdmin() {
    this.app.post("/admin/login", async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        if (!username || !password) {
          return res.status(400).json({ message: "Provide the login details" });
        }
        const userInDb = await userModel.findOne({ username });
        if (!userInDb) {
          return res.status(400).json({ message: "Invalid login credentials" });
        }
        const verifyPassword = await argon2.verify(
          userInDb.passwordHash,
          password,
        );
        if (!verifyPassword) {
          return res.status(400).json({ message: "Incorrect password" });
        }
        if (userInDb.isAdmin === false) {
          return res.status(401).json("Only admins can access here");
        }
        const token = jwt.sign(
          { userId: userInDb._id, isAdmin: userInDb.isAdmin },
          process.env.JWT_SECRET,
          { expiresIn: "1d" },
        );
        return res.status(200).json({
          payload: {
            message: "Logged in succefully",
            token,
            username: userInDb.username,
            userId: userInDb._id,
            group: userInDb.group,
          },
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error happened during login" });
      }
    });
  }
  signUpUser() {
    this.app.post("/user/signup", async (req: Request, res: Response) => {
      try {
        const { username, email, password, group } = req.body;
        if (!username || !email || !password || !group) {
          return res
            .status(400)
            .json({ message: "Please provide all needed details" });
        }
        const savedUser = await userModel.create({
          username,
          email,
          password,
          group,
        });
        const token = jwt.sign(
          { userId: savedUser._id, email: savedUser.email },
          process.env.JWT_SECRET,
          { expiresIn: "6h" },
        );
        return res.json({
          payload: { message: "User created sucessfully", token },
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "error while signing up" });
      }
    });
  }

  async deleteContactsByEmail(emails: any) {
    try {
      // Split the input string containing comma-separated emails into an array
      const emailArray = emails.split(",");
      console.log(emailArray);

      // Use Mongoose's deleteMany function to remove documents with matching emails
      const result = await contactModel.deleteMany({
        email: { $in: emailArray },
      });

      console.log(`${result.deletedCount} contacts deleted.`);
      return result;
    } catch (error) {
      console.error("Error deleting contacts:", error);
      throw error; // Forwarding the error for handling in upper layers
    }
  }

  returnContactsFromStats() {
    this.app.post(
      "/user/populate",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        try {
          const { agentId, options } = req.body;
          console.log("here");
          if (!agentId) {
            return res.json({ message: "Please provide agent id" });
          }
          let result: any = {};
          if (options === "Transffered") {
            const totalCallsTransferred = await contactModel.aggregate([
              {
                $match: {
                  agentId,
                  isDeleted: { $ne: true },
                },
              },
              {
                $lookup: {
                  from: "transcripts",
                  localField: "referenceToCallId",
                  foreignField: "_id",
                  as: "referenceToCallId",
                },
              },
              {
                $match: {
                  "referenceToCallId.disconnectionReason": "call_transfer",
                },
              },
            ]);
            result.totalCallsTransferred = totalCallsTransferred;
          }

          if (options === "Appointment") {
            const totalAppointment = await contactModel.aggregate([
              {
                $match: {
                  agentId,
                  isDeleted: { $ne: true },
                },
              },
              {
                $lookup: {
                  from: "transcripts",
                  localField: "referenceToCallId",
                  foreignField: "_id",
                  as: "callDetails",
                },
              },
              {
                $match: {
                  "callDetails.analyzedTranscript": "Scheduled",
                },
              },
            ]);
            result.totalAppointment = totalAppointment;
          }

          if (options === "Not-Called") {
            const totalNotCalledForAgents = await contactModel.find({
              agentId,
              isDeleted: false,
              status: callstatusenum.NOT_CALLED,
            });
            result.totalNotCalledForAgents = totalNotCalledForAgents;
          }

          if (options === "VM") {
            const totalAnsweredByVm = await contactModel.find({
              agentId,
              isDeleted: false,
              // datesCalled: { $gte: startDate, $lte: endDate },
              status: callstatusenum.VOICEMAIL,
            });
            result.totalAnsweredByVm = totalAnsweredByVm;
          }

          if (options === "Total") {
            const totalCalls = await contactModel.find({
              agentId,
              isDeleted: false,
              // datesCalled: { $gte: startDate, $lte: endDate },
              status: {
                $in: [
                  callstatusenum.CALLED,
                  callstatusenum.VOICEMAIL,
                  callstatusenum.FAILED,
                ],
              },
            });
            result.totalCalls = totalCalls;
          }

          if (options === "Answered") {
            const totalAnsweredCall = await contactModel.find({
              agentId,
              isDeleted: false,
              status: callstatusenum.CALLED,
              // datesCalled: { $gte: startDate, $lte: endDate },
            });
            result.totalAnsweredCall = totalAnsweredCall;
          }

          if (options === "Total-Contact") {
            const totalContactForAgents = await contactModel.find({
              agentId,
              isDeleted: false,
            });
            result.totalContactForAgents = totalContactForAgents;
          }

          if (options === "Failed") {
            const callListResponse = await this.retellClient.call.list({
              query: {
                agent_id: "214e92da684138edf44368d371da764c",
                after_start_timestamp: "1718866800000",
                limit: 1000000,
              },
            });
            const countCallFailed = callListResponse.filter(
              (doc) => doc.disconnection_reason === "dial_failed",
            );
            result.countCallFailed = countCallFailed;
          }
          res.send(result);
        } catch (error) {
          res.status(500).send({ error });
        }
      },
    );
  }
  testingMake() {
    this.app.post("/make", async (req: Request, res: Response) => {
      const result = await axios.post(
        "https://hook.eu2.make.com/mnod1p5sp4fe1u5cvekmqk807tabs28e",
        {
          eventName: "",
          startDate: "",
          endDate: "",
          duration: "",
        },
      );
      console.log(result);
      res.send("done");
    });
  }

  testingCalendly() {
    this.app.post("/test-calender", async (req: Request, res: Response) => {
      // Replace with your event type and date/time
      const eventTypeSlug = "test-event-type";
      const dateTime = "2024-08-10T03:00:00+01:00";

      // Construct the scheduling link
      const schedulingLink = `https://calendly.com/hydradaboss06/${eventTypeSlug}/${dateTime}?month=2024-08&date=2024-08-10`;

      try {
        // Make a POST request to Calendly API to add invitees
        const response = await axios.post(
          "https://calendly.com/api/booking/invitees",
          {
            analytics: {
              invitee_landed_at: "2024-07-01T15:52:27.987Z",
              browser: "Chrome 126",
              device: "undefined Windows 10",
              fields_filled: 1,
              fields_presented: 1,
              booking_flow: "v3",
              seconds_to_convert: 45,
            },
            embed: {},
            event: {
              start_time: "2024-07-21T09:30:00+01:00",
              location_configuration: {
                location: "",
                phone_number: "",
                additional_info: "",
              },
              guests: {},
            },
            event_fields: [
              {
                id: 86536438,
                name: "Please share anything that will help prepare for our meeting.",
                format: "text",
                required: false,
                position: 0,
                answer_choices: null,
                include_other: false,
                value: "",
              },
            ],
            invitee: {
              timezone: "Africa/Lagos",
              time_notation: "24h",
              full_name: "Ganiyu Olamide Idris",
              email: "golamide27@tike.tz",
            },
            payment_token: {},
            recaptcha_token:
              "03AFcWeA4zspINFzCwvHId56h0v4T4cB1kpuPxBdEQGyMXD7E3s916-TFbrQCgoJkKul1-mUqgajgrHCFzaXZ23A3tCtxq9zIZ0ute14K06_rEVmPxFFObWHoTO796QZ40QTCvwaRY--AqYK7Ww8fhvDeSfc2LLaRuh4pTXfw0UBqJevTDVyH7_qD29MoaRpIotTJwrJVIHs3UpECzl4ekSHBHyZP_nJ2jJ_IXU1sPq4v-m2qJuzD8ZDDgP8VO3tXt_xpVP9Xo8Nvl4fAhhUqVuGo0xje45xCrRfsjdOyNCAxE-0-tUNdxGsQhzxZmVHZNXSv3K4DjAvoAaPtFGhq70vKexP-Xj8zdccMO_FDtoD3oN1zFIF9oK5yjSisX81B7CoUEwlBk8R6OCTICrN7kwd_oAgSvLDHFNMvZAk6ZA-RO6flsDhzOWa5WQkAjMLCe3Ne-TbJx_8H_aJy5aO20HHM-B-Jq5bVgfGXvU3ZAYYoR6rshwcfdg6BvhdDeT7m_XK9vvm7695kaS5y5QQxHaDKo5i2fbXS-EOosBNqy0cdBUDdZtDz5Exu_Mqv5ZASma0AhNsRQZik04EdkNL9rgLIHbCS8rQGnE3X4WBT70FpmJ2Ip5uRWeE0rj8Go5M3EfliI82p37e122FPsb_pkrBJmLWGiIWwPZy4Wgp80NFCbLvSbh_A4qYDHH8MBTe1-Jya76mR0XhEQI7PwxpdZAb_r3oQStmz4qdO0EpUP21Ul_1S_r3Ww2cdki29oC0SrfTGGIfWl22pi33sGaNhcJvtvpkNtqn7WhXL-umdMLlwOMH_RVwJznQzZZm1cSvc9Xl1EnBcmKqjDT0_gHvKBGQ6jIn0IS9sL1b_2EuOx8i_Bikh_MNxx8s9TlX5VFMLWgY0U7KuCIQu98liDK-6rJ0SG9SHSrurEqje-s2dYZE-44SegpFcdzZB_0QZ4PJZWvGc-R4mXfNvP0XeS55fVAFCZeThYxdzAYPJtyMTBmHIgZi-GlD5WFZq-uQQkj3IshH7ANqCMBVehQzwEQfBxIWZDyb-rTtlpzIIrscxYa750Sm0zvL3AGg9bsURtHnRb8MnECPtOqFQjYZh-W4qqSh0uGXKHttMN1xkxCBbSMW_NpPI4V_IXe50YdEhqXbJd8XlpAJe0IkRZban2_9UFeS7mldZzUfuyQ0Y9Uxo0msRl_DcMFRD3HCLUAe6sVV1IFSB6KXLoXVkTojpz6Ct16R1tfb2riylze1G4lZhb1yFIwAty5IKSvrsmLD5E9W6kLLdCMAtBJOpVNMurA3sKKHROOLHYyPkmc5MEWGTpKgMSI5PJJUraLteh92r2KSATJftX0F3ABsbCCaHqAC6QjzZYk7m5KRS0CYsg2PtrWkRGbfWCE0eJH_DZLLjirlNdx4E457q0Hqfq-YHm1kMEoGizIN65PS62hQQrG42Fg0HJXRWU1neYCtKzqnFEKFrLPtZU7QQf4JY1quD3fTXK5R0VpF4BpRVFYUzKJXnJdRNMJrw7EsXayhcOGsmxU_ds7tJPa207_nHZt0_J8sUpDIMEtIPZOtGjYEiHaLudm9rYbrUruo2SarK0BqpFeAeekRr-pY6bUU-bFNAYTttzLQaUNsuJsqQaOO_hHZ74M0PDt7zWr8IyCugMPawxZdvF29e1k5xeoFcf_NgSI0QS6vHr_jIQzUxRxKOBdzr_x6rQBBjJFVH3XiWC-is_JAiiPTv7HNyjkWd-keM59WHWyH60y9nWd2Xtp9QkfQu71qp6YMdXeV8LGueoBht6CIxnhbrTW0zJLaUpkdx4gYHsjWP0lT4OuFO3-GOMGblSB5PqYzU-rTmqmht49eNfF0ULyr98EhCqRNpBVuzXaOM8zBavBMlKV6CpE4q3uQJ2-7mxagLGEycJ5XvEKMzDLnKIlncvps2q7RNMxNVcteGxqBhiTR0u1wPMPdyuspZmd1GZGeieDuzzz4_m5mnAxs3H0rXgnGKB",
            tracking: {
              fingerprint: "16a55c03835bdf03c0414b62df7413a9",
            },
            scheduling_link_uuid: "pwm-pwm-235",
            locale: "en",
          },
        );

        console.log("Invitee added successfully:", response.data);
        res.send(response.data);
      } catch (error) {
        console.error("Error adding invitee:", error);
        throw error;
      }
    });
  }
  getFullStat() {
    this.app.post(
      "/get-daily-report",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        const { agentId } = req.body;
        const foundContacts = await contactModel.find({
          status: { $ne: "not called" },
          isDeleted: false,
        });
        const totalCount = await contactModel.countDocuments({
          agentId,
          isDeleted: { $ne: true },
        });
        const totalContactForAgent = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
        });
        const totalAnsweredCalls = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
          status: callstatusenum.CALLED,
        });
        const totalNotCalledForAgent = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
          status: callstatusenum.NOT_CALLED,
        });
        const totalAnsweredByVm = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
          status: callstatusenum.VOICEMAIL,
        });
        const totalCalls = await contactModel.countDocuments({
          agentId,
          isDeleted: false,
          status: {
            $in: [
              callstatusenum.CALLED,
              callstatusenum.VOICEMAIL,
              callstatusenum.FAILED,
            ],
          },
        });
        const totalCallsTransffered = await contactModel.aggregate([
          {
            $match: {
              agentId,
              isDeleted: { $ne: true },
            },
          },
          {
            $lookup: {
              from: "transcripts",
              localField: "referenceToCallId",
              foreignField: "_id",
              as: "callDetails",
            },
          },
          {
            $match: {
              "callDetails.disconnectionReason": "call_transfer",
            },
          },
          {
            $count: "result",
          },
        ]);
        const totalAppointment = await contactModel.aggregate([
          {
            $match: {
              agentId,
              isDeleted: { $ne: true },
            },
          },
          {
            $lookup: {
              from: "transcripts",
              localField: "referenceToCallId",
              foreignField: "_id",
              as: "callDetails",
            },
          },
          {
            $match: {
              "callDetails.analyzedTranscript": "Scheduled",
            },
          },
          {
            $count: "result",
          },
        ]);
        const statsWithTranscripts = await Promise.all(
          foundContacts.map(async (stat) => {
            const transcript = stat.referenceToCallId?.transcript;
            const analyzedTranscript =
              stat.referenceToCallId?.analyzedTranscript;
            return {
              ...stat.toObject(),
              originalTranscript: transcript,
              analyzedTranscript,
            };
          }),
        );
        const data = {
          totalContactForAgent,
          totalAnsweredCalls,
          totalNotCalledForAgent,
          totalAnsweredByVm,
          totalAppointment:
            totalAppointment.length > 0 ? totalAppointment[0].result : 0,
          totalCallsTransffered:
            totalCallsTransffered.length > 0
              ? totalCallsTransffered[0].result
              : 0,
          totalCalls,
          contacts: statsWithTranscripts,
        };
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=contacts.txt",
        );
        res.setHeader("Content-Type", "text/plain");

        res.send(data);
      },
    );
  }
  getAllDbTags() {
    this.app.get(
      "/get-tags",
      authmiddleware,
      isAdmin,
      async (req: Request, res: Response) => {
        const foundTags = await contactModel.distinct("tag");
        res.send(foundTags);
      },
    );
  }

  // script() {
  //   this.app.get("/script", async (req: Request, res: Response) => {
  //     try {
  //       // Retrieve all documents from the contactModel
  //       const contacts = await contactModel.find({isDeleted:false, datesCalled:"2024-08-05"});

  //       // Loop through each contact
  //       for (const contact of contacts) {
  //         const { callId } = contact;

  //       if (typeof callId !== 'string') {
  //         console.log(`Invalid callId for contact ${contact._id}`);
  //         continue;
  //       }
  //         // Find the corresponding transcript document
  //         const transcript = await EventModel.findOne({callId});

  //         if (transcript.analyzedTranscript === "Voicemail") {
  //           await contactModel.updateOne(
  //             { _id: contact._id },
  //             { $set: { status:callstatusenum.VOICEMAIL  } },
  //           );
  //           console.log(
  //             `Updated contact ${contact._id} with transcript ${transcript._id}`,
  //           );
  //         } else {
  //           console.log(
  //             transcript.analyzedTranscript
  //           );
  //         }
  //       }

  //       console.log("Update complete.");
  //       res.send("complete")
  //     } catch (error) {
  //       console.error("Error updating references:", error);
  //     }
  //   });
  // }

  syncStatWithMake() {
    this.app.post("/api/make", async (req: Request, res: Response) => {
      const foundContacts: IContact[] = await contactModel.find({
        isDeleted: false,
      });

      const mappedContacts = foundContacts.map((contact) => ({
        firstname: contact.firstname,
        lastname: contact.lastname ?? "", 
        fullName:`${contact.firstname} ${contact.lastname}`,
        phone: contact.phone,
        email: contact.email,
        company: "TVAG"
      }));
      res.json(mappedContacts);
    });
  }
}
