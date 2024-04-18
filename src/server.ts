import cors from "cors";
import express, { Request, Response } from "express";
import expressWs from "express-ws";
import { Server as HTTPServer, createServer } from "http";
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
import { TwilioClient } from "./twilio_api";
import { CustomLlmRequest, CustomLlmResponse } from "./types";
import {
  IContact,
  Ilogs,
  RetellRequest,
  callstatusenum,
  jobstatus,
} from "./types";
import * as Papa from "papaparse";
import fs from "fs";
import multer from "multer";
import moment from "moment-timezone";
import { chloeDemoLlmClient } from "./VA-GROUP-LLM/chloe_llm_openai";
import { ethanDemoLlmClient } from "./VA-GROUP-LLM/ethan_llm_openai";
import { danielDemoLlmClient } from "./VA-GROUP-LLM/daniel_llm-openai";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import schedule from "node-schedule";
// import { testFunctionCallingLlmClient } from "./llm_azure_openai_func_call";
import { createObjectCsvWriter } from "csv-writer";
import path from "path";
process.env.TZ = "America/Los_Angeles";
connectDb();
import SmeeClient from "smee-client";
import { katherineDemoLlmClient } from "./Other-LLM/be+well_llm_openai";
import { DailyStats } from "./contacts/call_log";
import { RegisterCallResponse } from "retell-sdk/resources/call";
import { AgentResponse, LlmResponse } from "retell-sdk/resources";
import { test2FunctionCallingLlmClient } from "./TEST-LLM/llm_openai_func_call2";
export class Server {
  private httpServer: HTTPServer;
  public app: expressWs.Application;
  private retellClient: Retell;
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
    this.statsForAgent();
    this.peopleStatsLog();
    this.updateLog();
    this.peopleStatToCsv();
    // this.stopSpecificJob();
    this.createPhoneCall2();

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
          const callResponse: RegisterCallResponse =
            await this.retellClient.call.register({
              agent_id: agentId,
              audio_websocket_protocol: "web",
              audio_encoding: "s16le",
              sample_rate: 24000,
            });
          // Send back the successful response to the client
          res.json(callResponse);
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
        // const timeoutId = setTimeout(() => {
        //   if (ws) ws.close(1002, "Timeout after 120 seconds");
        // }, 1000 * 120);

        // Send config to Retell server
        const config: CustomLlmResponse = {
          response_type: "config",
          config: {
            auto_reconnect: true,
            call_details: true,
          },
        };
        ws.send(JSON.stringify(config));

        // Start sending the begin message to signal the client is ready

        if (user.agentId === "214e92da684138edf44368d371da764c") {
          console.log("Call started with ethan/ olivia");
          const client = new test2FunctionCallingLlmClient();
          client.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            let result;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayString = today.toISOString().split("T")[0];
            // Find the document with the given criteria
            const findResult = await DailyStats.findOne({
              myDate: todayString,
              agentId: user.agentId,
            });

            if (!findResult) {
              // If the document doesn't exist, create it with the required fields
              result = await DailyStats.create({
                agentId: user.agentId,
                myDate: todayString,
                totalCalls: 1,
                callsAnswered: 0,
                callsNotAnswered: 0,
              });
            } else {
              // If the document exists, update the required fields
              result = await DailyStats.findOneAndUpdate(
                { myDate: todayString, agentId: user.agentId },
                {
                  $inc: {
                    totalCalls: 1,
                  },
                },
                { new: true },
              );
            }

            // Continue with the rest of your code
            await contactModel.findOneAndUpdate(
              { callId },
              {
                status: callstatusenum.CALLED,
                linktocallLogModel: result._id,
                $push: { datesCalled: todayString },
              },
            );
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
              console.log("call details: ", request.call);
              // print call detailes
            } else if (request.interaction_type === "update_only") {
              // process live transcript update if needed
            } else if (
              request.interaction_type === "reminder_required" ||
              request.interaction_type === "response_required"
            ) {
              console.clear();
              console.log("req", request);
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
            let result;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayString = today.toISOString().split("T")[0];
            // Find the document with the given criteria
            const findResult = await DailyStats.findOne({
              myDate: todayString,
              agentId: user.agentId,
            });

            if (!findResult) {
              // If the document doesn't exist, create it with the required fields
              result = await DailyStats.create({
                agentId: user.agentId,
                myDate: todayString,
                totalCalls: 1,
                callsAnswered: 0,
                callsNotAnswered: 0,
              });
            } else {
              // If the document exists, update the required fields
              result = await DailyStats.findOneAndUpdate(
                { myDate: todayString, agentId: user.agentId },

                {
                  $inc: {
                    totalCalls: 1,
                  },
                },
                { new: true },
              );
            }
            await contactModel.findOneAndUpdate(
              { callId },
              {
                status: callstatusenum.CALLED,
                linktocallLogModel: result._id,
                $push: { datesCalled: todayString },
              },
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
              console.log("call details: ", request.call);
              // print call detailes
            } else if (request.interaction_type === "update_only") {
              // process live transcript update if needed
            } else if (
              request.interaction_type === "reminder_required" ||
              request.interaction_type === "response_required"
            ) {
              console.clear();
              console.log("req", request);
              client.DraftResponse(request, ws);
            }
          });
        }

        if (user.agentId === "86f0db493888f1da69b7d46bfaecd360") {
          console.log("Call started with daniel/emily");
          const client = new danielDemoLlmClient()
          client.BeginMessage(ws, user.firstname, user.email);
          ws.on("error", (err) => {
            console.error("Error received in LLM websocket client: ", err);
          });
          ws.on("close", async (err) => {
            let result;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayString = today.toISOString().split("T")[0];
            // Find the document with the given criteria
            const findResult = await DailyStats.findOne({
              myDate: todayString,
              agentId: user.agentId,
            });

            if (!findResult) {
              // If the document doesn't exist, create it with the required fields
              result = await DailyStats.create({
                agentId: user.agentId,
                myDate: todayString,
                totalCalls: 1,
                callsAnswered: 0,
                callsNotAnswered: 0,
              });
            } else {
              // If the document exists, update the required fields
              result = await DailyStats.findOneAndUpdate(
                { myDate: todayString, agentId: user.agentId },
                {
                  $inc: {
                    totalCalls: 1,
                  },
                },
                { new: true },
              );
            }
            await contactModel.findOneAndUpdate(
              { callId },
              {
                status: callstatusenum.CALLED,
                linktocallLogModel: result._id,
                $push: { datesCalled: todayString },
              },
            );
            // clearTimeout(timeoutId);
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
              console.log("call details: ", request.call);
              // print call detailes
            } else if (request.interaction_type === "update_only") {
              // process live transcript update if needed
            } else if (
              request.interaction_type === "reminder_required" ||
              request.interaction_type === "response_required"
            ) {
              console.clear();
              console.log("req", request);
              client.DraftResponse(request, ws);
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

  createPhoneCall2() {
    this.app.post("/phone2", async (req: Request, res: Response) => {
      const { fromNumber, toNumber, userId } = req.body;
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
      const agent: AgentResponse = await this.retellClient.agent.update(
        "0411eeeb12d17a340941e91a98a766d0",
        { llm_websocket_url: "http://retellai.com/retell-llm-new/6e28fc57e6a8d44226df765cc07b69a5" },
      );
      // await this.retellClient.call.register({
      //   agent_id: "0411eeeb12d17a340941e91a98a766d0",
      //   audio_encoding: "s16le",
      //   audio_websocket_protocol: "twilio",
      //   sample_rate: 24000,
      //   end_call_after_silence_ms: 15000
      // });
      // const registerCallResponse2 = await this.retellClient.call.create({
      //   from_number: fromNumber,
      //   to_number: toNumber,
      //   override_agent_id: "0411eeeb12d17a340941e91a98a766d0",
      //   retell_llm_dynamic_variables: {
      //     user_firstname: result.firstname,
      //     user_email: result.email,
          
      //   },
      // });
      // console.log(llm.states);
      // console.log(agent.agent_id);
      res.send(agent);
    });
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
          { status: "not called", answeredByVM: false },
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
            await new Promise((resolve) => setTimeout(resolve, 3000));
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
    this.app.post("/calender", async (req: Request, res: Response) => {
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
          const { event, call_id, transcript, recording_url } = payload.data;

          // Perform custom actions with the transcript, timestamps, etc.
          console.log(transcript);
          const result = await EventModel.create({
            event: payload.event,
            transcript,
            callId: call_id,
            recordingUrl: recording_url,
          });
          await contactModel.findOneAndUpdate(
            { callId: call_id },
            { referenceToCallId: result._id },
          );
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

  statsForAgent() {
    this.app.post("/get-stats", async (req: Request, res: Response) => {
      try {
        const agent1 = "214e92da684138edf44368d371da764c";
        const agent2 = "0411eeeb12d17a340941e91a98a766d0";
        const agent3 = "86f0db493888f1da69b7d46bfaecd360";
        const { date } = req.body;

        // Validate date
        if (!date) {
          throw new Error("Date is missing in the request body");
        }

        // Find documents for each agent
        const foundAgent1 = await DailyStats.findOne({
          myDate: date,
          agentId: agent1,
        });
        const foundAgent2 = await DailyStats.findOne({
          myDate: date,
          agentId: agent2,
        });
        const foundAgent3 = await DailyStats.findOne({
          myDate: date,
          agentId: agent3,
        });

        // Initialize variables to store aggregated stats
        let TotalCalls = 0;
        let TotalAnsweredCalls = 0;
        let TotalNotAnsweredCalls = 0;

        // Calculate totals only if documents are found
        if (foundAgent1) {
          TotalCalls += foundAgent1.totalCalls || 0;
          TotalAnsweredCalls += foundAgent1.callsAnswered || 0;
          TotalNotAnsweredCalls += foundAgent1.callsNotAnswered || 0;
        }
        if (foundAgent2) {
          TotalCalls += foundAgent2.totalCalls || 0;
          TotalAnsweredCalls += foundAgent2.callsAnswered || 0;
          TotalNotAnsweredCalls += foundAgent2.callsNotAnswered || 0;
        }
        if (foundAgent3) {
          TotalCalls += foundAgent3.totalCalls || 0;
          TotalAnsweredCalls += foundAgent3.callsAnswered || 0;
          TotalNotAnsweredCalls += foundAgent3.callsNotAnswered || 0;
        }

        const TotalAnsweredCall =
          TotalAnsweredCalls + (TotalCalls - TotalNotAnsweredCalls);
        // Respond with the aggregated stats and dailyStats
        res.json({
          TotalNotAnsweredCalls,
          TotalAnsweredCall,
          TotalCalls,
        });
      } catch (error) {
        console.error("Error fetching daily stats:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
  }
  peopleStatsLog() {
    this.app.post("/get-metadata", async (req: Request, res: Response) => {
      try {
        const { logId1, logId2, logId3, date } = req.body;
        const agentIds = [
          "214e92da684138edf44368d371da764c",
          "0411eeeb12d17a340941e91a98a766d0",
          "86f0db493888f1da69b7d46bfaecd360",
        ]; // Array of agent IDs

        const logIds = [logId1, logId2, logId3].filter((id) => id); // Filter out undefined or null values
        const dailyStats = await contactModel.find({
          datesCalled: { $in: [date] },
          agentId: { $in: agentIds },
          isDeleted: { $ne: true },
        });

        res.json({ dailyStats });
      } catch (error) {
        console.log(error);
      }
    });
  }
  updateLog() {
    this.app.post("/updateLog", async (req: Request, res: Response) => {
      try {
        // Fetch the documents that need to be updated
        const documentsToUpdate = await contactModel
          .find({
            updatedAt: { $ne: null },
            agentId: "0411eeeb12d17a340941e91a98a766d0",
            status: "called-answered",
          })
          .sort({ updatedAt: -1 });
        // Limit the number of documents fetched

        // Update each document
        const updateResults = [];
        for (const doc of documentsToUpdate) {
          const result = await contactModel.updateOne(
            { _id: doc._id },
            { $set: { linktocallLogModel: "6615d9d3ed452636ea7491ee" } },
          );
          updateResults.push(result);
        }

        res.json(updateResults.length);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
      //  try {
      //    // Update the first 1000 documents to remove the specified field
      //    const updateResult = await contactModel.updateMany(
      //      {
      //        updatedAt: { $ne: null },
      //        agentId: "214e92da684138edf44368d371da764c",
      //      },
      //      { $unset: { linktocallLogModel: "" } }, // Replace 'fieldNameToDelete' with the name of the field you want to delete
      //      { limit: 1000 },
      //    );

      //    res.json(updateResult);
      //  } catch (error) {
      //    console.error(error);
      //    res.status(500).json({ error: "Internal server error" });
      //  }
    });
  }

  peopleStatToCsv() {
    this.app.post("/get-metadata-csv", async (req, res) => {
      try {
        const { logId1, logId2, logId3, date } = req.body;
        const agentIds = [
          "214e92da684138edf44368d371da764c",
          "0411eeeb12d17a340941e91a98a766d0",
          "86f0db493888f1da69b7d46bfaecd360",
        ]; // Array of agent IDs

        const logIds = [logId1, logId2, logId3].filter((id) => id); // Filter out undefined or null values

        // const dailyStats = await contactModel
        //   .find({
        //     agentId: { $in: agentIds },
        //     linktocallLogModel: { $in: logIds },
        //   })
        //   .sort({ createdAt: "desc" })
        //   .populate("referenceToCallId");
        const dailyStats = await contactModel
          .find({
            datesCalled: { $in: [date] },
            agentId: { $in: agentIds },
            isDeleted: { $ne: true },
          })
          .sort({ createdAt: "desc" })
          .populate("referenceToCallId");
        //   .populate("referenceToCallId");
        // Extract relevant fields from found contacts
        const contactsData = dailyStats.map((contact) => ({
          name: contact.firstname,
          email: contact.email,
          phone: contact.phone,
          status: contact.status,
          transcript: contact.referenceToCallId?.transcript || "",
          call_recording_url: contact.referenceToCallId.recordingUrl,
        }));

        // Write contacts data to CSV file
        const filePath = path.join(__dirname, "..", "public", "stats.csv");
        console.log("File path:", filePath); // Log file path for debugging

        const csvWriter = createObjectCsvWriter({
          path: filePath,
          header: [
            { id: "name", title: "Name" },
            { id: "email", title: "Email" },
            { id: "phone", title: "Phone Number" },
            { id: "status", title: "Status" },
            { id: "transcript", title: "Transcript" },
            { id: "call_recording_url", title: "Call_Recording_Url" },
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
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
}
