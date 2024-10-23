process.env.TZ = "America/Los_Angeles";
import cors from "cors";
import { format, toZonedTime } from "date-fns-tz";
import express, { Request, Response } from "express";
import expressWs from "express-ws";
import https, {
  Server as HTTPSServer,
  createServer as httpsCreateServer,
} from "https";
import { Server as HTTPServer, createServer as httpCreateServer } from "http";
import { RawData, WebSocket } from "ws";
import { Retell } from "retell-sdk";
import { createObjectCsvWriter } from "csv-writer";
import {
  createContact,
  deleteOneContact,
  getAllContact,
  updateContactAndTranscript,
  updateOneContact,
} from "./contacts/contact_controller";
import { readFileSync } from "fs";
import csv from "csv-parser";
import {
  connectDb,
  contactModel,
  jobModel,
  EventModel,
} from "./contacts/contact_model";
import axios from "axios";
import argon2 from "argon2";
// import { TwilioClient } from "./twilio_api";
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
import { subDays, startOfMonth, startOfWeek } from "date-fns";
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
import {
  reviewCallback,
  reviewTranscript,
} from "./helper-fuction/transcript-review";
import jwt from "jsonwebtoken";
import { unknownagent } from "./TVAG-LLM/unknowagent";
import { redisClient, redisConnection } from "./utils/redis";
import { userModel } from "./users/userModel";
import authmiddleware from "./middleware/protect";
import { isAdmin } from "./middleware/isAdmin";
import { google } from "googleapis";
import mongoose from "mongoose";
import {
  checkAvailability,
  generateZoomAccessToken,
  getAllSchedulesWithAvailabilityId,
  getUserId,
  scheduleMeeting,
} from "./helper-fuction/zoom";
import callHistoryModel from "./contacts/history_model";
import { formatPhoneNumber } from "./helper-fuction/formatter";
connectDb();
const smee = new SmeeClient({
  source: "https://smee.io/gRkyib7zF2UwwFV",
  target: "https://intuitiveagents.ai/webhook",
  logger: console,
});
smee.start();
redisConnection();

export class Server {
  public app: expressWs.Application;
  private httpServer: HTTPServer;
  private retellClient: Retell;
  // private twilioClient: TwilioClient;
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
    // this.secondScript();
    // this.createPhoneCall();
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
    this.adminSideLogsToCsv();
    this.statsForAgent();
    this.clientSideToCsv();
    this.createPhoneCall2();
    this.searchForAdmin();
    this.getTranscriptAfterCallEnded();
    this.searchForClient();
    this.batchDeleteUser();
    this.getNotCalledUsersAndDelete();
    this.signUpUser();
    this.loginAdmin();
    this.loginUser();
    this.populateUserGet();
    this.testingMake();
    this.testingCalendly();
    this.syncStatWithMake();
    this.testingZoom();
    // this.updateSentimentMetadata()
    this.updateUserTag();
    this.script();
    this.bookAppointmentWithZoom();
    this.checkAvailabiltyWithZoom();
    this.resetPassword();
    this.testingZap();
    this.getCallHistory();

    this.retellClient = new Retell({
      apiKey: process.env.RETELL_API_KEY,
    });

    // this.twilioClient = new TwilioClient(this.retellClient);
    // this.twilioClient.ListenTwilioVoiceWebhook(this.app);
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
        try {
          // const callRegister = await this.retellClient.call.registerPhoneCall({
          //   agent_id: agentId,
          //   from_number: fromNumber,
          //   to_number: toNumber,
          //   retell_llm_dynamic_variables: {
          //     user_firstname: result.firstname,
          //     user_email: result.email,
          //   },
          // });
          // const registerCallResponse2 =
          //   await this.retellClient.call.createPhoneCall({
          //     from_number: fromNumber,
          //     to_number: toNumber,
          //     override_agent_id: agentId,
          //     retell_llm_dynamic_variables: {
          //       user_firstname: result.firstname,
          //       user_email: result.email,
          //     },
          //   });

          if (!result.lastname || result.lastname.trim() === "") {
            result.lastname = ".";
          }
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
              user_firstname: result.firstname,
              user_email: result.email,
              user_lastname: result.lastname,
            },
          });
          await contactModel.findByIdAndUpdate(userId, {
            callId: registerCallResponse2.call_id,
            isusercalled: true,
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

  // createPhoneCall() {
  //   this.app.post(
  //     "/create-phone-call/:agentId",
  //     authmiddleware,
  //     isAdmin,
  //     async (req: Request, res: Response) => {
  //       const { fromNumber, toNumber, userId } = req.body;
  //       const agentId = req.params.agentId;
  //       if (!agentId || !fromNumber || !toNumber || !userId) {
  //         return res.json({ status: "error", message: "Invalid request" });
  //       }
  //       function formatPhoneNumber(phoneNumber: string) {
  //         // Remove any existing "+" and non-numeric characters
  //         let digitsOnly = phoneNumber.replace(/[^0-9]/g, "");

  //         // Check if the phone number starts with "1" (after the "+" is removed)
  //         if (phoneNumber.startsWith("+1")) {
  //           return `+${digitsOnly}`;
  //         }

  //         // Add "+1" prefix if it doesn't already start with "1"
  //         return `+1${digitsOnly}`;
  //       }
  //       const newToNumber = formatPhoneNumber(toNumber);
  //       try {
  //         await this.twilioClient.RegisterPhoneAgent(
  //           fromNumber,
  //           agentId,
  //           userId,
  //         );
  //         const result = await this.twilioClient.CreatePhoneCall(
  //           fromNumber,
  //           newToNumber,
  //           agentId,
  //           userId,
  //         );
  //         res.json({ result });
  //       } catch (error) {
  //         console.log(error);
  //         res.json({
  //           status: "error",
  //           message: "Error while creating phone call",
  //         });
  //       }
  //     },
  //   );
  // }

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
          const day: any = req.query.day;
          const tag = req.query.tag;
          const lowerCaseTag = typeof tag === "string" ? tag.toLowerCase() : "";
          const csvData = fs.readFileSync(csvFile.path, "utf8");

          Papa.parse(csvData, {
            header: true,
            complete: async (results: any) => {
              const jsonArrayObj: IContact[] = results.data as IContact[];

              let headers = results.meta.fields;
              headers = headers.map((header: string) => header.trim());
              const requiredHeaders = [
                "firstname",
                "lastname",
                "phone",
                "email",
              ];
              const missingHeaders = requiredHeaders.filter(
                (header) => !headers.includes(header),
              );
              if (missingHeaders.length > 0) {
                return res.status(400).json({
                  message: `CSV must contain the following headers: ${missingHeaders.join(
                    ", ",
                  )}`,
                });
              }

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
                agentId: string;
                tag: string;
                dayToBeProcessed: string | undefined;
              }[] = [];

              const seenNumbers = new Set<string>();
              for (const user of jsonArrayObj) {
                if (user.firstname && user.phone && user.email) {
                  const formattedPhone = formatPhoneNumber(user.phone);
                  if (!seenNumbers.has(formattedPhone)) {
                    seenNumbers.add(formattedPhone);
                    successfulUsers.push({
                      ...user,
                      phone: formattedPhone,
                      dayToBeProcessed: day,
                      agentId,
                      tag: lowerCaseTag,
                    });
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
                const emailsAndAgentIds = successfulUsers.map((user) => ({
                  email: user.email,
                  agentId: agentId,
                }));

                const existingUsers = await contactModel
                  .find({
                    $or: emailsAndAgentIds.map((emailAndAgentId) => ({
                      email: emailAndAgentId.email,
                      agentId: emailAndAgentId.agentId,
                    })),
                    isDeleted: false,
                  })
                  .select("email agentId")
                  .session(session);

                const existingUsersSet = new Set(
                  existingUsers.map((user) => `${user.email}-${user.agentId}`),
                );

                const uniqueUsersToInsert = successfulUsers.filter((user) => {
                  const userKey = `${user.email}-${agentId}`;
                  return !existingUsersSet.has(userKey);
                });

                if (uniqueUsersToInsert.length > 0) {
                  console.log(uniqueUsersToInsert);
                  await contactModel.insertMany(uniqueUsersToInsert, {
                    session,
                  });

                  await userModel.updateOne(
                    { "agents.agentId": agentId },
                    {
                      $addToSet: { "agents.$.tag": lowerCaseTag },
                    },
                    { session },
                  );
                }
              }
              await session.commitTransaction();
              session.endSession();
              res.status(200).json({
                message: `Upload successful, contacts uploaded: ${uploadedNumber}, duplicates found: ${duplicateCount}`,
                failedUsers: failedUsers.filter(
                  (user) => user.email || user.firstname || user.phone,
                ),
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
      isAdmin,
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
          {
            status: callstatusenum.NOT_CALLED,
            answeredByVM: false,
            datesCalled: [],
            isusercalled: false,
          },
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
    try {
      const { call_id, agent_id } = data;
      await contactModel.findOneAndUpdate(
        { callId: call_id, agentId: agent_id },
        { status: callstatusenum.IN_PROGRESS },
      );
    } catch (error) {
      console.error("Error in handleCallStarted:", error);
    }
  }

  async handleCallEndedOrAnalyzed(payload: any, todayString: any) {
    try {
      const {
        call_id,
        agent_id,
        disconnection_reason,
        start_timestamp,
        end_timestamp,
        transcript,
        recording_url,
        public_log_url,
        cost_metadata,
        call_cost,
        call_analysis,
        retell_llm_dynamic_variables,
        from_number,
        to_number,
        direction,
      } = payload.data;
      let analyzedTranscript;
      let callStatus;
      let statsUpdate: any = { $inc: {} };

      const callData = {
        callId: call_id,
        agentId: agent_id,
        userFirstname: retell_llm_dynamic_variables?.user_firstname || null,
        userLastname: retell_llm_dynamic_variables?.user_lastname || null,
        userEmail: retell_llm_dynamic_variables?.user_email || null,
        recordingUrl: recording_url || null,
        disconnectionReason: disconnection_reason || null,
        callStatus:
          payload.event === "call_analyzed"
            ? call_analysis?.user_sentiment
            : null,
        startTimestamp: start_timestamp || null,
        endTimestamp: end_timestamp || null,
        durationMs: end_timestamp - start_timestamp || 0,
        transcript: transcript || null,
        transcriptObject: payload.data.transcript_object || [],
        transcriptWithToolCalls: payload.data.transcript_with_tool_calls || [],
        publicLogUrl: public_log_url || null,
        callType: payload.data.call_type || null,
        costMetadata: cost_metadata || {},

        callAnalysis: payload.event === "call_analyzed" ? call_analysis : null,
        optOutSensitiveDataStorage:
          payload.data.opt_out_sensitive_data_storage || false,
        fromNumber: from_number || null,
        toNumber: to_number || null,
        direction: direction || null,
      };
      await callHistoryModel.findOneAndUpdate(
        { callId: call_id, agentId: agent_id },
        { $set: callData },
        { upsert: true, returnOriginal: false },
      );
      if (payload.event === "call_ended") {
        const isCallFailed = disconnection_reason === "dial_failed";
        const isCallTransferred = disconnection_reason === "call_transfer";
        const isMachine = disconnection_reason === "voicemail_reached";
        const isDialNoAnswer = disconnection_reason === "dial_no_answer";
        const isCallAnswered =
          disconnection_reason === "user_hangup" ||
          disconnection_reason === "agent_hangup";

        //.
        analyzedTranscript = await reviewTranscript(transcript);
        const isCallScheduled =
          analyzedTranscript.message.content === "Scheduled";
        const callEndedUpdateData = {
          callId: call_id,
          agentId: payload.call.agent_id,
          recordingUrl: recording_url,
          disconnectionReason: disconnection_reason,
          analyzedTranscript: analyzedTranscript.message.content,
          ...(transcript && { transcript }),
        };

        const results = await EventModel.findOneAndUpdate(
          { callId: call_id, agentId: payload.call.agent_id },
          { $set: callEndedUpdateData },
          { upsert: true, returnOriginal: false },
        );

        statsUpdate.$inc.totalCalls = 1;

        if (isMachine) {
          statsUpdate.$inc.totalAnsweredByVm = 1;
          callStatus = callstatusenum.VOICEMAIL;
        } else if (isCallFailed) {
          statsUpdate.$inc.totalFailed = 1;
          callStatus = callstatusenum.FAILED;
        } else if (isCallTransferred) {
          statsUpdate.$inc.totalTransffered = 1;
          callStatus = callstatusenum.TRANSFERRED;
        } else if (isDialNoAnswer) {
          statsUpdate.$inc.totalDialNoAnswer = 1;
          callStatus = callstatusenum.NO_ANSWER;
         } else if (isCallScheduled) {
            statsUpdate.$inc.totalAppointment = 1;
            callStatus = callstatusenum.SCHEDULED;
        } else if (isCallAnswered) {
          statsUpdate.$inc.totalCallAnswered = 1;
          callStatus = callstatusenum.CALLED;
        } 

        const statsResults = await DailyStatsModel.findOneAndUpdate(
          {
            day: todayString,
            agentId: agent_id,
            jobProcessedBy: retell_llm_dynamic_variables.job_id,
          },
          statsUpdate,
          { upsert: true, returnOriginal: false },
        );

        const linkToCallLogModelId = statsResults ? statsResults._id : null;
        const resultForUserUpdate = await contactModel.findOneAndUpdate(
          { callId: call_id, agentId: payload.call.agent_id },
          {
            status: callStatus,
            $push: { datesCalled: todayString },
            referenceToCallId: results._id,
            linktocallLogModel: linkToCallLogModelId,
          },
        );
        // if (analyzedTranscript.message.content === "Scheduled") {
        //   const data = {
        //     firstname: resultForUserUpdate.firstname,
        //     lastname: resultForUserUpdate.lastname
        //       ? resultForUserUpdate.lastname
        //       : "None",
        //     email: resultForUserUpdate.email,
        //     phone: resultForUserUpdate.phone,
        //   };
        //   axios.post(process.env.ZAP_URL, data);
        // }
      }
    } catch (error) {
      console.error("Error in handleCallAnalyyzedOrEnded:", error);
    }
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

  adminSideLogsToCsv() {
    this.app.post("/call-logs-csv", async (req: Request, res: Response) => {
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
    });
  }

  statsForAgent() {
    this.app.post("/get-stats", async (req: Request, res: Response) => {
      const { agentIds, dateOption, limit, page, startDate, endDate } =
        req.body;

      try {
        let dateFilter = {};
        let dateFilter1 = {};
        const skip = (page - 1) * limit;

        const timeZone = "America/Los_Angeles";
        const now = new Date();
        const zonedNow = toZonedTime(now, timeZone);
        const today = format(zonedNow, "yyyy-MM-dd", { timeZone });

        switch (dateOption) {
          case DateOption.Today:
            dateFilter = { datesCalled: today };

            break;
          case DateOption.Yesterday:
            const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
            const yesterday = format(zonedYesterday, "yyyy-MM-dd", {
              timeZone,
            });
            dateFilter = { datesCalled: yesterday };
            break;
          case DateOption.ThisWeek:
            const pastDays = [];
            for (let i = 1; pastDays.length < 5; i++) {
              const day = subDays(now, i);
              const dayOfWeek = day.getDay();
              if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                pastDays.push(
                  format(toZonedTime(day, timeZone), "yyyy-MM-dd", {
                    timeZone,
                  }),
                );
              }
            }
            dateFilter = {
              datesCalled: {
                $gte: pastDays[pastDays.length - 1],
                $lte: today,
              },
            };
            break;

          case DateOption.ThisMonth:
            const zonedStartOfMonth = toZonedTime(startOfMonth(now), timeZone);
            const startOfMonthDate = format(zonedStartOfMonth, "yyyy-MM-dd", {
              timeZone,
            });
            dateFilter = { datesCalled: { $gte: startOfMonthDate } };
            break;
          case DateOption.Total:
            dateFilter = {};
            break;
          case DateOption.LAST_SCHEDULE:
            const recentJob = await jobModel
              .findOne({})
              .sort({ createdAt: -1 })
              .lean();
            if (!recentJob) {
              return "No jobs found for today's filter.";
            }
            const dateToCheck = recentJob.scheduledTime.split("T")[0];
            dateFilter = { datesCalled: { $gte: dateToCheck } };
            break;
          default:
            const recentJob1 = await jobModel
              .findOne({})
              .sort({ createdAt: -1 })
              .lean();
            if (!recentJob1) {
              return "No jobs found for today's filter.";
            }
            const dateToCheck1 = recentJob1.scheduledTime.split("T")[0];
            dateFilter = { datesCalled: { $gte: dateToCheck1 } };
            break;
        }

        switch (dateOption) {
          case DateOption.Today:
            dateFilter1 = { day: today };
            break;
          case DateOption.Yesterday:
            const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
            const yesterday = format(zonedYesterday, "yyyy-MM-dd", {
              timeZone,
            });
            dateFilter1 = { day: yesterday };
            break;
          case DateOption.ThisWeek:
            const pastDays = [];
            for (let i = 1; pastDays.length < 5; i++) {
              const day = subDays(now, i);
              const dayOfWeek = day.getDay();
              if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                // Exclude weekends
                pastDays.push(
                  format(toZonedTime(day, timeZone), "yyyy-MM-dd", {
                    timeZone,
                  }),
                );
              }
            }
            dateFilter1 = {
              day: { $gte: pastDays[pastDays.length - 1], $lte: today },
            };
            break;

          case DateOption.ThisMonth:
            const zonedStartOfMonth = toZonedTime(startOfMonth(now), timeZone);
            const startOfMonthDate = format(zonedStartOfMonth, "yyyy-MM-dd", {
              timeZone,
            });
            dateFilter1 = { day: { $gte: startOfMonthDate } };
            break;
          case DateOption.Total:
            dateFilter1 = {};
            break;
          case DateOption.LAST_SCHEDULE:
            const recentJob = await jobModel
              .findOne({})
              .sort({ createdAt: -1 })
              .lean();
            if (!recentJob) {
              return "No jobs found for today's filter.";
            }
            const dateToCheck = recentJob.scheduledTime.split("T")[0];
            dateFilter1 = { day: { $gte: dateToCheck } };
            break;
          default:
            const recentJob1 = await jobModel
              .findOne({})
              .sort({ createdAt: -1 })
              .lean();
            if (!recentJob1) {
              return "No jobs found for today's filter.";
            }
            const dateToCheck1 = recentJob1.scheduledTime.split("T")[0];
            dateFilter1 = { day: { $gte: dateToCheck1 } };
            break;
        }

        if (startDate) {
          dateFilter = {
            datesCalled: {
              $gte: startDate,
            },
          };
          dateFilter1 = {
            day: {
              $gte: startDate,
            },
          };
        }

        if (endDate) {
          dateFilter = {
            datesCalled: {
              $lte: endDate,
            },
          };
          dateFilter1 = {
            day: {
              $lte: endDate,
            },
          };
        }
        console.log(dateFilter, dateFilter1);

        const foundContacts = await contactModel
          .find({ agentId: { $in: agentIds }, isDeleted: false, ...dateFilter })
          .sort({ createdAt: "desc" })
          .populate("referenceToCallId")
          .limit(limit)
          .skip(skip);

        const totalContactForAgent = await contactModel.countDocuments({
          agentId: { $in: agentIds },
          isDeleted: false,
        });

        const totalCount = await contactModel.countDocuments({
          agentId: { $in: agentIds },
          isDeleted: { $ne: true },
        });

        const totalNotCalledForAgent = await contactModel.countDocuments({
          agentId: { $in: agentIds },
          isDeleted: false,
          status: callstatusenum.NOT_CALLED,
        });
        const totalAnsweredCalls = await contactModel.countDocuments({
          agentId: { $in: agentIds },
          isDeleted: false,
          status: callstatusenum.CALLED,
          ...dateFilter,
        });

        const stats = await DailyStatsModel.aggregate([
          { $match: { agentId: { $in: agentIds }, ...dateFilter1 } },
          {
            $group: {
              _id: null,
              totalCalls: { $sum: "$totalCalls" },
              totalAnsweredByVm: { $sum: "$totalAnsweredByVm" },
              totalAppointment: { $sum: "$totalAppointment" },
              totalCallsTransffered: { $sum: "$totalTransffered" },
              totalFailedCalls: { $sum: "$totalFailed" },
              // totalContactForAgent: { $sum: 1 },
            },
          },
        ]);
        const totalPages = Math.ceil(totalCount / limit);
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
        res.json({
          totalContactForAgent,
          totalAnsweredCalls,
          totalAnsweredByVm: stats[0]?.totalAnsweredByVm || 0,
          totalAppointment: stats[0]?.totalAppointment || 0,
          totalCallsTransffered: stats[0]?.totalCallsTransffered || 0,
          totalNotCalledForAgent,
          totalCalls: stats[0]?.totalCalls || 0,
          totalFailedCalls: stats[0]?.totalFailedCalls || 0,
          totalPages,
          contacts: statsWithTranscripts,
        });
      } catch (error) {
        console.error("Error fetching all contacts:", error);
        return "error getting contact";
      }
    });
  }

  clientSideToCsv() {
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
  searchForClient() {
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

  searchForAdmin() {
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
        const isValidPhone = (phone: string) => {
          const phoneRegex = /^\+\d{10,15}$/;
          return phoneRegex.test(phone.trim());
        };
        const searchTerms = searchTerm
          .split(",")
          .map((term: string) => term.trim());
        const firstTermIsEmail = isValidEmail(searchTerms[0]);

        const newtag = tag ? tag.toLowerCase() : "";
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
            const month = String(date.getUTCMonth() + 1).padStart(2, "0");
            const day = String(date.getUTCDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
          };

          if (startDate || endDate) {
            query["datesCalled"] = {};
            if (startDate && !endDate) {
              const formattedStartDate = formatDateToDB(startDate);
              query["datesCalled"]["$eq"] = formattedStartDate;
            } else if (startDate && endDate) {
              // If both dates are provided, filter by range
              query["datesCalled"]["$gte"] = formatDateToDB(startDate);
              query["datesCalled"]["$lte"] = formatDateToDB(endDate);
            }
          }

          if (tag) {
            query["tag"] = newtag;
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
                  return [];
              }

              query["status"] = callStatus;
            }
          }

          console.log(query);
          return await contactModel.find(query).populate("referenceToCallId");
        };

        let allResults: any[] = [];

        for (const term of searchTerms) {
          const results = await searchForTerm(term, firstTermIsEmail);
          allResults = allResults.concat(results);
        }
        let sentimentStatus:
          | "uninterested"
          | "call-back"
          | "interested"
          | "appt-scheduled"
          | "connected-voicemail"
          | "incomplete-call"
          | undefined;

        if (
          sentimentOption === "Uninterested" ||
          sentimentOption === "uninterested"
        ) {
          sentimentStatus = "uninterested";
        } else if (
          sentimentOption === "Interested" ||
          sentimentOption === "interested"
        ) {
          sentimentStatus = "interested";
        } else if (
          sentimentOption === "Scheduled" ||
          sentimentOption === "scheduled"
        ) {
          sentimentStatus = "appt-scheduled";
        } else if (
          sentimentOption === "Voicemail" ||
          sentimentOption === "voicemail"
        ) {
          sentimentStatus = "connected-voicemail";
        } else if (
          sentimentOption === "incomplete-call" ||
          sentimentOption === "Incomplete-Call"
        ) {
          sentimentStatus = "incomplete-call";
        } else if (
          sentimentOption === "call-back" ||
          sentimentOption === "Call-Back"
        ) {
          sentimentStatus = "call-back";
        }
        if (
          sentimentOption &&
          sentimentOption.toLowerCase() === "uninterested"
        ) {
          const filteredResults = allResults.filter((contact) => {
            const analyzedTranscript =
              contact.referenceToCallId?.analyzedTranscript;
            const callStatus = contact.status === callstatusenum.CALLED;
            return analyzedTranscript === "uninterested" && callStatus;
          });
          res.json(filteredResults);
        } else if (!sentimentOption) {
          res.json(allResults);
        } else {
          const filteredResults = allResults.filter((contact) => {
            const analyzedTranscript =
              contact.referenceToCallId?.analyzedTranscript;
            return analyzedTranscript === sentimentStatus;
          });
          res.json(filteredResults);
        }
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }

  // searchForAdmin() {
  //   this.app.post("/search", async (req: Request, res: Response) => {
  //     const {
  //       searchTerm = "",
  //       startDate,
  //       endDate,
  //       statusOption,
  //       sentimentOption,
  //       agentId,
  //       tag,
  //     } = req.body;

  //     if (!agentId) {
  //       return res.status(400).json({ error: "Search term or agent Id is required" });
  //     }

  //     try {
  //       const isValidEmail = (email: string) => {
  //         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  //         return emailRegex.test(email.trim());
  //       };

  //       const isValidPhone = (phone: string) => {
  //         const phoneRegex = /^\+\d{10,15}$/; // Check if phone is in international format
  //         return phoneRegex.test(phone.trim());
  //       };

  //       const searchTerms = searchTerm.split(",").map((term: string) => term.trim());
  //       const firstTerm = searchTerms[0];
  //       const firstTermIsEmail = isValidEmail(firstTerm);
  //       const firstTermIsPhone = isValidPhone(firstTerm);

  //       const newtag = tag ? tag.toLowerCase() : "";

  //       const searchForTerm = async (term: string, searchByEmail: boolean, searchByPhone: boolean) => {
  //         const query: any = {
  //           agentId,
  //           isDeleted: false,
  //           $or: searchByEmail
  //             ? [{ email: { $regex: term, $options: "i" } }]
  //             : searchByPhone
  //               ? [{ phone: { $regex: term, $options: "i" } }]
  //               : [
  //                   { firstname: { $regex: term, $options: "i" } },
  //                   { lastname: { $regex: term, $options: "i" } },
  //                   { phone: { $regex: term, $options: "i" } },
  //                   { email: { $regex: term, $options: "i" } },
  //                 ],
  //         };

  //         const formatDateToDB = (dateString: any) => {
  //           const date = new Date(dateString);
  //           const year = date.getUTCFullYear();
  //           const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  //           const day = String(date.getUTCDate()).padStart(2, "0");
  //           return `${year}-${month}-${day}`;
  //         };

  //         if (startDate || endDate) {
  //           query["datesCalled"] = {};
  //           if (startDate && !endDate) {
  //             const formattedStartDate = formatDateToDB(startDate);
  //             query["datesCalled"]["$eq"] = formattedStartDate;
  //           } else if (startDate && endDate) {
  //             query["datesCalled"]["$gte"] = formatDateToDB(startDate);
  //             query["datesCalled"]["$lte"] = formatDateToDB(endDate);
  //           }
  //         }

  //         if (tag) {
  //           query["tag"] = newtag;
  //         }

  //         if (statusOption && statusOption !== "All") {
  //           let callStatus;
  //           switch (statusOption.toLowerCase()) {
  //             case "call-connected":
  //               callStatus = callstatusenum.CALLED;
  //               break;
  //             case "not-called":
  //               callStatus = callstatusenum.NOT_CALLED;
  //               break;
  //             case "called-na-vm":
  //               callStatus = callstatusenum.VOICEMAIL;
  //               break;
  //             case "call-failed":
  //               callStatus = callstatusenum.FAILED;
  //               break;
  //             default:
  //               return [];
  //           }
  //           query["status"] = callStatus;
  //         }

  //         return await contactModel.find(query).populate("referenceToCallId");
  //       };

  //       let allResults: any[] = [];

  //       for (const term of searchTerms) {
  //         const results = await searchForTerm(term, firstTermIsEmail, firstTermIsPhone);
  //         allResults = allResults.concat(results);
  //       }

  //       let sentimentStatus:
  //         | "uninterested"
  //         | "call-back"
  //         | "interested"
  //         | "appt-scheduled"
  //         | "connected-voicemail"
  //         | "incomplete-call"
  //         | undefined;

  //       switch (sentimentOption?.toLowerCase()) {
  //         case "uninterested":
  //           sentimentStatus = "uninterested";
  //           break;
  //         case "interested":
  //           sentimentStatus = "interested";
  //           break;
  //         case "scheduled":
  //           sentimentStatus = "appt-scheduled";
  //           break;
  //         case "voicemail":
  //           sentimentStatus = "connected-voicemail";
  //           break;
  //         case "incomplete-call":
  //           sentimentStatus = "incomplete-call";
  //           break;
  //         case "call-back":
  //           sentimentStatus = "call-back";
  //           break;
  //       }

  //       if (sentimentStatus) {
  //         const filteredResults = allResults.filter((contact) => {
  //           const analyzedTranscript = contact.referenceToCallId?.analyzedTranscript;
  //           return analyzedTranscript === sentimentStatus;
  //         });
  //         res.json(filteredResults);
  //       } else {
  //         res.json(allResults);
  //       }
  //     } catch (error) {
  //       console.log(error);
  //       res.status(500).json({ error: "Internal server error" });
  //     }
  //   });
  // }

  batchDeleteUser() {
    this.app.post(
      "/batch-delete-users",
      authmiddleware,
      isAdmin,
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
            { agentId, status: callstatusenum.NOT_CALLED },
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

        const userInDb = await userModel.findOne(
          { username },
          {
            "agents.agentId": 1,
            passwordHash: 1,
            isAdmin: 1,
            username: 1,
            group: 1,
            name: 1,
          },
        );

        if (!userInDb) {
          // Log unsuccessful login attempt
          await userModel.updateOne(
            { username },
            {
              $push: {
                loginDetails: {
                  ipAddress: req.ip,
                  successful: false,
                },
              },
            },
          );
          return res.status(400).json({ message: "Invalid login credentials" });
        }

        const verifyPassword = await argon2.verify(
          userInDb.passwordHash,
          password,
        );
        if (!verifyPassword) {
          // Log unsuccessful login attempt
          await userModel.updateOne(
            { username },
            {
              $push: {
                loginDetails: {
                  ipAddress: req.ip,
                  successful: false,
                },
              },
            },
          );
          return res.status(400).json({ message: "Incorrect password" });
        }

        // Log successful login attempt
        await userModel.updateOne(
          { username },
          {
            $push: {
              loginDetails: {
                ipAddress: req.ip,
                successful: true,
              },
            },
          },
        );

        let result;
        if (userInDb.isAdmin === true) {
          const payload = await userModel.aggregate([
            {
              $project: { agents: 1 },
            },
            {
              $unwind: "$agents",
            },
            {
              $group: { _id: null, allAgentIds: { $push: "$agents.agentId" } },
            },
            {
              $project: { _id: 0, allAgentIds: 1 },
            },
          ]);
          result = payload.length > 0 ? payload[0].allAgentIds : [];
        } else {
          result = userInDb?.agents?.map((agent) => agent.agentId) || [];
        }

        const token = jwt.sign(
          { userId: userInDb._id, isAdmin: userInDb.isAdmin },
          process.env.JWT_SECRET,
          { expiresIn: "1d" },
        );

        console.log(userInDb);

        res.json({
          payload: {
            message: "Logged in successfully",
            token,
            username: userInDb.username,
            userId: userInDb._id,
            group: userInDb.group,
            name: userInDb.name,
            agentIds: result,
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
          // Log unsuccessful login attempt
          await userModel.updateOne(
            { username },
            {
              $push: {
                loginDetails: {
                  ipAddress: req.ip,
                  device: "Unknown", // Improve this as needed
                  successful: false,
                },
              },
            },
          );
          return res.status(400).json({ message: "Invalid login credentials" });
        }

        const verifyPassword = await argon2.verify(
          userInDb.passwordHash,
          password,
        );
        if (!verifyPassword) {
          // Log unsuccessful login attempt
          await userModel.updateOne(
            { username },
            {
              $push: {
                loginDetails: {
                  ipAddress: req.ip,
                  device: "Unknown", // Improve this as needed
                  successful: false,
                },
              },
            },
          );
          return res.status(400).json({ message: "Incorrect password" });
        }

        if (userInDb.isAdmin === false) {
          return res.status(401).json("Only admins can access here");
        }

        // Log successful login attempt
        await userModel.updateOne(
          { username },
          {
            $push: {
              loginDetails: {
                ipAddress: req.ip,
                device: "Unknown", // Improve this as needed
                successful: true,
              },
            },
          },
        );

        const token = jwt.sign(
          { userId: userInDb._id, isAdmin: userInDb.isAdmin },
          process.env.JWT_SECRET,
          { expiresIn: "1d" },
        );

        const result = await userModel.aggregate([
          {
            // Project only the agents field, which contains the agentId
            $project: {
              agents: 1,
            },
          },
          {
            // Unwind the agents array to have individual documents for each agent
            $unwind: "$agents",
          },
          {
            // Group all the agentId values into one array
            $group: {
              _id: null, // Single group
              allAgentIds: { $push: "$agents.agentId" },
            },
          },
          {
            // Optionally, remove the _id field from the result

            $project: {
              _id: 0,
              allAgentIds: 1,
            },
          },
        ]);

        return res.status(200).json({
          payload: {
            message: "Logged in successfully",
            token,
            username: userInDb.username,
            userId: userInDb._id,
            group: userInDb.group,
            agentIds: result,
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

  // async deleteContactsByEmail(emails: any) {
  //   try {
  //     // Split the input string containing comma-separated emails into an array
  //     const emailArray = emails.split(",");
  //     console.log(emailArray);

  //     // Use Mongoose's deleteMany function to remove documents with matching emails
  //     const result = await contactModel.deleteMany({
  //       email: { $in: emailArray },
  //     });

  //     console.log(`${result.deletedCount} contacts deleted.`);
  //     return result;
  //   } catch (error) {
  //     console.error("Error deleting contacts:", error);
  //     throw error; // Forwarding the error for handling in upper layers
  //   }
  // }

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
          status: { $ne: callstatusenum.NOT_CALLED },
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
    this.app.post(
      "/get-tags",

      async (req: Request, res: Response) => {
        const { agentId } = req.body;

        try {
          const user = await userModel.findOne(
            { "agents.agentId": agentId },
            { "agents.$": 1 },
          );
          if (user && user.agents.length > 0) {
            res.send({ payload: user.agents[0].tag });
          } else {
            res.send({ payload: "Agent not found" });
          }
        } catch (error) {
          console.error("Error fetching tag:", error);
          return "Error fetching tag";
        }
      },
    );
  }
  syncStatWithMake() {
    this.app.post("/api/make", async (req: Request, res: Response) => {
      const foundContacts: IContact[] = await contactModel
        .find({
          isDeleted: false,
        })
        .populate("referenceToCallId");

      const mappedContacts = await Promise.all(
        foundContacts.map(async (contact) => {
          let date: string | undefined;

          if (contact.referenceToCallId?.analyzedTranscript === "Call back") {
            date = await reviewCallback(contact.referenceToCallId.transcript);
          }

          const firstname = contact.firstname ? contact.firstname : ".";
          const lastname = contact.lastname ? contact.lastname : ".";

          return {
            firstname: firstname,
            lastname: lastname,
            fullName: `${firstname} ${lastname}`,
            phone: contact.phone ? contact.phone : ".",
            email: contact.email ? contact.email : ".",
            company: "",
            summary: contact.referenceToCallId?.retellCallSummary
              ? contact.referenceToCallId.retellCallSummary
              : ".",
            recordingAudioLink: contact.referenceToCallId?.recordingUrl
              ? contact.referenceToCallId.recordingUrl
              : ".",
            timeToCallback: date ? "." : date,
          };
        }),
      );

      res.json(mappedContacts);
    });
  }
  testingZoom() {
    this.app.post("/test/zoom", async (req: Request, res: Response) => {
      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;
      const accountId = process.env.ZOOM_ACC_ID;
      const userEmail = process.env.ZOOM_EMAIL;
      const availabilityId = process.env.ZOOM_AVAILABILTY_ID;
      // const userId = process.env.ZOOM_USER_ID;
      const { start_time, invitee } = req.body;
      try {
        await generateZoomAccessToken(clientId, clientSecret, accountId);

        const userId = await getUserId(
          userEmail,
          clientId,
          clientSecret,
          accountId,
        );
        console.log("userID is : ", userId);

        await getAllSchedulesWithAvailabilityId(
          clientId,
          clientSecret,
          accountId,
        );

        const availableTimes = await checkAvailability(
          clientId,
          clientSecret,
          accountId,
          availabilityId,
        );
        console.log("Availablle times are : ", availableTimes);
        // const firstname = "Testing";

        // const scheduledMeeting = await scheduleMeeting(
        //   clientId,
        //   clientSecret,
        //   accountId,
        //   userId,
        //   start_time,
        //   45,
        //   "Important Meeting with retell",
        //   "Discuss important matters for 45 minutes",
        //   invitee,
        //   firstname,
        // );
        // console.log("Meeting scheduled:", scheduledMeeting);
        res.send("done");
      } catch (error) {
        console.error("An error occurred:", error);
      }
    });
  }
  updateUserTag() {
    this.app.post("/update/metadata", async (req: Request, res: Response) => {
      try {
        const { updates } = req.body;
        const result = await updateContactAndTranscript(updates);
        res.json({ message: result });
      } catch (error) {
        console.error("Error updating events:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
  }
  checkAvailabiltyWithZoom() {
    this.app.post("/zoom/availabilty", async (req: Request, res: Response) => {
      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;
      const accountId = process.env.ZOOM_ACC_ID;
      const availabilityId = process.env.ZOOM_AVAILABILTY_ID;
      const availableTimes = await checkAvailability(
        clientId,
        clientSecret,
        accountId,
        availabilityId,
      );
      res.send(availableTimes);
    });
  }
  bookAppointmentWithZoom() {
    this.app.post("/zoom/appointment", async (req: Request, res: Response) => {
      let lastname;
      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;
      const accountId = process.env.ZOOM_ACC_ID;
      const userId = process.env.ZOOM_USER_ID;
      const invitee = req.body.args.email;
      const start_time = req.body.args.startTime;
      const firstname =
        req.body.call.retell_llm_dynamic_variables.user_firstname;
      lastname = req.body.call.retell_llm_dynamic_variables.user_lastname;

      if (!lastname) {
        lastname = ".";
      }
      const scheduledMeeting = await scheduleMeeting(
        clientId,
        clientSecret,
        accountId,
        userId,
        start_time,
        45,
        "Important Meeting",
        "Discuss important matters",
        invitee,
        firstname,
        lastname,
      );
      res.send("Schduled");
    });
  }
  // script() {
  //   this.app.post("/script", async (req: Request, res: Response) => {
  //     try {
  //       interface Contact {
  //         email: string;
  //         firstname: string;
  //         phone: string;
  //         [key: string]: string;
  //       }

  //       async function processCSV(
  //         mainCSV: string,
  //         dncCSV: string,
  //         nonDuplicateCSV: string,
  //         duplicateCSV: string,
  //       ): Promise<void> {
  //         return new Promise((resolve, reject) => {
  //           const mainContacts: Contact[] = [];
  //           const dncContacts: Contact[] = [];

           
  //           fs.createReadStream(mainCSV)
  //             .pipe(csv())
  //             .on("data", (data: Contact) => mainContacts.push(data))
  //             .on("end", () => {
  //               fs.createReadStream(dncCSV)
  //                 .pipe(csv())
  //                 .on("data", (data: Contact) => dncContacts.push(data))
  //                 .on("end", async () => {
  //                   try {
  //                     // Create a set of both email and phone from the DNC list
  //                     const dncSet = new Set(
  //                       dncContacts.map(
  //                         (contact) => `${contact.email}-${formatPhoneNumber(contact.phone)}`,
  //                       ),
  //                     );

  //                     // Filter non-duplicate contacts (not in DNC list)
  //                     const nonDuplicateContacts = mainContacts.filter(
  //                       (contact) =>
  //                         !dncSet.has(`${contact.email}-${formatPhoneNumber(contact.phone)}`),
  //                     );

  //                     // Filter duplicate contacts (in DNC list)
  //                     const duplicateContacts = mainContacts.filter((contact) =>
  //                       dncSet.has(`${contact.email}-${formatPhoneNumber(contact.phone)}`),
  //                     );

  //                     if (nonDuplicateContacts.length > 0) {
  //                       const nonDuplicateWriter = createObjectCsvWriter({
  //                         path: nonDuplicateCSV,
  //                         header: Object.keys(nonDuplicateContacts[0]).map(
  //                           (key) => ({
  //                             id: key,
  //                             title: key,
  //                           }),
  //                         ),
  //                       });
  //                       await nonDuplicateWriter.writeRecords(
  //                         nonDuplicateContacts,
  //                       );
  //                       console.log(
  //                         `Non-duplicate contacts saved to ${nonDuplicateCSV}`,
  //                       );
  //                     } else {
  //                       console.log("No non-duplicate contacts to write.");
  //                     }

  //                     if (duplicateContacts.length > 0) {
  //                       const duplicateWriter = createObjectCsvWriter({
  //                         path: duplicateCSV,
  //                         header: Object.keys(duplicateContacts[0]).map(
  //                           (key) => ({
  //                             id: key,
  //                             title: key,
  //                           }),
  //                         ),
  //                       });
  //                       await duplicateWriter.writeRecords(duplicateContacts);
  //                       console.log(
  //                         `Duplicate contacts saved to ${duplicateCSV}`,
  //                       );
  //                     } else {
  //                       console.log("No duplicate contacts to write.");
  //                     }

  //                     resolve();
  //                   } catch (err) {
  //                     console.error("Error writing CSV:", err);
  //                     reject(err);
  //                   }
  //                 })
  //                 .on("error", (err) => reject(err));
  //             })
  //             .on("error", (err) => reject(err));
  //         });
  //       }

  //       // Paths to CSV files in the public folder
  //       const mainCSVPath = path.join(__dirname, "../public", "main.csv");
  //       const dncCSVPath = path.join(__dirname, "../public", "compare.csv");
  //       const nonDuplicateCSVPath = path.join(
  //         __dirname,
  //         "../public",
  //         "non_duplicate_main.csv",
  //       );
  //       const duplicateCSVPath = path.join(
  //         __dirname,
  //         "../public",
  //         "duplicate_main.csv",
  //       );

  //       // Call the function to process the CSV files
  //       await processCSV(
  //         mainCSVPath,
  //         dncCSVPath,
  //         nonDuplicateCSVPath,
  //         duplicateCSVPath,
  //       );

  //       res.status(200).json({
  //         message: "Contacts have been filtered and saved successfully",
  //       });
  //     } catch (error) {
  //       res.status(500).json({
  //         message: "An error occurred while updating phone numbers",
  //       });
  //     }
  //   });
  // }
  script() {
    this.app.post("/script", async (req: Request, res: Response) => {
      try {
        interface Contact {
          email: string;
          firstname: string;
          phone: string;
          [key: string]: string;
        }
  
        async function processCSV(
          mainCSV: string,
          compareCSV: string,
          nonDuplicateCSV: string,
          duplicateCSV: string
        ): Promise<void> {
          return new Promise((resolve, reject) => {
            const mainContacts: Contact[] = [];
            const compareContacts: Contact[] = [];
  
            // Read the main CSV (main contacts)
            fs.createReadStream(mainCSV)
              .pipe(csv())
              .on("data", (data: Contact) => mainContacts.push(data))
              .on("end", () => {
                // Read the compare CSV (DNC or similar contacts)
                fs.createReadStream(compareCSV)
                  .pipe(csv())
                  .on("data", (data: Contact) => compareContacts.push(data))
                  .on("end", async () => {
                    try {
                      // Create a set of email and phone from the main list
                      const mainSet = new Set(
                        mainContacts.map((contact) =>
                          contact.phone
                            ? `${contact.email}-${formatPhoneNumber(contact.phone)}`
                            : `${contact.email}-${contact.firstname}`
                        )
                      );
  
                      // Filter compare contacts based on the main set
                      const duplicateContacts = compareContacts.filter((contact) =>
                        mainSet.has(
                          contact.phone
                            ? `${contact.email}-${formatPhoneNumber(contact.phone)}`
                            : `${contact.email}-${contact.firstname}`
                        )
                      );
  
                      const nonDuplicateContacts = compareContacts.filter(
                        (contact) =>
                          !mainSet.has(
                            contact.phone
                              ? `${contact.email}-${formatPhoneNumber(contact.phone)}`
                              : `${contact.email}-${contact.firstname}`
                          )
                      );
  
                      // Write non-duplicate contacts to a CSV
                      if (nonDuplicateContacts.length > 0) {
                        const nonDuplicateWriter = createObjectCsvWriter({
                          path: nonDuplicateCSV,
                          header: Object.keys(nonDuplicateContacts[0]).map((key) => ({
                            id: key,
                            title: key,
                          })),
                        });
                        await nonDuplicateWriter.writeRecords(nonDuplicateContacts);
                        console.log(`Non-duplicate contacts saved to ${nonDuplicateCSV}`);
                      } else {
                        console.log("No non-duplicate contacts to write.");
                      }
  
                      // Write duplicate contacts to a CSV
                      if (duplicateContacts.length > 0) {
                        const duplicateWriter = createObjectCsvWriter({
                          path: duplicateCSV,
                          header: Object.keys(duplicateContacts[0]).map((key) => ({
                            id: key,
                            title: key,
                          })),
                        });
                        await duplicateWriter.writeRecords(duplicateContacts);
                        console.log(`Duplicate contacts saved to ${duplicateCSV}`);
                      } else {
                        console.log("No duplicate contacts to write.");
                      }
  
                      resolve();
                    } catch (err) {
                      console.error("Error writing CSV:", err);
                      reject(err);
                    }
                  })
                  .on("error", (err) => reject(err));
              })
              .on("error", (err) => reject(err));
          });
        }
  
        // Paths to CSV files
        const mainCSVPath = path.join(__dirname, "../public", "main.csv");
        const compareCSVPath = path.join(__dirname, "../public", "compare.csv");
        const nonDuplicateCSVPath = path.join(__dirname, "../public", "non_duplicate.csv");
        const duplicateCSVPath = path.join(__dirname, "../public", "duplicate.csv");
  
        // Call the function to process the CSV files
        await processCSV(mainCSVPath, compareCSVPath, nonDuplicateCSVPath, duplicateCSVPath);
  
        res.status(200).json({
          message: "Contacts have been filtered and saved successfully",
        });
      } catch (error) {
        res.status(500).json({
          message: "An error occurred while processing the CSVs",
        });
      }
    });
  }
  
  
  populateUserGet() {
    this.app.post("/user/populate", async (req: Request, res: Response) => {
      try {
        const { agentId, dateOption, status } = req.body;
        const timeZone = "America/Los_Angeles"; // PST time zone
        const now = new Date();
        const zonedNow = toZonedTime(now, timeZone);
        const today = format(zonedNow, "yyyy-MM-dd", { timeZone });
        let dateFilter = {};

        switch (dateOption) {
          case DateOption.Today:
            dateFilter = { datesCalled: today };
            break;
          case DateOption.Yesterday:
            const zonedYesterday = toZonedTime(subDays(now, 1), timeZone);
            const yesterday = format(zonedYesterday, "yyyy-MM-dd", {
              timeZone,
            });
            dateFilter = { datesCalled: yesterday };
            break;
          case DateOption.ThisWeek:
            const pastDays = [];
            for (let i = 1; pastDays.length < 5; i++) {
              const day = subDays(now, i);
              const dayOfWeek = day.getDay();
              if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                pastDays.push(
                  format(toZonedTime(day, timeZone), "yyyy-MM-dd", {
                    timeZone,
                  }),
                );
              }
            }
            dateFilter = {
              datesCalled: { $gte: pastDays[pastDays.length - 1], $lte: today },
            };
            break;
          case DateOption.ThisMonth:
            const zonedStartOfMonth = toZonedTime(startOfMonth(now), timeZone);
            const startOfMonthDate = format(zonedStartOfMonth, "yyyy-MM-dd", {
              timeZone,
            });
            dateFilter = { datesCalled: { $gte: startOfMonthDate } };
            break;
          case DateOption.Total:
            dateFilter = {};
            break;
          case DateOption.LAST_SCHEDULE:
            const recentJob = await jobModel
              .findOne({})
              .sort({ createdAt: -1 })
              .lean();
            if (!recentJob)
              return res.status(404).send("No jobs found for today's filter.");
            const dateToCheck = recentJob.scheduledTime.split("T")[0];
            dateFilter = { datesCalled: { $gte: dateToCheck } };
            break;
          default:
            const recentJob1 = await jobModel
              .findOne({})
              .sort({ createdAt: -1 })
              .lean();
            if (!recentJob1)
              return res.status(404).send("No jobs found for today's filter.");
            const dateToCheck1 = recentJob1.scheduledTime.split("T")[0];
            dateFilter = { datesCalled: { $gte: dateToCheck1 } };
            break;
        }
        let result;
        switch (status) {
          case "failed":
            result = await contactModel
              .find({
                agentId,
                isDeleted: false,
                status: callstatusenum.FAILED,
                ...dateFilter,
              })
              .populate("referenceToCallId");
            break;

          case "called":
            result = await contactModel
              .find({
                agentId,
                isDeleted: false,
                status: { $ne: callstatusenum.NOT_CALLED },
                ...dateFilter,
              })
              .populate("referenceToCallId");
            break;

          case "not-called":
            result = await contactModel
              .find({
                agentId,
                isDeleted: false,
                status: callstatusenum.NOT_CALLED,
              })
              .populate("referenceToCallId");
            break;

          case "answered":
            result = await contactModel
              .find({
                agentId,
                isDeleted: false,
                status: callstatusenum.CALLED,
                ...dateFilter,
              })
              .populate("referenceToCallId");
            break;

          case "transferred":
            result = await contactModel
              .find({
                agentId,
                isDeleted: false,
                status: callstatusenum.TRANSFERRED,
                ...dateFilter,
              })
              .populate("referenceToCallId");
            break;

          case "voicemail":
            result = await contactModel
              .find({
                agentId,
                isDeleted: false,
                status: callstatusenum.VOICEMAIL,
                ...dateFilter,
              })
              .populate("referenceToCallId");
            break;

          case "appointment":
            result = await contactModel
              .find({
                agentId,
                isDeleted: false,
                status: callstatusenum.SCHEDULED,
                ...dateFilter,
              })
              .populate("referenceToCallId");
            break;

          default:
            result = await contactModel
              .find({
                agentId,
                isDeleted: false,
                ...dateFilter,
              })
              .populate("referenceToCallId");
        }
        res.json(result);
      } catch (error) {
        console.error("Error in populateUserGet:", error);
        res.status(500).send("An error occurred while processing the request.");
      }
    });
  }
  resetPassword() {
    this.app.post(
      "/user/reset-password",
      async (req: Request, res: Response) => {
        try {
          const { email, newPassword } = req.body;

          // Validate input
          if (!email || !newPassword) {
            return res
              .status(400)
              .json({ message: "Please provide email and new password" });
          }

          // Find the user by email
          const user = await userModel.findOne({ email });
          if (!user) {
            return res.status(404).json({ message: "User not found" });
          }

          // Hash the new password
          const newPasswordHash = await argon2.hash(newPassword);

          // Update the user's passwordHash
          user.password = newPassword;
          user.passwordHash = newPasswordHash;
          await user.save();

          return res.json({ message: "Password reset successfully" });
        } catch (error) {
          console.log(error);
          return res
            .status(500)
            .json({ message: "Error while resetting password" });
        }
      },
    );
  }
  testingZap() {
    this.app.post("/zapTest", (req: Request, res: Response) => {
      try {
        const data = {
          firstname: "Nick",
          lastname: "Bernadini",
          email: "info@ixperience.io",
          phone: "+1727262723",
        };
        const result = axios.post(process.env.ZAP_URL, data);
        console.log("don3");
        res.send("done");
      } catch (error) {
        console.log(error);
      }
    });
  }

  getCallHistory() {
    this.app.post("/call-history", async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.body.page) || 1;
        const pageSize = 20;

        const skip = (page - 1) * pageSize;

        const callHistories = await callHistoryModel
          .find({}, { callId: 0 })
          .sort({ startTimestamp: -1 })
          .skip(skip)
          .limit(pageSize);

        const totalCount = await callHistoryModel.countDocuments();
        const totalPages = Math.ceil(totalCount / pageSize);
        res.json({
          success: true,
          page,
          totalPages,
          totalCount,
          callHistories,
        });
      } catch (error) {
        console.error("Error fetching call history:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal Server Error" });
      }
    });
  }
}
