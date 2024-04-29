process.env.TZ = "America/Los_Angeles";
import cors from "cors";
import express, { Request, Response } from "express";
import expressWs from "express-ws";
import https, { Server as HTTPSServer, createServer as httpsCreateServer } from "https";
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
import { TwilioClient } from "./twilio_api";
import { CustomLlmRequest, CustomLlmResponse } from "./types";
import {
  IContact,
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
connectDb();

export class Server {
  public app: expressWs.Application;
  private httpServer: HTTPServer;
  private httpsServer: HTTPSServer;
  private retellClient: Retell;
  private twilioClient: TwilioClient;
  private client : OpenAI
  storage = multer.diskStorage({
    destination: "public/", // Destination directory for uploaded files
    filename: function (req, file, cb) {
      cb(null, file.originalname); // Use original file name
    },
  });
   
  upload = multer({ storage: this.storage });
  constructor() {
    this.app = expressWs(express()).app;
    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, "public")));
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_APIKEY,
    });

    this.testReetellWebsocket()
    this.handleRetellLlmWebSocket();
    this.handleContactSaving();
    this.handlecontactDelete();
    this.handlecontactGet();
    this.createPhoneCall();
    this.handleContactUpdate();
    this.uploadcsvToDb();
    this.schedulemycall();
    this.getjobstatus();
    this.updateStatus();
    this.getTimefromcallendly();
    this.getCallLogs();
    this.stopSpecificSchedule();
    this.getAllJobSchedule();
    this.getTranscriptAfterCallEnded();
    this.getAllJob();
    this.stopSpecificJob();
    this.deleteAll();
    this.logsToCsv();
    this.statsForAgent();
    this.peopleStatsLog();
    this.peopleStatToCsv();
    this.createPhoneCall2();
    this.testwebsocket()
    this.testTranscriptReview()
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
    target: "http://localhost:8080/webhook",
    logger: console,
  });
  events = this.smee.start();

  testReetellWebsocket() {
    this.app.ws('/testwebsocket', async (ws, req) => {
        const user = { agentId: "1" };
        console.log('WebSocket connection established');
        // Handle incoming WebSocket messages
        ws.on('message', async (msg) => {
            console.log('Received message:', msg);
            const message = " i am No 1";
            let counter = 0;
            const intervalId = setInterval(() => {
                if (counter < 5) {
                    ws.send(message);
                    console.log('Message sent:', message);
                    counter++;
                } else {
                    clearInterval(intervalId); 
                    ws.close()
                }
            }, 1000);
        });
        ws.on('close', async () => {
            const today = new Date();
            const todayString = today.toISOString().split("T")[0];
            await DailyStats.updateOne(
                { myDate: todayString, agentId: user.agentId },
                { $inc: { totalCalls: 1 } },
                { upsert: true }
            );
            console.log('WebSocket connection closed');
       
        });

    });
}

  handleRetellLlmWebSocket() {
    this.app.ws(
      "/llm-websocket/:call_id",
      async (ws: WebSocket, req: Request) => {
        const callId = req.params.call_id;
        console.log("Handle llm ws for: ", callId);
        const user = await contactModel.findOne({ callId });
        console.log("this is the agent id",user.agentId)
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
          const client = new testDemoLlmClient()
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
    this.app.post("/users/:agentId", async (req: Request, res: Response) => {
      const agentId = req.params.agentId;
      const {page, limit} = req.body
      try {
        const result = await getAllContact(agentId,page, limit );
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
          await this.twilioClient.RegisterPhoneAgent(fromNumber, agentId, userId);
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
      const { jobId, scheduledTime } = await scheduleCronJob(
        scheduledTimePST,
        agentId,
        limit,
        fromNumber,
        formattedDate,
      );
      res.send({ jobId, scheduledTime });
    });
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
      let responseString = ""; 
      for (const jobId in scheduledJobs) {
        if (scheduledJobs.hasOwnProperty(jobId)) {
          const job = scheduledJobs[jobId];
          responseString += `Job ID: ${jobId}, Next scheduled run: ${job.nextInvocation()}\n`;
        }
      }
      res.send({ responseString });
    });
  }

  getCallLogs() {
    this.app.post("/call-logs", async (req: Request, res: Response) => {
      const { agentId } = req.body;
      const result = await jobModel.find({ agentId });
      res.json({ result });
    });
  }

  getTimefromcallendly() {
    this.app.get("/calender", async (req: Request, res: Response) => {
      try {
        const result = await checkAvailability()
        res.json({result})
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
      try {
        if (payload.event === "call_analyzed") {
          const { call_id, transcript, recording_url , agent_id} = payload.data;
          const result = await EventModel.create({
            transcript,
            callId: call_id,
            recordingUrl: recording_url,
          })
         const result1 = await DailyStats.updateOne(
            { myDate: todayString, agentId: agent_id },
            { $inc: { totalCalls: 1 } },
            { upsert: true }
        );
        await contactModel.findOneAndUpdate(
          { callId:call_id },
          {
            status: callstatusenum.CALLED,
            linktocallLogModel: result1.upsertedId ? result1.upsertedId._id : null,
            $push: { datesCalled: todayString },
            referenceToCallId: result._id
          },
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
      try {
        const { agentId, limit } = req.body;
        const newlimit = parseInt(limit);
        const result = await logsToCsv(agentId, newlimit);
        if (typeof result === 'string') {
          const filePath: string = result;
          if (fs.existsSync(filePath)) {
            res.setHeader("Content-Disposition", "attachment; filename=logs.csv");
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
        const { date } = req.body;
        const agentIds = [
          "214e92da684138edf44368d371da764c",
          "0411eeeb12d17a340941e91a98a766d0",
          "86f0db493888f1da69b7d46bfaecd360",
        ]; 
        const dailyStats = await contactModel.find({
          datesCalled: date,
          agentId: { $in: agentIds },
          isDeleted: false,
        }).populate("referenceToCallId");

        res.json({ dailyStats });
      } catch (error) {
        console.log(error);
      }
    });
  }
  peopleStatToCsv() {
    this.app.post("/get-metadata-csv", async (req, res) => {
      try {
        const {date} = req.body
        const result = await statsToCsv(date)
        if (typeof result === 'string') {
          const filePath: string = result;
          if (fs.existsSync(filePath)) {
            res.setHeader("Content-Disposition", "attachment; filename=logs.csv");
            res.setHeader("Content-Type", "text/csv");
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
          } else {
            console.error("CSV file does not exist");
            res.status(404).send("CSV file not found");
          }
        } else {
          console.error(`Error retrieving contacts: ${result}`);
          res.status(500).send(`Error retrieving contacts: ${result}`);}
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
  testwebsocket() {
    this.app.ws('/websockets', async (ws, req) => {
      // WebSocket connection handler
      console.log('WebSocket connection established');
      
      // Handle incoming WebSocket messages
      ws.on('message', (msg) => {
        console.log('Received message:', msg);
      });

      // Handle WebSocket closure
      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    });
  }
  testTranscriptReview(){
  this.app.post("/review", async (req: Request, res:Response) => {
    const transcript =`Agent: Hi, is this Nick? 
    User: Yes. It is.
    Agent: Hi Nick, I hope your day's going well. This is Daniel from Virtual Help Desk. I'm following up on an inquiry you submitted for our virtual assistant services. Were you still looking for help? 
    User: Yeah.
    Agent: Great! I'd love to set up a short Zoom call with our Sales Manager to discuss how we can customize our services specifically for you. Are you available next Thursday at 9 am Pacific? 
    User: That'll work.
    Agent: Great! You're all set for next Thursday at 9 am Pacific. Just to confirm, is your email still test-1-at-gmail.com? 
    User: Yes. It is.
    Agent: Perfect! You'll receive a short questionnaire and video to watch before your meeting. Before we wrap up, could you provide an estimate of how many hours per day you might need assistance from a V.A.? 
    User: No clue.
    Agent: No worries, our sales manager, Kyle, will be meeting with`
    const completion = await this.client.chat.completions.create({
      messages: [{"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content":`Analyze the transcript to determine if there are indications of interest in scheduling a meeting: ${transcript}`}],
      model: "gpt-3.5-turbo",
    });
  
    res.json({result: completion.choices[0]})
  }
)  }
}
