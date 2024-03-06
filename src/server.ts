import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
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
import { IContact, RetellRequest } from "./types";
import * as Papa from "papaparse"
import fs from "fs"
import multer from "multer"
connectDb();

export class Server {
  private httpServer: HTTPServer;
  public app: expressWs.Application;
  private llmClient: DemoLlmClient;
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

    this.llmClient = new DemoLlmClient();
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
        console.log("the call id for the reached websocket is: ", callId);
        console.log("Handle llm ws for: ", callId);

        // Start sending the begin message to signal the client is ready.
        this.llmClient.BeginMessage(ws, callId);

        ws.on("error", (err) => {
          console.error("Error received in LLM websocket client: ", err);
        });
        ws.on("close", async (err) => {
          await contactModel.findOneAndUpdate({ callId }, { status: "called" });
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
      "/create-phone-call/:agent_id",
      async (req: Request, res: Response) => {
        const { fromNumber, toNumber, userId } = req.body;
        const agentId = req.params.agent_id;
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
      "/upload",
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
              const jsonArrayObj : IContact[] = results.data as IContact[]
              const insertedUsers = [];
              for (const user of jsonArrayObj) {
                // Check if the user already exists in the database
                const existingUser = await contactModel.findOne({
                  email: user.email,
                }); // Assuming email is unique
                if (!existingUser) {
                  // If user doesn't exist, insert them into the database
                  const insertedUser = await contactModel.create(user);
                  insertedUsers.push(insertedUser);
                }
              }
              console.log("Upload successful");
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
}
