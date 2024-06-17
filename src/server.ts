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
import { CustomLlmRequest, CustomLlmResponse, Ilogs } from "./types";
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
import { katherineDemoLlmClient } from "./Other-LLM/be+well_llm_openai";
import { DailyStats } from "./contacts/call_log";
import { AgentResponse, LlmResponse } from "retell-sdk/resources";
import { checkAvailability } from "./callendly";
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
import { checkAvailability2 } from "./callendly2";
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
  private httpsServer: HTTPSServer;
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

    // this.testReetellWebsocket()
    this.handleRetellLlmWebSocket();
    this.handleContactSaving();
    this.handlecontactDelete();
    this.handlecontactGet();
    this.createPhoneCall();
    this.handleContactUpdate();
    this.uploadcsvToDb();
    this.schedulemycall();
    this.getjobstatus();
    this.resetAgentStatus();
    this.getTimefromcallendly();
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
    this.getTimefromCallendly2()

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
        // const llm: LlmResponse = await this.retellClient.llm.create({
        //   general_prompt:
        //     "## Identity\nYou are a persuasive Sales Development Representative for Virtual Help Desk, an expert in offering tailored virtual assistant services to businesses. Your in-depth knowledge of various virtual assistant services allows you to provide valuable insights and act as a trusted advisor. You maintain the highest standards of professionalism, integrity, and dedication to client success.\n\n## Style Guardrails\nBe Concise: Respond succinctly, addressing one topic at most.\nEmbrace Variety: Use diverse language and rephrasing to enhance clarity without repeating content.\nBe Conversational: Use everyday language, making the chat feel like talking to a friend.\nBe Proactive: Lead the conversation, often wrapping up with a question or next-step suggestion.\nAvoid multiple questions in a single response.\nGet clarity: If the user only partially answers a question, or if the answer is unclear, keep asking to get clarity.\nUse a colloquial way of referring to the date (like 'next Friday', 'tomorrow').\nOne question at a time: Ask only one question at a time, do not pack more topics into one response.\n\n## Response Guideline\nAdapt and Guess: Try to understand transcripts that may contain transcription errors. Avoid mentioning \"transcription error\" in the response.\nStay in Character: Keep conversations within your role's scope, guiding them back creatively without repeating.\nEnsure Fluid Dialogue: Respond in a role-appropriate, direct manner to maintain a smooth conversation flow.\nDo not make up answers: If you do not know the answer to a question, simply say so. Do not fabricate or deviate from listed responses.\nIf at any moment the conversation deviates, kindly lead it back to the relevant topic. Do not repeat from start, keep asking from where you stopped.",
        //   general_tools: [
        //     {
        //       type: "end_call",
        //       name: "end_call",
        //       description:
        //         "Hang up the call, only used when instructed to do so or when the user explicitly says goodbye.",
        //     },
        //   ],
        //   states: [
        //     {
        //       name: "intro",
        //       state_prompt:
        //         '## Steps:\nFollow the steps here to ask questions to user\n1. introduce yourself by this is Ethan from Virtual Team Expert and ask for user\'s name if user has not provided their name.\n  - if the user says this is wrong number, call function end_call to hang up and say sorry for the confusion.\n2. Say [I\'m following up on an inquiry that was submitted for our virtual assistant services. Were you still looking for help?]\n  - if the response is no, call function end_call to hang up and say "No worries, please keep us in mind if anything changes."\n3. ask if user is open to have a zoom call to tailor our services and create a custom quote for you.\n  - if yes, transition to appointment_date_checking\n  - if clearly no (not interested at all), call function end_call to hang up and say "No worries, please keep us in mind if anything changes."\n  - if user is hesitant, reaffirm the benefit of zoom call and proceed to step 4\n4. ask Would you be open for a short Zoom call with us? \n  - if yes, transition to appointment_date_checking\n  - if still no, call function end_call to hang up and say "No worries, please keep us in mind if anything changes."\n',
        //       edges: [
        //         {
        //           description:
        //             "Transition to check available appointment dates if user agrees to a zoom call",
        //           destination_state_name: "appointment_date_checking",
        //         },
        //       ],
        //       tools: [],
        //     },
        //     {
        //       name: "appointment_date_checking",
        //       state_prompt:
        //         '## Schedule Rule\nCurrent time is {{current_time}}. Schedule only within the current calendar year and future dates. User\'s email {{user_email}}.\n\nTask:\n1. Ask user for a range of availability for the zoom call.\n2. Call function check_availability to check for availability in the provided time range.\n   - If available, inform user of the options and ask to select from them.\n   - If nearby times are available, inform user about those options.\n   - If no times are available, ask user to select another range, then repeat step 2.\n3. Confirm the selected date, time, and timezone with the user: "Just to confirm, you want to book the appointment at ...". Ensure the chosen time is from the available slots.\n4. Once confirmed, say "Thank you", use end_call to hang up.',
        //       edges: [],
        //       tools: [
        //         {
        //           execution_message_description:
        //             "Huhh give a moment while i check what time is available for you.",
        //           speak_after_execution: true,
        //           name: "check_availability",
        //           description:
        //             "get the available appointment date to schedule a meeting .",
        //           type: "custom",
        //           speak_during_execution: true,
        //           url: "https://retell-backend-yy86.onrender.com/calender",
        //         },
        //       ],
        //     },
        //   ],
        //   starting_state: "intro",
        //   begin_message: "Hi, is this {{user_firstname}}",
        // });

        // const agent: AgentResponse = await this.retellClient.agent.update(
        //   "86f0db493888f1da69b7d46bfaecd360",
        //   { llm_websocket_url: "wss://api.retellai.com/retell-llm-new/ad9324685fc388fcdf9f9ab057a3b521" },
        // );
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
          await contactModel.findByIdAndUpdate(userId, {
            status: callstatusenum.FAILED,
          });
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
        } catch (error) {
          console.log(error);
        }
      },
    );
  }

  handlecontactGet() {
    this.app.post(
      "/users/:agentId",
      authmiddleware,
      async (req: Request, res: Response) => {
        const agentId = req.params.agentId;
        const { page, limit } = req.body;
        const newpage = parseInt(page);
        const newLimit = parseInt(limit);
        try {
          const result = await getAllContact(agentId, newpage, newLimit);
          res.json({ result });
        } catch (error) {
          console.log(error);
        }
      },
    );
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
      isAdmin,
      authmiddleware,
      async (req: Request, res: Response) => {
        const { fromNumber, toNumber, userId } = req.body;
        const agentId = req.params.agentId;
        if (!agentId || !fromNumber || !toNumber || !userId) {
          return res.json({ status: "error", message: "Invalid request" });
        }
        try {
          await this.twilioClient.RegisterPhoneAgent(
            fromNumber,
            agentId,
            userId,
          );
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
      authmiddleware,
      isAdmin,
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
              const agentId = req.params.agentId;
              let uploadedNumber = 0;
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

              for (const user of jsonArrayObj) {
                if (user.firstname && user.phone && user.email) {
                  try {
                    const existingUser = await contactModel.findOne({
                      email: user.email,
                      agentId: user.agentId,
                    });
                    if (!existingUser) {
                      const userWithAgentId = { ...user, agentId };
                      successfulUsers.push(userWithAgentId);
                      uploadedNumber++;
                    }
                  } catch (error) {
                    failedUsers.push({
                      email: user.email,
                      firstname: user.firstname,
                      phone: user.phone,
                    });
                  }
                } else {
                  failedUsers.push({
                    email: user.email,
                    firstname: user.firstname,
                    phone: user.phone,
                  });
                }
              }
              await contactModel.insertMany(successfulUsers);

              res.status(200).json({
                message: `Upload successful, contacts uploaded: ${uploadedNumber}`,
                failedUsers: failedUsers,
              });
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
        const { hour, minute, agentId, limit, fromNumber } = req.body;
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
        const { jobId, scheduledTime, contacts } = await scheduleCronJob(
          scheduledTimePST,
          agentId,
          limit,
          fromNumber,
          formattedDate,
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
            { callstatus: jobstatus.CANCELLED },
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

  getTimefromcallendly() {
    this.app.post("/check-appointments", async (req: Request, res: Response) => {
      try {
        const result = await checkAvailability();
        res.json({ result });
      } catch (error) {
        console.error("Error stopping job:", error);
        return res
          .status(500)
          .send(`Issue getting callendly time with error: ${error}`);
      }
    });
  }
  getTimefromCallendly2() {
    this.app.post("/follow-up-appointments", async (req: Request, res: Response) => {
      try {
        const result = await checkAvailability2();
        res.json({ result });
      } catch (error) {
        console.error("Error stopping job:", error);
        return res
          .status(500)
          .send(`Issue getting callendly time with error: ${error}`);
      }
    });
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
          const { call_id, agent_id } = payload.data;
          await contactModel.findOneAndUpdate(
            { callId: call_id, agentId: agent_id },
            { status: callstatusenum.IN_PROGRESS },
          );
        }
        if (payload.event === "call_ended") {
          console.log("call ended for: ", payload.data.call_id);
        }
        if (payload.event === "call_analyzed") {
          const { call_summary, user_sentiment, agent_sentiment } =
            payload.data.call_analysis;
          const { call_id, transcript, recording_url, agent_id } = payload.data;
          const analyzedTranscript = await reviewTranscript(transcript);
          const results = await EventModel.create({
            callId: call_id,
            retellCallSummary: call_summary,
            userSentiment: user_sentiment,
            agentSemtiment: agent_sentiment,
            recordingUrl: recording_url,
            transcript: transcript,
            disconnectionReason: payload.data.disconnection_reason,
            analyzedTranscript: analyzedTranscript.message.content,
          });
          const isMachine =
            payload.data.disconnection_reason === "machine_detected";
          const statsResults = await DailyStats.updateOne(
            { myDate: todayString, agentId: agent_id },
            {
              $inc: {
                totalCalls: 1,
                ...(isMachine && {
                  callsNotAnswered: 1,
                }),
              },
            },
            { upsert: true },
          );
          await contactModel.findOneAndUpdate(
            { callId: call_id },
            {
              status: isMachine
                ? callstatusenum.VOICEMAIL
                : callstatusenum.CALLED,
              $push: { datesCalled: todayString },
              referenceToCallId: results._id,
              linktocallLogModel: statsResults.upsertedId
                ? statsResults.upsertedId._id
                : null,
              answeredByVM: true,
            },
          );
          await redisClient.del(webhookRedisKey);
          return;
        }
      } catch (error) {
        console.log(error);
      }
    });
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

          // Validate date
          if (!startDate || !endDate) {
            throw new Error("Date is missing in the request body");
          }

          const foundAgents: Ilogs[] = await DailyStats.find({
            $and: [
              { myDate: { $gte: startDate, $lte: endDate } },
              { agentId: { $in: agentIds } },
            ],
          });

          // Initialize variables to store aggregated stats
          let TotalCalls = 0;
          let TotalAnsweredCalls = 0;
          let TotalNotAnsweredCalls = 0;

          // Calculate totals for each agent
          foundAgents.forEach((agent) => {
            TotalCalls += agent.totalCalls || 0;
            TotalAnsweredCalls += agent.callsAnswered || 0;
            TotalNotAnsweredCalls += agent.callsNotAnswered || 0;
          });

          // Calculate TotalAnsweredCall
          const TotalAnsweredCall =
            TotalAnsweredCalls + (TotalCalls - TotalNotAnsweredCalls);

          // Respond with the aggregated stats and dailyStats
          res.send({
            TotalNotAnsweredCalls,
            TotalAnsweredCall,
            TotalCalls,
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
    this.app.post(
      "/search",
      authmiddleware,
      async (req: Request, res: Response) => {
        const {
          searchTerm,
          startDate,
          endDate,
          statusOption,
          sentimentOption,
          agentId,
        } = req.body;

        if (!searchTerm || !agentId) {
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

          const searchForTerm = async (
            term: string,
            searchByEmail: boolean,
          ) => {
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
            if (startDate && endDate) {
              query["datesCalled"] = {
                $gte: startDate,
                $lte: endDate,
              };
            }
            if (statusOption && statusOption !== "All") {
              let callStatus;
              if (statusOption === "call-connected") {
                callStatus = callstatusenum.CALLED;
              } else if (statusOption === "not called") {
                callStatus = callstatusenum.NOT_CALLED;
              } else if (statusOption === "called-NA-VM") {
                callStatus = callstatusenum.VOICEMAIL;
              } else if (statusOption === "call-failed") {
                callStatus = callstatusenum.FAILED;
              }
              query["status"] = callStatus;
            }
            return await contactModel.find(query).populate("referenceToCallId");
          };

          let allResults: any[] = [];

          for (const term of searchTerms) {
            const results = await searchForTerm(term, firstTermIsEmail);
            allResults = allResults.concat(results);
          }

          if (!sentimentOption) {
            res.json(allResults);
          } else {
            const filteredResults = allResults.filter((contact) => {
              console.log(contact)
              const analyzedTranscript =
                contact.referenceToCallId.analyzedTranscript;
              return (
                analyzedTranscript &&
                analyzedTranscript === sentimentOption
              );
            });
            res.json(filteredResults);
          }
        } catch (error) {
          console.log(error);
          res.status(500).json({ error: "Internal server error" });
        }
      },
    );
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

  async  deleteContactsByEmail(emails:any) {
    try {
        // Split the input string containing comma-separated emails into an array
        const emailArray = emails.split(',');
        console.log(emailArray)

        // Use Mongoose's deleteMany function to remove documents with matching emails
        const result = await contactModel.deleteMany({ email: { $in: emailArray } });

        console.log(`${result.deletedCount} contacts deleted.`);
        return result;
    } catch (error) {
        console.error("Error deleting contacts:", error);
        throw error; // Forwarding the error for handling in upper layers
    }
}


}

