import express, { Request, Response } from "express";
import { RawData, WebSocket } from "ws";
import { createServer, Server as HTTPServer } from "http";
import cors from "cors";
import expressWs from "express-ws";
// import { DemoLlmClient } from "./llm_azure_openai";
import { TwilioClient } from "./twilio_api";
import { RetellClient } from "retell-sdk";
import {
  AudioWebsocketProtocol,
  AudioEncoding,
} from "retell-sdk/models/components";
import { LLMDummyMock } from "./llm_dummy_mock";
import { DemoLlmClient } from "./llm_openai";
import { RetellRequest } from "./types";
import { createContact, deleteOneContact, getAllContact } from "./contacts/contact_controller";
import { connectDb, contactModel } from "./contacts/contact_model";
connectDb()
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
    this.handleContactSaving()
    this.handlecontactDelete()
    this.handlecontactGet()
    

    this.llmClient = new DemoLlmClient();

    this.retellClient = new RetellClient({
      apiKey: process.env.RETELL_API_KEY,
    });

    // this.twilioClient = new TwilioClient();
    // this.twilioClient.ListenTwilioVoiceWebhook(this.app);
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
            sampleRate: 24000
          });
          // Send back the successful response to the client
          await contactModel.findByIdAndUpdate(id, {callId: callResponse.callDetail.callId}, {new: true})
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
    this.app.post("/test", async (req: Request, res: Response) => {
      const { firstname, lastname, email, phone } = req.body;
      try {
        const result = await createContact(firstname, lastname, email, phone);
        res.json({ result });
      } catch (error) {}
    });
  }

  handlecontactGet() {
    this.app.get("/fetchusers", async (req: Request, res: Response) => {
      try {
        const result = await getAllContact();
        res.json({ result });
      } catch (error) {}
    });
  }
  handlecontactDelete() {
    this.app.patch("/deleteTest", async (req: Request, res: Response) => {
      const { id } = req.body;
      try {
        const result = await deleteOneContact(id);
        res.json({ result });
      } catch (error) {}
    });
  }



}
