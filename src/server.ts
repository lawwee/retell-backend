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
import VoiceResponse from "twilio/lib/twiml/VoiceResponse";
import {
  createContact,
  deleteOneContact,
  getAllContact,
  updateOneContact,
} from "./contacts/contact_controller";
import { connectDb, contactModel } from "./contacts/contact_model";
import { DemoLlmClient } from "./llm_openai";
import { TwilioClient } from "./twilio_api";
import { RetellRequest } from "./types";
connectDb();
export class Server {
  private httpServer: HTTPServer;
  public app: expressWs.Application;
  private llmClient: DemoLlmClient;
  private retellClient: RetellClient;
  private twilioClient: TwilioClient;

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
    this.handleContactUpdate()

    this.llmClient = new DemoLlmClient();
    this.retellClient = new RetellClient({
      apiKey: process.env.RETELL_API_KEY,
    });

    this.twilioClient = new TwilioClient();
    this.ListenTwilioVoiceWebhook();
  }

  listen(port: number): void {
    this.app.listen(port);
    console.log("Listening on " + port);
  }

  // Only used for web frontend to register call so that frontend don't need api key
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
          await contactModel.findByIdAndUpdate(
            id,
            { callId: callResponse.callDetail.callId },
            { new: true },
          );
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

        // Start sending the begin message to signal the client is ready.
        this.llmClient.BeginMessage(ws, callId);

        ws.on("error", (err) => {
          console.error("Error received in LLM websocket client: ", err);
        });
        ws.on("close", (err) => {
          console.error("Closing llm ws for: ", callId);
        });

        ws.on("message", async (data: RawData, isBinary: boolean) => {
          console.log(data.toString());
          if (isBinary) {
            console.error("Got binary message instead of text in websocket.");
            ws.close(1002, "Cannot find corresponding Retell LLM.");
          }
          try {
            const request: RetellRequest = JSON.parse(data.toString());
            this.llmClient.DraftResponse(request, ws);
          } catch (err) {
            console.error("Error in parsing LLM websocket message: ", err);
            ws.close(1002, "Cannot parse incoming message.");
          }
        });
      },
    );
  }
  handleContactSaving() {
    this.app.post("/users/create", async (req: Request, res: Response) => {
      const { firstname, lastname, email, phone } = req.body;
      try {
        const result = await createContact(firstname, lastname, email, phone);
        res.json({ result });
      } catch (error) {}
    });
  }
  handlecontactGet() {
    this.app.get("/users", async (req: Request, res: Response) => {
      try {
        const result = await getAllContact();
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
      const { id, ...fields } = req.body;
      if(!fields){
         return res
           .status(400)
           .json({ error: "No fields to update provided." });
      }
      try {
        const result = await updateOneContact(id, fields);
        res.json({ result });
      } catch (error) {
        res
          .status(500)
          .json({ error: "An error occurred while updating contact." });
      }
    });
  }
  ListenTwilioVoiceWebhook() {
    this.app.post(
      "/twilio-voice-webhook/:agentId/:userId",
      async (req: Request, res: Response) => {
        const { agentId, userId } = req.params;
        const { answeredBy } = req.body;

        try {
          // Respond with TwiML to hang up the call if its machine
          if (answeredBy && answeredBy === "machine_start") {
            this.twilioClient.EndCall(req.body.CallSid);
            await contactModel.findByIdAndUpdate(
              req.body.contactId, // Assuming you have a field named contactId in req.body to identify the contact
              { status: "Voicemail" },
              { new: true },
            );

            return;
          }
          const callResponse = await this.retellClient.registerCall({
            agentId: agentId,
            audioWebsocketProtocol: AudioWebsocketProtocol.Twilio,
            audioEncoding: AudioEncoding.Mulaw,
            sampleRate: 8000,
          });

          if (callResponse.callDetail) {
            await contactModel.findByIdAndUpdate(
              userId,
              { callId: callResponse.callDetail.callId },
              { new: true },
            );

            // Start phone call websocket
            const response = new VoiceResponse();
            const start = response.connect();

            const stream = start.stream({
              url: `wss://api.retellai.com/audio-websocket/${callResponse.callDetail.callId}`,
            });

            res.set("Content-Type", "text/xml");
            res.send(response.toString());
          }
        } catch (err) {
          console.error("Error in twilio voice webhook:", err);
          res.status(500).send();
        }
      },
    );
  }
  handleRetellLlPhoneSocket() {
    this.app.ws(
      "wss://api.retellai.com/audio-websocket/:call_id",
      async (ws: WebSocket, req: Request) => {
        const callId = req.params.call_id;
        console.log("Handle llm ws for: ", callId);

        // Start sending the begin message to signal the client is ready.
        this.llmClient.BeginMessage(ws, callId);

        ws.on("error", (err) => {
          console.error("Error received in LLM websocket client: ", err);
        });
        ws.on("close", (err) => {
          console.error("Closing llm ws for: ", callId, err);
        });

        ws.on("message", async (data: RawData, isBinary: boolean) => {
          console.log(data.toString());
          if (isBinary) {
            console.error("Got binary message instead of text in websocket.");
            ws.close(1002, "Cannot find corresponding Retell LLM.");
          }
          try {
            const request: RetellRequest = JSON.parse(data.toString());
            this.llmClient.DraftResponse(request, ws);
          } catch (err) {
            console.error("Error in parsing LLM websocket message: ", err);
            ws.close(1002, "Cannot parse incoming message.");
          }
        });
      },
    );
  }
  createPhoneCall() {
    this.app.post(
      "/create-phone-call/:agent_id",
      async (req: Request, res: Response) => {
        const { fromNumber, toNumber, id } = req.body;
        const agentId = req.params.agent_id;
        if (!agentId || !fromNumber || !toNumber || !id) {
          return res.json({ status: "error", message: "Invalid request" });
        }
        try {
          await this.twilioClient.RegisterPhoneAgent(fromNumber, agentId);
          const result = await this.twilioClient.CreatePhoneCall(
            fromNumber,
            toNumber,
            agentId,
            id,
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
}
